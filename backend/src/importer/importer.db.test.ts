import { fileURLToPath } from 'node:url';
import { sql, type Transaction } from 'kysely';
import { afterAll, describe, expect, it } from 'vitest';
import { getDb } from '../db/index.js';
import type { DB } from '../db/types.js';
import { importOsm } from './importer.run.js';
import { readOsm, type OsmExtract } from './osm.reader.js';

const FIXTURE = fileURLToPath(new URL('./fixtures/two-blocks.osm', import.meta.url));

/**
 * Señal para que la transacción de la prueba se deshaga: Kysely no tiene un "rollback"
 * explícito, y tirar dentro de `execute` es la forma documentada de pedirlo. Así el test
 * no deja un grafo de mentira en la base de desarrollo.
 */
class Rollback extends Error {}

async function inRolledBackTransaction<T>(
  work: (trx: Transaction<DB>) => Promise<T>,
): Promise<T> {
  let result: T | undefined;

  try {
    await getDb()
      .transaction()
      .execute(async (trx) => {
        result = await work(trx);
        throw new Rollback();
      });
  } catch (error) {
    if (!(error instanceof Rollback)) throw error;
  }

  return result as T;
}

/** Los ids y las cantidades que no pueden cambiar entre dos corridas. */
async function snapshot(trx: Transaction<DB>): Promise<Record<string, number[] | number>> {
  const counts = await sql<{ kerbs: string; sidewalks: string; crossings: string }>`
    SELECT (SELECT count(*) FROM kerb_nodes) AS kerbs,
           (SELECT count(*) FROM sidewalks) AS sidewalks,
           (SELECT count(*) FROM crossings) AS crossings
  `.execute(trx);

  const kerbIds = await sql<{ ids: number[] }>`
    SELECT array_agg(id ORDER BY id) AS ids FROM kerb_nodes
  `.execute(trx);

  const sidewalkIds = await sql<{ ids: number[] }>`
    SELECT array_agg(id ORDER BY id) AS ids FROM sidewalks
  `.execute(trx);

  const row = counts.rows[0];

  return {
    kerbs: Number(row?.kerbs ?? 0),
    sidewalks: Number(row?.sidewalks ?? 0),
    crossings: Number(row?.crossings ?? 0),
    kerbIds: kerbIds.rows[0]?.ids ?? [],
    sidewalkIds: sidewalkIds.rows[0]?.ids ?? [],
  };
}

/**
 * El grafo del fixture como relación de aristas para pgRouting.
 *
 * Se acota a las `way` del fixture y a los cruces entre sus esquinas: la base de desarrollo
 * tiene además el grafo de la zona piloto, que cae en el mismo recuadro, y el test tiene
 * que dar lo mismo acá que en el CI, donde la base está vacía. `narrow` es lo que pide
 * `pgr_dijkstra`; `wide` agrega la geometría y el tipo de elemento para reconstruir el
 * camino.
 */
function fixtureEdges(shape: 'narrow' | 'wide'): string {
  const extra = shape === 'wide' ? ', edge.geom, edge.element_kind AS scope' : '';
  const nodes = `
    SELECT start_node_id FROM sidewalks WHERE osm_way_id BETWEEN 101 AND 114
    UNION
    SELECT end_node_id FROM sidewalks WHERE osm_way_id BETWEEN 101 AND 114
  `;

  return `
    SELECT edge.id, edge.source, edge.target, edge.cost${extra}
    FROM walkable_edges edge
    WHERE (edge.element_kind = 'sidewalk'
           AND edge.element_id IN (
             SELECT id FROM sidewalks WHERE osm_way_id BETWEEN 101 AND 114))
       OR (edge.element_kind = 'crossing'
           AND edge.source IN (${nodes}) AND edge.target IN (${nodes}))
  `;
}

/** El eje de una `way` del fixture, como WKT, para medir el offset desde ahí. */
function axisOf(extract: OsmExtract, wayId: number): string {
  const way = extract.ways.find((candidate) => candidate.id === wayId);
  if (way === undefined) throw new Error(`el fixture no tiene la way ${wayId}`);

  const coordinates = way.nodeIds.map((nodeId) => {
    const node = extract.nodes.get(nodeId);
    if (node === undefined) throw new Error(`el fixture no tiene el nodo ${nodeId}`);
    return `${node.lon} ${node.lat}`;
  });

  return `LINESTRING(${coordinates.join(', ')})`;
}

/** Distancia mínima y máxima de las veredas de una `way` a su eje, en metros. */
async function offsetsFromAxis(
  trx: Transaction<DB>,
  axis: string,
  wayId: number,
): Promise<{ min: number; max: number }> {
  const result = await sql<{ min: string; max: string }>`
    SELECT min(ST_Distance(ST_Transform(sidewalk.geom, 32719),
                           ST_Transform(ST_GeomFromText(${axis}, 4326), 32719))) AS min,
           max(ST_Distance(ST_Transform(sidewalk.geom, 32719),
                           ST_Transform(ST_GeomFromText(${axis}, 4326), 32719))) AS max
    FROM sidewalks sidewalk
    WHERE sidewalk.osm_way_id = ${wayId}
  `.execute(trx);

  return {
    min: Number(result.rows[0]?.min ?? 0),
    max: Number(result.rows[0]?.max ?? 0),
  };
}

// Sin base no hay qué probar: el resto de la suite es unitaria y no la necesita.
describe.skipIf(!process.env.DATABASE_URL)('importOsm contra la base', () => {
  afterAll(async () => {
    await getDb().destroy();
  });

  it('corre el fixture dos veces sin duplicar filas ni cambiar ids', async () => {
    const outcome = await inRolledBackTransaction(async (trx) => {
      const first = await importOsm(FIXTURE, trx);
      const before = await snapshot(trx);

      const second = await importOsm(FIXTURE, trx);
      const after = await snapshot(trx);

      return { first, second, before, after };
    });

    // Las cuentas del fixture, que es el lugar donde viven los invariantes: 14 tramos,
    // dos líneas cada uno, una pieza por línea más la vereda de la boca de la T; y cuatro
    // nodos por intersección más dos cordones por cada extremo de borde. Un cruce por
    // brazo, entre las dos esquinas que lo flanquean.
    expect(outcome.first.junctions).toEqual({ cross: 4, tee: 1, unsupported: 0 });
    expect(outcome.first.sidewalks.boca).toBe(1);
    expect(outcome.first.sidewalks.created + outcome.first.sidewalks.updated).toBe(29);
    expect(outcome.first.kerbs.created + outcome.first.kerbs.reused).toBe(38);
    expect(outcome.first.crossings.created + outcome.first.crossings.updated).toBe(19);

    // La segunda no crea nada: reconoce todo por coordenada y por par de nodos.
    expect(outcome.second.kerbs.created).toBe(0);
    expect(outcome.second.sidewalks.created).toBe(0);
    expect(outcome.second.crossings.created).toBe(0);
    expect(outcome.after).toEqual(outcome.before);
  });

  it('deja las veredas al offset de su clase o de lanes (docs/11 §3.4)', async () => {
    const extract = await readOsm(FIXTURE);

    const measured = await inRolledBackTransaction(async (trx) => {
      await importOsm(FIXTURE, trx);

      return {
        // Avenida Ancha es primary con lanes=4: 4 × 3 m / 2 + 1,5 m = 7,5 m, y `lanes`
        // gana sobre los 10 m de la clase.
        ancha: await offsetsFromAxis(trx, axisOf(extract, 105), 105),
        // Calle A es residential sin `lanes`: el offset sale de la tabla de la clase.
        calleA: await offsetsFromAxis(trx, axisOf(extract, 101), 101),
      };
    });

    expect(measured.ancha.min).toBeCloseTo(7.5, 1);
    expect(measured.ancha.max).toBeCloseTo(7.5, 1);
    expect(measured.calleA.min).toBeCloseTo(6.5, 1);
    expect(measured.calleA.max).toBeCloseTo(6.5, 1);
  });

  it('deja cada nodo conectado a alguna arista y un cruce por brazo', async () => {
    const outcome = await inRolledBackTransaction(async (trx) => {
      const report = await importOsm(FIXTURE, trx);

      // Las cuentas se limitan al recuadro del fixture: la base de desarrollo puede tener
      // el grafo de la zona piloto, y este test tiene que poder correr sobre ella.
      const fixtureBox = sql`
        ST_MakeEnvelope(-68.8483, -32.8897, -68.8443, -32.8873, 4326)
      `;

      // `cross` es palabra reservada en SQL: los alias van con una sola letra.
      const loose = await sql<{ count: string }>`
        SELECT count(*) AS count
        FROM kerb_nodes n
        WHERE ST_Within(n.geom, ${fixtureBox})
          AND NOT EXISTS (SELECT 1 FROM sidewalks w
                           WHERE w.start_node_id = n.id OR w.end_node_id = n.id)
          AND NOT EXISTS (SELECT 1 FROM crossings c
                           WHERE c.start_node_id = n.id OR c.end_node_id = n.id)
      `.execute(trx);

      // Un cruce une dos esquinas, y las dos tienen que tener vereda: si no, el cruce
      // termina en un callejón sin salida para el ruteo (docs/11 §3.7).
      const stranded = await sql<{ count: string }>`
        SELECT count(*) AS count
        FROM crossings c
        WHERE ST_Within(c.geom, ${fixtureBox})
          AND (NOT EXISTS (SELECT 1 FROM sidewalks w
                            WHERE w.start_node_id = c.start_node_id
                               OR w.end_node_id = c.start_node_id)
            OR NOT EXISTS (SELECT 1 FROM sidewalks w
                            WHERE w.start_node_id = c.end_node_id
                               OR w.end_node_id = c.end_node_id))
      `.execute(trx);

      return { report, loose: loose.rows[0]?.count, stranded: stranded.rows[0]?.count };
    });

    expect(outcome.loose).toBe('0');
    expect(outcome.stranded).toBe('0');
    // El fixture se deriva entero: toda intersección con sus cuatro nodos y un cruce por
    // brazo, sin esquinas de más ni calles afuera (docs/11 §3.2 y §3.7).
    expect(outcome.report.warnings).toEqual([]);
  });

  describe('walkable_edges', () => {
    it('tiene una arista por vereda y por cruce, con ids que no se pisan', async () => {
      const outcome = await inRolledBackTransaction(async (trx) => {
        await importOsm(FIXTURE, trx);

        const result = await sql<{
          edges: string;
          ids: string;
          sidewalks: string;
          crossings: string;
          unsourced: string;
        }>`
          WITH edges AS (${sql.raw(fixtureEdges('wide'))})
          SELECT count(*) AS edges, count(DISTINCT id) AS ids,
                 count(*) FILTER (WHERE scope = 'sidewalk') AS sidewalks,
                 count(*) FILTER (WHERE scope = 'crossing') AS crossings,
                 count(*) FILTER (WHERE source IS NULL OR target IS NULL) AS unsourced
          FROM edges
        `.execute(trx);

        return result.rows[0];
      });

      // 29 veredas y 19 cruces del fixture: una arista cada una, y ningún id repetido
      // entre las dos tablas (docs/11 §5).
      expect(outcome?.edges).toBe('48');
      expect(outcome?.ids).toBe('48');
      expect(outcome?.sidewalks).toBe('29');
      expect(outcome?.crossings).toBe('19');
      expect(outcome?.unsourced).toBe('0');
    });

    it('devuelve un camino entre dos esquinas y no deja islas', async () => {
      const outcome = await inRolledBackTransaction(async (trx) => {
        await importOsm(FIXTURE, trx);

        // Dos esquinas a una cuadra de distancia, una de ellas sobre Avenida Ancha: el
        // camino tiene que cruzar por lo menos una calle.
        const route = await sql<{
          edges: string;
          cost: string;
          metros: string;
          cruces: string;
          llega: string;
        }>`
          WITH edges AS (${sql.raw(fixtureEdges('wide'))}),
          endpoints AS (
            SELECT (SELECT k.id FROM kerb_nodes k
                     ORDER BY k.geom <-> ST_SetSRID(ST_MakePoint(-68.8460, -32.8880), 4326)
                     LIMIT 1) AS desde,
                   (SELECT k.id FROM kerb_nodes k
                     ORDER BY k.geom <-> ST_SetSRID(ST_MakePoint(-68.8450, -32.8890), 4326)
                     LIMIT 1) AS hasta
          )
          SELECT count(*) FILTER (WHERE path.edge <> -1) AS edges,
                 round(sum(path.cost)::numeric, 1) AS cost,
                 round(ST_Length(ST_LineMerge(ST_Collect(edge.geom ORDER BY path.seq))
                        ::geography)::numeric, 1) AS metros,
                 count(*) FILTER (WHERE edge.scope = 'crossing') AS cruces,
                 (array_agg(path.node ORDER BY path.seq DESC))[1] AS llega
          FROM endpoints,
               LATERAL pgr_dijkstra(${sql.lit(fixtureEdges('narrow'))},
                                    endpoints.desde, endpoints.hasta, directed := false) path
          LEFT JOIN edges edge ON edge.id = path.edge
        `.execute(trx);

        const row = route.rows[0];
        if (row === undefined) throw new Error('la consulta de ruta no devolvió nada');

        const camino = await sql<{ components: string }>`
          SELECT count(DISTINCT component) AS components
          FROM pgr_connectedComponents(${sql.lit(fixtureEdges('narrow'))})
        `.execute(trx);

        const target = await sql<{ hasta: number }>`
          SELECT (SELECT k.id FROM kerb_nodes k
                   ORDER BY k.geom <-> ST_SetSRID(ST_MakePoint(-68.8450, -32.8890), 4326)
                   LIMIT 1) AS hasta
        `.execute(trx);

        return {
          edges: Number(row.edges),
          cost: Number(row.cost),
          metros: Number(row.metros),
          cruces: Number(row.cruces),
          llega: Number(row.llega),
          hasta: Number(target.rows[0]?.hasta),
          components: Number(camino.rows[0]?.components),
        };
      });

      expect(outcome.edges).toBeGreaterThan(0);
      expect(outcome.cruces).toBeGreaterThan(0);
      expect(outcome.cost).toBeGreaterThan(0);
      // Todo nivel está en NULL al importar y NULL se cobra como PARTIAL: el costo es el
      // doble de los metros (docs/09 §4.7).
      expect(outcome.cost).toBeCloseTo(2 * outcome.metros, 1);
      // El camino termina en la esquina pedida y el grafo del fixture es uno solo.
      expect(outcome.llega).toBe(outcome.hasta);
      expect(outcome.components).toBe(1);
    });

    it('cobra el costo con el nivel de la arista (docs/09 §4.7)', async () => {
      const outcome = await inRolledBackTransaction(async (trx) => {
        await importOsm(FIXTURE, trx);

        const picked = await sql<{ id: number; meters: number }>`
          SELECT id, ST_Length(geom::geography) AS meters
          FROM sidewalks WHERE osm_way_id BETWEEN 101 AND 114
          ORDER BY id LIMIT 1
        `.execute(trx);
        const sidewalkId = Number(picked.rows[0]?.id);
        const meters = Number(picked.rows[0]?.meters);

        const price = async () => {
          const result = await sql<{ cost: number; level: string | null; meters: number }>`
            SELECT cost, level, meters FROM walkable_edges WHERE id = ${2 * sidewalkId}
          `.execute(trx);
          return result.rows[0];
        };

        expect(await price()).toMatchObject({ level: null });
        const unknown = await price();

        await sql`UPDATE sidewalks SET accessibility_level = 'PARTIAL' WHERE id = ${sidewalkId}`.execute(trx);
        const partial = await price();

        await sql`UPDATE sidewalks SET accessibility_level = 'FULL' WHERE id = ${sidewalkId}`.execute(trx);
        const full = await price();

        await sql`UPDATE sidewalks SET accessibility_level = 'NONE' WHERE id = ${sidewalkId}`.execute(trx);
        const none = await price();

        return { meters, unknown, partial, full, none };
      });

      expect(outcome.unknown?.cost).toBeCloseTo(2 * outcome.meters, 1);
      expect(outcome.partial?.cost).toBeCloseTo(2 * outcome.meters, 1);
      expect(outcome.full?.cost).toBeCloseTo(outcome.meters, 1);
      // NONE no se filtra: se cobra -1, que es como pgRouting la saca del grafo.
      expect(outcome.none?.cost).toBe(-1);
    });

    it('suma los obstáculos activos y sólo honra el bloqueo en un nodo', async () => {
      const outcome = await inRolledBackTransaction(async (trx) => {
        await importOsm(FIXTURE, trx);

        const picked = await sql<{ id: number; meters: number; node_id: number; node_edges: number }>`
          WITH fixture_sidewalks AS (
            SELECT id, start_node_id, end_node_id, geom FROM sidewalks
            WHERE osm_way_id BETWEEN 101 AND 114
          ), fixture_nodes AS (
            SELECT start_node_id AS id FROM fixture_sidewalks
            UNION
            SELECT end_node_id FROM fixture_sidewalks
          ), grado AS (
            SELECT node.id,
                   (SELECT count(*) FROM fixture_sidewalks walk
                     WHERE walk.start_node_id = node.id OR walk.end_node_id = node.id)
                 + (SELECT count(*) FROM crossings cruce
                     WHERE cruce.start_node_id = node.id OR cruce.end_node_id = node.id)
                   AS edges
            FROM fixture_nodes node
          )
          -- La esquina con más aristas del fixture: ahí el bloqueo del cordón tiene que
          -- apagar varias aristas y la prueba dice algo.
          SELECT walk.id, ST_Length(walk.geom::geography) AS meters,
                 grado.id AS node_id, grado.edges AS node_edges
          FROM grado JOIN fixture_sidewalks walk ON grado.id IN (walk.start_node_id, walk.end_node_id)
          ORDER BY grado.edges DESC, walk.id
          LIMIT 1
        `.execute(trx);
        const sidewalkId = Number(picked.rows[0]?.id);
        const nodeId = Number(picked.rows[0]?.node_id);
        const nodeEdges = Number(picked.rows[0]?.node_edges);
        const meters = Number(picked.rows[0]?.meters);

        const price = async (): Promise<number | undefined> => {
          const result = await sql<{ cost: number }>`
            SELECT cost FROM walkable_edges WHERE id = ${2 * sidewalkId}
          `.execute(trx);
          return result.rows[0]?.cost;
        };

        const obstacle = async (severity: string, column: 'sidewalk_id' | 'kerb_node_id') => {
          const target = column === 'sidewalk_id' ? sidewalkId : nodeId;
          await sql`
            INSERT INTO obstacles (${sql.ref(column)}, type_id, severity, geom)
            SELECT ${target}, type.id, ${severity}::obstacle_severity,
                   (SELECT ST_LineInterpolatePoint(geom, 0.5) FROM sidewalks
                     WHERE id = ${sidewalkId})
            FROM obstacle_types type WHERE type.code = 'POTHOLE'
          `.execute(trx);
        };

        await obstacle('MINOR', 'sidewalk_id');
        const minor = await price();

        await obstacle('MODERATE', 'sidewalk_id');
        const moderate = await price();

        // Un obstáculo sobe la arista y no cambia los metros: son unidades distintas.
        const raised = await sql<{ meters: number }>`
          SELECT meters FROM walkable_edges WHERE id = ${2 * sidewalkId}
        `.execute(trx);

        // Un MINOR sobre un cordón no mueve el costo de las aristas que lo tocan.
        await obstacle('MINOR', 'kerb_node_id');
        const nodeMinor = await price();

        // Un CRITICAL sobre el cordón bloquea todas las aristas incidentes.
        await obstacle('CRITICAL', 'kerb_node_id');
        const blocked = await sql<{ total: string; open: string }>`
          SELECT count(*) AS total, count(*) FILTER (WHERE cost >= 0) AS open
          FROM walkable_edges
          WHERE id = ${2 * sidewalkId} OR source = ${nodeId} OR target = ${nodeId}
        `.execute(trx);

        return {
          meters,
          nodeEdges,
          minor,
          moderate,
          raisedMeters: Number(raised.rows[0]?.meters),
          nodeMinor,
          total: Number(blocked.rows[0]?.total),
          open: Number(blocked.rows[0]?.open),
        };
      });

      // NULL se cobra como PARTIAL: 2 × metros, más 15 m del MINOR y 40 m del MODERATE.
      expect(outcome.minor).toBeCloseTo(2 * outcome.meters + 15, 1);
      expect(outcome.moderate).toBeCloseTo(2 * outcome.meters + 55, 1);
      expect(outcome.raisedMeters).toBeCloseTo(outcome.meters, 1);
      expect(outcome.nodeMinor).toBeCloseTo(2 * outcome.meters + 55, 1);
      // El CRITICAL del cordón apaga todas las aristas que lo tocan, y son las que el
      // conteo por separado encontró: ninguna queda caminable.
      expect(outcome.total).toBe(outcome.nodeEdges);
      expect(outcome.open).toBe(0);
    });
  });
});
