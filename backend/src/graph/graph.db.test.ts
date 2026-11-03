import { fileURLToPath } from 'node:url';
import { sql, type Transaction } from 'kysely';
import { afterAll, describe, expect, it } from 'vitest';
import { getDb } from '../db/index.js';
import { inRolledBackTransaction } from '../db/test-transaction.js';
import type { DB } from '../db/types.js';
import { importOsm } from '../importer/importer.run.js';
import { calculateRoute } from '../routing/routing.service.js';
import type { RouteRequest } from '../routing/routing.schemas.js';
import type { BBox, GraphFeature } from './graph.schemas.js';
import { readGraph, updateGraphElement } from './graph.service.js';

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

/**
 * La primera vereda con sus dos esquinas en coordenadas, para rutear sobre ella.
 *
 * Es la evidencia del costo: el nivel se escribe sobre la arista y el ruteo entre sus
 * dos cordones lo cobra en la consulta siguiente ([09 §4.7](../../../docs/09-modelo-de-datos.md)).
 */
async function firstSidewalkToRoute(
  trx: Transaction<DB>,
): Promise<{ id: number; request: RouteRequest }> {
  const result = await sql<{
    id: number;
    start_lon: number;
    start_lat: number;
    end_lon: number;
    end_lat: number;
  }>`
    SELECT sidewalk.id,
           ST_X(start_node.geom) AS start_lon, ST_Y(start_node.geom) AS start_lat,
           ST_X(end_node.geom) AS end_lon, ST_Y(end_node.geom) AS end_lat
    FROM sidewalks sidewalk
    JOIN kerb_nodes start_node ON start_node.id = sidewalk.start_node_id
    JOIN kerb_nodes end_node ON end_node.id = sidewalk.end_node_id
    ORDER BY sidewalk.id
    LIMIT 1
  `.execute(trx);

  const row = result.rows[0];
  if (row === undefined) throw new Error('the fixture derived no sidewalk to route over');

  return {
    id: row.id,
    request: {
      origin: { lon: row.start_lon, lat: row.start_lat },
      destination: { lon: row.end_lon, lat: row.end_lat },
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

/**
 * Un polígono chico y válido adentro del piloto, con el anillo cerrado.
 *
 * El anillo repite el primer vértice al final porque un `POLYGON` de PostGIS que no
 * cierra es inválido, y el contrato de la respuesta no tiene cómo representarlo.
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
 * Un `id` que existe como cordón y seguro no como vereda.
 *
 * Se construye y no se busca: los `id` de cada tabla salen de su propia secuencia, así
 * que en una base con el piloto importado los números se pisan y en una recién migrada
 * no. Tomar el `id` de la primera vereda daba por sentado que ese número no era cordón,
 * y en la base de desarrollo lo es (329 veredas contra 378 cordones), así que el test
 * pasaba o fallaba según los datos. Acá el cordón se inserta por encima de todas las
 * veredas, así que el número existe como cordón y no puede existir como vereda.
 */
async function insertKerbAboveSidewalks(trx: Transaction<DB>): Promise<number> {
  const result = await sql<{ id: number }>`
    INSERT INTO kerb_nodes (id, geom) OVERRIDING SYSTEM VALUE
    SELECT greatest(coalesce((SELECT max(id) FROM kerb_nodes), 0),
                    coalesce((SELECT max(id) FROM sidewalks), 0)) + 1,
           ST_SetSRID(ST_MakePoint(-68.81, -32.91), 4326)
    RETURNING id
  `.execute(trx);

  const row = result.rows[0];
  if (row === undefined) throw new Error('the kerb above the sidewalks could not be inserted');

  return row.id;
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

  it('escribe el nivel y deja el elemento verificado', async () => {
    const outcome = await inRolledBackTransaction(async (trx) => {
      await importOsm(FIXTURE, trx);

      const area = await firstSidewalkArea(trx);
      const updated = await updateGraphElement(trx, 'sidewalk', area.id, 'PARTIAL');
      const graph = await readGraph(trx, area.bbox);

      return { area, updated, graph };
    });

    // La respuesta alcanza para repintar la feature sin volver a pedir el área.
    expect(outcome.updated.properties.element_kind).toBe('sidewalk');
    expect(outcome.updated.properties.element_id).toBe(outcome.area.id);
    expect(outcome.updated.properties.level).toBe('PARTIAL');
    expect(outcome.updated.properties.is_verified).toBe(true);

    // Y la lectura siguiente lo dice lo mismo: el `RETURNING` y la vista coinciden.
    const feature = outcome.graph.features.find(
      (candidate) =>
        candidate.properties.element_kind === 'sidewalk' &&
        candidate.properties.element_id === outcome.area.id,
    );
    expect(feature?.properties.level).toBe('PARTIAL');
    expect(feature?.properties.is_verified).toBe(true);
  });

  it('vuelve a "sin dato" y desmarca la verificación', async () => {
    const updated = await inRolledBackTransaction(async (trx) => {
      await importOsm(FIXTURE, trx);

      const area = await firstSidewalkArea(trx);
      await updateGraphElement(trx, 'sidewalk', area.id, 'NONE');

      return updateGraphElement(trx, 'sidewalk', area.id, null);
    });

    // `null` es "sin dato", y sin nivel no hay valor confirmado: el elemento queda
    // como recién importado y el relevamiento lo puede completar (docs/12 §8.2).
    expect(updated.properties.level).toBeNull();
    expect(updated.properties.is_verified).toBe(false);
  });

  it('cambia el costo de la arista en la siguiente consulta, sin recalcular nada', async () => {
    const outcome = await inRolledBackTransaction(async (trx) => {
      await importOsm(FIXTURE, trx);

      const sidewalk = await firstSidewalkToRoute(trx);
      const sinRelevar = await calculateRoute(trx, sidewalk.request);

      await updateGraphElement(trx, 'sidewalk', sidewalk.id, 'FULL');
      const accesible = await calculateRoute(trx, sidewalk.request);

      await updateGraphElement(trx, 'sidewalk', sidewalk.id, 'NONE');
      const bloqueada = await calculateRoute(trx, sidewalk.request);

      return { sidewalk, sinRelevar, accesible, bloqueada };
    });

    const { sidewalk, sinRelevar, accesible, bloqueada } = outcome;
    if (!sinRelevar.found || !accesible.found) {
      throw new Error('the route between two adjacent kerbs must exist');
    }

    // `NULL` se cobra como `PARTIAL`: al doble de los metros (docs/09 §4.7).
    expect(sinRelevar.summary.cost).toBeCloseTo(sinRelevar.summary.meters * 2, 0);
    expect(sinRelevar.legs[0]?.is_verified).toBe(false);

    // `FULL` se cobra uno a uno, y el tramo queda verificado por la misma escritura.
    expect(accesible.summary.cost).toBeCloseTo(accesible.summary.meters, 0);
    expect(accesible.legs[0]?.is_verified).toBe(true);
    expect(accesible.legs[0]?.level).toBe('FULL');

    // `NONE` saca la arista del grafo: el recorrido puede existir bordeándola, pero
    // nunca pasa por ella.
    expect(
      bloqueada.found
        ? bloqueada.legs.every(
            (leg) =>
              !(leg.element_kind === 'sidewalk' && leg.element_id === sidewalk.id),
          )
        : true,
    ).toBe(true);
  });

  it('responde NOT_FOUND para un elemento que no existe', async () => {
    const error = await inRolledBackTransaction(async (trx) => {
      await importOsm(FIXTURE, trx);

      return updateGraphElement(trx, 'kerb', 999999, 'FULL').catch(
        (thrown: unknown) => thrown,
      );
    });

    expect(error).toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });

  it('responde NOT_FOUND cuando el id existe en otra clase de elemento', async () => {
    const error = await inRolledBackTransaction(async (trx) => {
      await importOsm(FIXTURE, trx);

      // Ese id es de un cordón: como vereda no existe, y para quien pregunta el elemento
      // tampoco, sin importar que el número esté en la tabla de al lado ([14 §7]).
      const kerbId = await insertKerbAboveSidewalks(trx);

      return updateGraphElement(trx, 'sidewalk', kerbId, 'FULL').catch(
        (thrown: unknown) => thrown,
      );
    });

    expect(error).toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });

  it('devuelve el área de servicio activa como polígono cerrado', async () => {
    const graph = await inRolledBackTransaction(async (trx) => {
      await importOsm(FIXTURE, trx);

      return readGraph(trx, await graphExtent(trx));
    });

    const area = graph.service_areas.features.find(
      (candidate) => candidate.properties.name === 'Zona piloto Fase 1',
    );
    if (area === undefined) throw new Error('the active service area is missing');

    // El área viaja con su `id` como clave estable y con su nombre (docs/09 §4.8).
    expect(area.properties.id).toBeGreaterThan(0);
    expect(area.geometry.type).toBe('Polygon');

    // El anillo exterior está cerrado: el primer vértice y el último son el mismo.
    const ring = area.geometry.coordinates[0];
    if (ring === undefined) throw new Error('the service area has no outer ring');
    expect(ring.length).toBeGreaterThan(3);
    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });

  it('filtra por is_active y no por id', async () => {
    const graph = await inRolledBackTransaction(async (trx) => {
      await importOsm(FIXTURE, trx);

      // Dos áreas nuevas: el filtro no puede depender de cuál es la fila sembrada.
      await insertServiceArea(trx, 'Zona de prueba activa', true);
      await insertServiceArea(trx, 'Zona de prueba inactiva', false);

      return readGraph(trx, await graphExtent(trx));
    });

    const names = graph.service_areas.features.map((area) => area.properties.name);
    expect(names).toContain('Zona de prueba activa');
    expect(names).not.toContain('Zona de prueba inactiva');

    // La sembrada por la migración sigue estando: activar otra no reemplaza a la primera.
    expect(names).toContain('Zona piloto Fase 1');
  });

  it('devuelve el área aunque el bbox no toque el grafo', async () => {
    const graph = await inRolledBackTransaction(async (trx) => {
      await importOsm(FIXTURE, trx);

      return readGraph(trx, EMPTY_BBOX);
    });

    // El área es el contexto de la zona y no un elemento del área pedida: no se filtra
    // por bbox (docs/14 §5.2).
    expect(graph.features).toEqual([]);
    expect(
      graph.service_areas.features.map((area) => area.properties.name),
    ).toContain('Zona piloto Fase 1');
  });

  it('no consume el tope de 2000 features', async () => {
    const graph = await inRolledBackTransaction(async (trx) => {
      await importOsm(FIXTURE, trx);
      await insertKerbFlood(trx);

      return readGraph(trx, FLOOD.bbox);
    });

    // El tope es de `features` y el área viaja afuera: aun recortado, el mapa tiene el
    // borde de la zona.
    expect(graph.truncated).toBe(true);
    expect(graph.features).toHaveLength(2000);
    expect(
      graph.service_areas.features.map((area) => area.properties.name),
    ).toContain('Zona piloto Fase 1');
  });

  it('devuelve una colección de áreas vacía si no hay ninguna activa', async () => {
    const graph = await inRolledBackTransaction(async (trx) => {
      await importOsm(FIXTURE, trx);

      // Una base sin área activa no rompe la lectura: el ruteo sí la necesita (docs/13).
      await sql`UPDATE service_areas SET is_active = false`.execute(trx);

      return readGraph(trx, await graphExtent(trx));
    });

    expect(graph.service_areas).toEqual({ type: 'FeatureCollection', features: [] });
    expect(graph.features.length).toBeGreaterThan(0);
  });
});
