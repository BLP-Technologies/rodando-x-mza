import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { getDb } from '../db/index.js';

const app = createApp();

/**
 * El endpoint del área de servicio, por HTTP.
 *
 * La lectura feliz va en el bloque de abajo, que se saltea sin base: el endpoint no tiene
 * parámetros, así que su único camino es leer y no hay nada que validar antes. Lo que sí
 * corre siempre es el contrato publicado, que se arma al importar la app.
 */
describe.skipIf(!process.env.DATABASE_URL)('GET /api/service-areas', () => {
  afterAll(async () => {
    await getDb().destroy();
  });

  it('responde la colección de áreas activas, sin parámetros', async () => {
    const res = await request(app).get('/api/service-areas');

    expect(res.status).toBe(200);

    const collection = res.body as {
      type: string;
      features: {
        type: string;
        geometry: { type: string; coordinates: [number, number][][] };
        properties: Record<string, unknown>;
      }[];
    };

    // La forma es la del campo `service_areas` del grafo: una `FeatureCollection` con
    // features `Polygon` y sólo `id` y `name` en `properties` ([14 §5.2]).
    expect(collection.type).toBe('FeatureCollection');
    expect(collection.features.length).toBeGreaterThan(0);

    for (const feature of collection.features) {
      expect(feature.type).toBe('Feature');
      expect(feature.geometry.type).toBe('Polygon');
      expect(Object.keys(feature.properties).sort()).toEqual(['id', 'name']);
      expect(feature.properties['id']).toEqual(expect.any(Number));
      expect(feature.properties['name']).toEqual(expect.any(String));

      // El orden de las coordenadas es el de GeoJSON: `[lon, lat]`. Mendoza está al oeste
      // y al sur, así que la longitud es negativa y mayor en módulo que la latitud.
      const vertex = feature.geometry.coordinates[0]?.[0];
      if (vertex === undefined) throw new Error('the service area has no vertex');
      expect(vertex[0]).toBeLessThan(0);
      expect(vertex[1]).toBeLessThan(0);
    }
  });

  it('no inventa encabezados de caché propios', async () => {
    const res = await request(app).get('/api/service-areas');

    // El MVP no resuelve caché ([14 §8]). El `ETag` que Express agrega a toda respuesta
    // JSON de la app no se revisa acá: no es de este endpoint y lo trae también el grafo.
    expect(res.headers['cache-control']).toBeUndefined();
    expect(res.headers['last-modified']).toBeUndefined();
  });
});

describe('GET /api/openapi.json', () => {
  it('publica el endpoint del área de servicio y reusa su componente', async () => {
    const res = await request(app).get('/api/openapi.json');

    expect(res.status).toBe(200);

    const document = res.body as {
      paths: Record<string, Record<string, { responses?: Record<string, unknown> }>>;
      components: { schemas: Record<string, { properties?: Record<string, unknown> }> };
    };

    expect(Object.keys(document.paths)).toContain('/api/service-areas');
    expect(document.paths['/api/service-areas']?.['get']?.responses).toHaveProperty('200');

    // El componente ya existía por la respuesta del grafo: el path nuevo lo reusa con su
    // propio id y no lo registra dos veces (docs/14 §5.2).
    expect(Object.keys(document.components.schemas)).toContain('ServiceAreaCollection');

    const collection = document.components.schemas.ServiceAreaCollection;
    expect(collection?.properties).toHaveProperty('features');
  });
});
