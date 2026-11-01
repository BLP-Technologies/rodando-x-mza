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
    // esquinas por intersección más dos cordones por cada extremo de borde.
    expect(outcome.first.junctions).toEqual({ cross: 4, tee: 1, unsupported: 0 });
    expect(outcome.first.sidewalks.boca).toBe(1);
    expect(outcome.first.sidewalks.created + outcome.first.sidewalks.updated).toBe(29);
    expect(outcome.first.kerbs.created + outcome.first.kerbs.reused).toBe(38);

    // La segunda no crea nada: reconoce todo por coordenada y por par de nodos.
    expect(outcome.second.kerbs.created).toBe(0);
    expect(outcome.second.sidewalks.created).toBe(0);
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
});
