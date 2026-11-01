import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { sql, type Transaction } from 'kysely';
import { afterAll, describe, expect, it } from 'vitest';
import { importOsm } from '../importer/importer.run.js';
import { getDb } from './index.js';
import type { DB } from './types.js';

const PILOT_ZONE = fileURLToPath(new URL('../../../data/pilot-zone.geojson', import.meta.url));
const FIXTURE = fileURLToPath(new URL('../importer/fixtures/two-blocks.osm', import.meta.url));

/** El nombre con el que la migración siembra la red de seguridad del piloto. */
const CATCHMENT = 'Zona piloto Fase 1';

/**
 * Las Heras y Perú: un cruce del búfer del extracto, 124 m afuera del polígono del
 * piloto. El búfer de 130 m lo trae para tener las vías completas (docs/10 §3), pero
 * la red de búsqueda no llega hasta ahí (docs/10 §2).
 */
const OUTSIDE_POINT = { lon: -68.84719, lat: -32.884697 };

/**
 * Señal para que la transacción de la prueba se deshaga: Kysely no tiene un "rollback"
 * explícito, y tirar dentro de `execute` es la forma documentada de pedirlo. Así el test
 * no deja nada escrito en la base de desarrollo.
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

/**
 * Los vértices de `data/pilot-zone.geojson`, en orden.
 *
 * Se leen del archivo y no se copian acá para que el contrato sea el del repo: si el
 * polígono del piloto se mueve, se mueve con él la red de seguridad, y esta prueba lo
 * dice.
 */
async function pilotZoneCorners(): Promise<{ lon: number; lat: number }[]> {
  const raw = await readFile(PILOT_ZONE, 'utf8');
  const geojson = JSON.parse(raw) as { geometry: { coordinates: [number, number][][] } };

  const ring = geojson.geometry.coordinates[0];
  if (ring === undefined) throw new Error(`el geojson de la zona piloto no tiene anillo: ${PILOT_ZONE}`);

  // El anillo repite el primer vértice al final para cerrar: se descarta.
  return ring.slice(0, -1).map(([lon, lat]) => ({ lon, lat }));
}

// Sin base no hay qué probar: el resto de la suite es unitaria y no la necesita.
describe.skipIf(!process.env.DATABASE_URL)('service_areas contra la base', () => {
  afterAll(async () => {
    await getDb().destroy();
  });

  it('siembra una única área activa con la zona piloto, de 5 puntos', async () => {
    const outcome = await inRolledBackTransaction(async (trx) => {
      const rows = await sql<{ name: string; kind: string; points: number; valid: boolean }>`
        SELECT name,
               GeometryType(geom) AS kind,
               ST_NPoints(geom)   AS points,
               ST_IsValid(geom)   AS valid
        FROM service_areas
        WHERE is_active
      `.execute(trx);

      const area = rows.rows.find((row) => row.name === CATCHMENT);

      return { total: rows.rows.length, area };
    });

    // Una sola área activa: si hay más, la validación tendría que decidir con cuál, y
    // eso no está definido. El polígono es un anillo cerrado de 4 esquinas + el cierre.
    expect(outcome.total).toBe(1);
    expect(outcome.area?.name).toBe(CATCHMENT);
    expect(outcome.area?.kind).toBe('POLYGON');
    expect(Number(outcome.area?.points)).toBe(5);
    expect(outcome.area?.valid).toBe(true);
  });

  it('acepta las cuatro esquinas de la zona piloto', async () => {
    const corners = await pilotZoneCorners();
    const ring = corners.map(({ lon, lat }) => `(${lon} ${lat})`).join(',');
    const multipoint = `MULTIPOINT(${ring})`;

    const outcome = await inRolledBackTransaction(async (trx) => {
      const result = await sql<{ corners: number; inside: number }>`
        SELECT count(*) AS corners,
               count(*) FILTER (WHERE ST_Covers(area.geom, corner.geom)) AS inside
        FROM service_areas area,
             LATERAL ST_DumpPoints(ST_GeomFromText(${multipoint}, 4326)) corner
        WHERE area.name = ${CATCHMENT} AND area.is_active
      `.execute(trx);

      return result.rows[0];
    });

    // Las cuatro esquinas caen adentro: el perímetro de búsqueda es la zona corrida 50 m
    // hacia afuera, no la zona misma. `ST_Covers` incluye el borde, así que una esquina
    // exactamente sobre el límite también cuenta como adentro.
    expect(Number(outcome?.corners)).toBe(corners.length);
    expect(Number(outcome?.inside)).toBe(corners.length);
  });

  it('rechaza Las Heras y Perú, que está en el búfer pero afuera de la búsqueda', async () => {
    const outcome = await inRolledBackTransaction(async (trx) => {
      const result = await sql<{ covered: boolean; distance: number }>`
        SELECT ST_Covers(area.geom, ST_SetSRID(ST_MakePoint(${OUTSIDE_POINT.lon}, ${OUTSIDE_POINT.lat}), 4326)) AS covered,
               ST_Distance(area.geom::geography,
                           ST_SetSRID(ST_MakePoint(${OUTSIDE_POINT.lon}, ${OUTSIDE_POINT.lat}), 4326)::geography) AS distance
        FROM service_areas area
        WHERE area.name = ${CATCHMENT} AND area.is_active
      `.execute(trx);

      return result.rows[0];
    });

    // El punto está a 74 m del borde: 124 m afuera de la zona menos los 50 m del margen.
    // Es el caso que distingue las dos cosas que el extracto y la red de seguridad
    // miden —el extracto trae vías hasta acá, la búsqueda no acepta consultas acá— y
    // que la validación sea del punto pedido y no del nodo al que se pega.
    expect(outcome?.covered).toBe(false);
    expect(Number(outcome?.distance)).toBeGreaterThan(50);
  });

  it('cubre el grafo que se deriva adentro del piloto', async () => {
    const outcome = await inRolledBackTransaction(async (trx) => {
      // El grafo del fixture cae dentro del polígono del piloto, así que sirve para
      // comprobar la relación entre las dos piezas sin depender de que la base tenga la
      // zona piloto importada: en el CI la base sólo tiene el esquema.
      await importOsm(FIXTURE, trx);

      const result = await sql<{ nodes: number; inside: number }>`
        WITH walk AS (
          SELECT start_node_id AS id FROM sidewalks WHERE osm_way_id BETWEEN 101 AND 114
          UNION
          SELECT end_node_id FROM sidewalks WHERE osm_way_id BETWEEN 101 AND 114
        )
        SELECT count(*) AS nodes,
               count(*) FILTER (WHERE ST_Covers(area.geom, node.geom)) AS inside
        FROM walk
        JOIN kerb_nodes node ON node.id = walk.id
        CROSS JOIN service_areas area
        WHERE area.name = ${CATCHMENT} AND area.is_active
      `.execute(trx);

      return result.rows[0];
    });

    // La red de seguridad no contradice al grafo: todo lo que el importador deriva del
    // recorte chico cae adentro del perímetro de búsqueda. Con el grafo de la zona piloto
    // cargado, la misma consulta da 156 cordones adentro de 373 (docs/10 §2.1).
    expect(Number(outcome?.nodes)).toBeGreaterThan(0);
    expect(Number(outcome?.inside)).toBe(Number(outcome?.nodes));
  });
});
