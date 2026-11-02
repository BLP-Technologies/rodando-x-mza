import { fileURLToPath } from 'node:url';
import { sql, type Transaction } from 'kysely';
import { afterAll, describe, expect, it } from 'vitest';
import { getDb } from '../db/index.js';
import { inRolledBackTransaction } from '../db/test-transaction.js';
import type { DB } from '../db/types.js';
import { importOsm } from '../importer/importer.run.js';
import type { RoutePoint } from './routing.sql.js';
import { calculateRoute } from './routing.service.js';

const FIXTURE = fileURLToPath(new URL('../importer/fixtures/two-blocks.osm', import.meta.url));

/** Las Heras y Perú: en el búfer del extracto, pero afuera del perímetro de búsqueda. */
const OUTSIDE_POINT: RoutePoint = { lon: -68.84719, lat: -32.884697 };

/**
 * Un par de cordones con su vereda, lejos del fixture y adentro del piloto: una isla, que
 * es lo que hace falta para que no exista recorrido sin que el pedido esté mal.
 */
const ISLAND: [{ lon: number; lat: number }, { lon: number; lat: number }] = [
  { lon: -68.842028, lat: -32.89296 },
  { lon: -68.841028, lat: -32.89296 },
];

/** Las coordenadas de los dos extremos de una vereda del grafo, para pedir esa arista. */
async function firstSidewalk(
  trx: Transaction<DB>,
): Promise<{ origin: RoutePoint; destination: RoutePoint }> {
  const result = await sql<{ start_lon: number; start_lat: number; end_lon: number; end_lat: number }>`
    SELECT ST_X(start_node.geom) AS start_lon, ST_Y(start_node.geom) AS start_lat,
           ST_X(end_node.geom)   AS end_lon,   ST_Y(end_node.geom)   AS end_lat
    FROM sidewalks sidewalk
    JOIN kerb_nodes start_node ON start_node.id = sidewalk.start_node_id
    JOIN kerb_nodes end_node ON end_node.id = sidewalk.end_node_id
    ORDER BY sidewalk.id
    LIMIT 1
  `.execute(trx);

  const row = result.rows[0];
  if (row === undefined) throw new Error('the fixture derived no sidewalk to route over');

  return {
    origin: { lon: row.start_lon, lat: row.start_lat },
    destination: { lon: row.end_lon, lat: row.end_lat },
  };
}

/** Inserta la isla: dos cordones y la vereda que los une, sin tocar el resto del grafo. */
async function insertIsland(trx: Transaction<DB>): Promise<void> {
  await sql`
    INSERT INTO kerb_nodes (geom)
    VALUES (ST_SetSRID(ST_MakePoint(${ISLAND[0].lon}, ${ISLAND[0].lat}), 4326)),
           (ST_SetSRID(ST_MakePoint(${ISLAND[1].lon}, ${ISLAND[1].lat}), 4326))
  `.execute(trx);

  await sql`
    INSERT INTO sidewalks (start_node_id, end_node_id, geom)
    SELECT start_node.id, end_node.id,
           ST_SetSRID(ST_MakeLine(start_node.geom, end_node.geom), 4326)
    FROM kerb_nodes start_node, kerb_nodes end_node
    WHERE ST_Equals(start_node.geom, ST_SetSRID(ST_MakePoint(${ISLAND[0].lon}, ${ISLAND[0].lat}), 4326))
      AND ST_Equals(end_node.geom, ST_SetSRID(ST_MakePoint(${ISLAND[1].lon}, ${ISLAND[1].lat}), 4326))
  `.execute(trx);
}

// Sin base no hay grafo que recorrer: el resto de la suite no la necesita.
describe.skipIf(!process.env.DATABASE_URL)('calculateRoute contra la base', () => {
  afterAll(async () => {
    await getDb().destroy();
  });

  it('devuelve la vereda entre sus dos esquinas, y la cobra como PARTIAL sin relevar', async () => {
    const outcome = await inRolledBackTransaction(async (trx) => {
      await importOsm(FIXTURE, trx);

      const request = await firstSidewalk(trx);
      const route = await calculateRoute(trx, request);
      const repeated = await calculateRoute(trx, request);

      return { route, repeated };
    });

    const { route, repeated } = outcome;
    if (!route.found) throw new Error('the route between two adjacent kerbs must exist');

    // Las puntas se piden sobre los cordones mismos: no se movieron.
    expect(route.origin.distance_m).toBe(0);
    expect(route.destination.distance_m).toBe(0);

    expect(route.legs).toHaveLength(1);
    const leg = route.legs[0];
    expect(leg?.element_kind).toBe('sidewalk');
    // Nadie relevó el grafo: el nivel es `NULL` y la verificación es falsa (docs/09 §4.1).
    expect(leg?.level).toBeNull();
    expect(leg?.is_verified).toBe(false);

    // `NULL` se cobra como `PARTIAL`, o sea al doble de los metros (docs/09 §4.7). Los dos
    // números están redondeados a una décima, así que la diferencia puede llegar a 0,15.
    expect(route.summary.meters).toBe(leg?.meters);
    expect(route.summary.cost).toBeCloseTo(route.summary.meters * 2, 0);
    expect(route.summary.crossings).toBe(0);
    expect(route.summary.unverified_meters).toBe(route.summary.meters);

    // La geometría del tramo sale de la vista, en GeoJSON y con el orden [lon, lat].
    expect(leg?.geometry.type).toBe('LineString');
    expect(leg?.geometry.coordinates.length).toBeGreaterThan(1);

    // Consultar dos veces da lo mismo: el endpoint no escribe nada.
    expect(repeated).toEqual(route);
  });

  it('responde sin recorrido cuando las dos puntas están en componentes distintos', async () => {
    const outcome = await inRolledBackTransaction(async (trx) => {
      await importOsm(FIXTURE, trx);
      await insertIsland(trx);

      const origin = await firstSidewalk(trx);

      return calculateRoute(trx, { origin: origin.origin, destination: ISLAND[0] });
    });

    // No es un error: el pedido está bien y no hay camino (docs/13 §6).
    if (outcome.found) throw new Error('the island cannot be reached from the fixture');
    expect(outcome.origin.node.id).toBeGreaterThan(0);
    expect(outcome.destination.node.id).toBeGreaterThan(0);
    expect(outcome).not.toHaveProperty('summary');
    expect(outcome).not.toHaveProperty('legs');
  });

  it('devuelve un recorrido de cero metros si las dos puntas caen en el mismo cordón', async () => {
    const outcome = await inRolledBackTransaction(async (trx) => {
      await importOsm(FIXTURE, trx);

      const point = await firstSidewalk(trx);

      return calculateRoute(trx, { origin: point.origin, destination: point.origin });
    });

    if (!outcome.found) throw new Error('the same corner twice is a zero-length route');
    expect(outcome.legs).toEqual([]);
    expect(outcome.summary).toEqual({ meters: 0, cost: 0, crossings: 0, unverified_meters: 0 });
  });

  it('rechaza una punta fuera de la red de seguridad, con el campo que falló', async () => {
    await expect(
      inRolledBackTransaction((trx) =>
        calculateRoute(trx, { origin: OUTSIDE_POINT, destination: ISLAND[0] }),
      ),
    ).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
      details: [{ field: 'origin', code: 'OUTSIDE_SERVICE_AREA' }],
    });
  });
});
