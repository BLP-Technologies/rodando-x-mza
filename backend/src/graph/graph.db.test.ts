import { fileURLToPath } from 'node:url';
import { sql, type Transaction } from 'kysely';
import { afterAll, describe, expect, it } from 'vitest';
import { getDb } from '../db/index.js';
import { inRolledBackTransaction } from '../db/test-transaction.js';
import type { DB } from '../db/types.js';
import { importOsm } from '../importer/importer.run.js';
import type { BBox, GraphFeature } from './graph.schemas.js';
import { readGraph } from './graph.service.js';

const FIXTURE = fileURLToPath(new URL('../importer/fixtures/two-blocks.osm', import.meta.url));

/** Un área que no toca el grafo de Mendoza: ni el fixture ni el piloto llegan ahí. */
const EMPTY_BBOX: BBox = { minLon: -100, minLat: 0, maxLon: -99.99, maxLat: 0.01 };

/**
 * Una cuadrícula de cordones, uno al lado del otro, más que el tope de la respuesta.
 *
 * Va lejos de todo, así que el área que la encierra no tiene otro elemento que compita por
 * los 2000 lugares.
 */
const FLOOD = {
  count: 2100,
  bbox: { minLon: -68.9001, minLat: -32.9001, maxLon: -68.8989, maxLat: -32.8997 },
};

/**
 * El área que encierra lo que haya en el grafo, sea el fixture solo o el piloto cargado.
 *
 * Los tests corren dentro de una transacción que se deshace, así que la base puede tener
 * más filas que las del fixture; el extent de las tres tablas sirve en los dos casos.
 */
async function graphExtent(trx: Transaction<DB>): Promise<BBox> {
  const result = await sql<{
    min_lon: number;
    min_lat: number;
    max_lon: number;
    max_lat: number;
  }>`
    SELECT ST_XMin(extent) AS min_lon, ST_YMin(extent) AS min_lat,
           ST_XMax(extent) AS max_lon, ST_YMax(extent) AS max_lat
    FROM (SELECT ST_Extent(geom) AS extent
          FROM (SELECT geom FROM sidewalks
                UNION ALL SELECT geom FROM crossings
                UNION ALL SELECT geom FROM kerb_nodes) elements) box
  `.execute(trx);

  const row = result.rows[0];
  if (row === undefined) throw new Error('the graph has no elements to bound');

  return { minLon: row.min_lon, minLat: row.min_lat, maxLon: row.max_lon, maxLat: row.max_lat };
}

/**
 * El bbox de una sola vereda, con su `id`, para pedirla sin arrastrar el resto del grafo.
 *
 * El área es la del segmento, pero por el borde pasan los dos cordones que lo cierran: es
 * la intersección del operador `&&`, y no hace falta achicarla.
 */
async function firstSidewalkArea(
  trx: Transaction<DB>,
): Promise<{ id: number; bbox: BBox }> {
  const result = await sql<{
    id: number;
    min_lon: number;
    min_lat: number;
    max_lon: number;
    max_lat: number;
  }>`
    SELECT sidewalk.id,
           ST_XMin(ST_Extent(sidewalk.geom)) AS min_lon,
           ST_YMin(ST_Extent(sidewalk.geom)) AS min_lat,
           ST_XMax(ST_Extent(sidewalk.geom)) AS max_lon,
           ST_YMax(ST_Extent(sidewalk.geom)) AS max_lat
    FROM sidewalks sidewalk
    GROUP BY sidewalk.id
    ORDER BY sidewalk.id
    LIMIT 1
  `.execute(trx);

  const row = result.rows[0];
  if (row === undefined) throw new Error('the fixture derived no sidewalk to read');

  return {
    id: row.id,
    bbox: {
      minLon: row.min_lon,
      minLat: row.min_lat,
      maxLon: row.max_lon,
      maxLat: row.max_lat,
    },
  };
}

function kindsOf(features: readonly GraphFeature[]): string[] {
  return [...new Set(features.map((feature) => feature.properties.element_kind))].sort();
}

/** Inserta `FLOOD.count` cordones en una cuadrícula, sin tocar el resto del grafo. */
async function insertKerbFlood(trx: Transaction<DB>): Promise<void> {
  await sql`
    INSERT INTO kerb_nodes (geom)
    SELECT ST_SetSRID(
             ST_MakePoint(-68.9 + (i % 100) * 0.00001, -32.9 + (i / 100) * 0.00001),
             4326)
    FROM generate_series(1, ${FLOOD.count}) AS i
  `.execute(trx);
}

// Sin base no hay grafo que leer: el resto de la suite no la necesita.
describe.skipIf(!process.env.DATABASE_URL)('readGraph contra la base', () => {
  afterAll(async () => {
    await getDb().destroy();
  });

  it('devuelve una vereda del área, con el nivel que nadie relevó', async () => {
    const outcome = await inRolledBackTransaction(async (trx) => {
      await importOsm(FIXTURE, trx);

      const area = await firstSidewalkArea(trx);
      const graph = await readGraph(trx, area.bbox);

      return { area, graph };
    });

    expect(outcome.graph.type).toBe('FeatureCollection');
    expect(outcome.graph.truncated).toBe(false);

    const feature = outcome.graph.features.find(
      (candidate) =>
        candidate.properties.element_kind === 'sidewalk' &&
        candidate.properties.element_id === outcome.area.id,
    );
    if (feature === undefined) throw new Error('the sidewalk of the area is missing');

    // Nadie relevó el grafo: el nivel es `NULL` y la verificación es falsa (docs/09 §4.1).
    expect(feature.properties.level).toBeNull();
    expect(feature.properties.is_verified).toBe(false);

    // La geometría es la de la base, en GeoJSON y con el orden [lon, lat].
    expect(feature.geometry.type).toBe('LineString');
    expect(feature.geometry.coordinates.length).toBeGreaterThan(1);
  });

  it('devuelve las tres clases de elemento del grafo', async () => {
    const graph = await inRolledBackTransaction(async (trx) => {
      await importOsm(FIXTURE, trx);

      return readGraph(trx, await graphExtent(trx));
    });

    expect(kindsOf(graph.features)).toEqual(['crossing', 'kerb', 'sidewalk']);

    // Los cordones son puntos; veredas y cruces, líneas.
    for (const feature of graph.features) {
      const expected = feature.properties.element_kind === 'kerb' ? 'Point' : 'LineString';
      expect(feature.geometry.type).toBe(expected);
    }
  });

  it('devuelve una colección vacía si el área no toca el grafo', async () => {
    const graph = await inRolledBackTransaction(async (trx) => {
      await importOsm(FIXTURE, trx);

      return readGraph(trx, EMPTY_BBOX);
    });

    // El área no tiene grafo, y eso no es un error: es una colección vacía (docs/14 §5).
    expect(graph.features).toEqual([]);
    expect(graph.truncated).toBe(false);
  });

  it('recorta en el tope y lo avisa en vez de mentir sobre el área', async () => {
    const graph = await inRolledBackTransaction(async (trx) => {
      await importOsm(FIXTURE, trx);
      await insertKerbFlood(trx);

      return readGraph(trx, FLOOD.bbox);
    });

    expect(graph.features).toHaveLength(2000);
    expect(graph.truncated).toBe(true);
    expect(kindsOf(graph.features)).toEqual(['kerb']);
  });
});
