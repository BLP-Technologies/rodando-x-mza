import { fileURLToPath } from 'node:url';
import { sql, type Transaction } from 'kysely';
import { afterAll, describe, expect, it } from 'vitest';
import { getDb } from '../db/index.js';
import { inRolledBackTransaction } from '../db/test-transaction.js';
import type { DB } from '../db/types.js';
import { readGraph } from '../graph/graph.service.js';
import { importOsm } from '../importer/importer.run.js';
import { readServiceAreas } from './service-areas.service.js';

const FIXTURE = fileURLToPath(new URL('../importer/fixtures/two-blocks.osm', import.meta.url));

/**
 * Un polígono chico y válido, con el anillo cerrado.
 *
 * El anillo repite el primer vértice al final porque un `POLYGON` de PostGIS que no cierra
 * es inválido, y el contrato de la respuesta no tiene cómo representarlo.
 */
const AREA_WKT =
  'POLYGON((-68.8450 -32.8900,-68.8440 -32.8900,-68.8440 -32.8910,-68.8450 -32.8910,-68.8450 -32.8900))';

/** Inserta un área de servicio con nombre propio, activa o no, dentro de la transacción. */
async function insertServiceArea(
  trx: Transaction<DB>,
  name: string,
  isActive: boolean,
): Promise<void> {
  await sql`
    INSERT INTO service_areas (name, geom, is_active)
    VALUES (${name}, ST_GeomFromText(${AREA_WKT}, 4326), ${isActive})
  `.execute(trx);
}

/**
 * El área que encierra lo que haya en el grafo, sea el fixture solo o el piloto cargado.
 *
 * Los tests corren dentro de una transacción que se deshace, así que la base puede tener
 * más filas que las del fixture; el extent de las tres tablas sirve en los dos casos.
 */
async function graphExtent(trx: Transaction<DB>): Promise<{
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}> {
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

// Sin base no hay área que leer: el resto de la suite no la necesita.
describe.skipIf(!process.env.DATABASE_URL)('readServiceAreas contra la base', () => {
  afterAll(async () => {
    await getDb().destroy();
  });

  it('devuelve lo mismo que el campo `service_areas` del grafo', async () => {
    const outcome = await inRolledBackTransaction(async (trx) => {
      await importOsm(FIXTURE, trx);

      // Dos áreas más: el filtro por `is_active` y el orden tienen que coincidir en las
      // dos respuestas, no sólo el caso de una fila sembrada.
      await insertServiceArea(trx, 'Zona de prueba activa', true);
      await insertServiceArea(trx, 'Zona de prueba inactiva', false);

      const bbox = await graphExtent(trx);

      return {
        graph: await readGraph(trx, bbox),
        serviceAreas: await readServiceAreas(trx),
      };
    });

    // Es el test que impide que las dos respuestas se separen: el endpoint propio y el
    // campo del grafo salen de la misma función, así que la comparación es exacta, orden
    // de features y de claves incluido (docs/14 §5.2).
    expect(outcome.serviceAreas).toEqual(outcome.graph.service_areas);
    expect(JSON.stringify(outcome.serviceAreas)).toBe(
      JSON.stringify(outcome.graph.service_areas),
    );

    // Y no son dos áreas vacías iguales: la activa está y la inactiva no.
    const names = outcome.serviceAreas.features.map((area) => area.properties.name);
    expect(names).toContain('Zona de prueba activa');
    expect(names).not.toContain('Zona de prueba inactiva');
    expect(names).toContain('Zona piloto Fase 1');
  });

  it('devuelve una colección vacía si no hay área activa', async () => {
    const serviceAreas = await inRolledBackTransaction(async (trx) => {
      await importOsm(FIXTURE, trx);

      // Una base sin área activa no rompe la lectura: no es un error (docs/14 §5.2).
      await sql`UPDATE service_areas SET is_active = false`.execute(trx);

      return readServiceAreas(trx);
    });

    expect(serviceAreas).toEqual({ type: 'FeatureCollection', features: [] });
  });
});
