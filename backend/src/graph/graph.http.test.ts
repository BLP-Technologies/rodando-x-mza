import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.js';

const app = createApp();

/**
 * Lo que se puede probar sin base: la forma del `bbox` y el contrato publicado.
 *
 * Los casos que necesitan el grafo están en `graph.db.test.ts`, que se saltea si no hay
 * base configurada.
 */
describe('GET /api/graph', () => {
  it('rechaza un pedido sin bbox', async () => {
    const res = await request(app).get('/api/graph');

    expect(res.status).toBe(400);
    expect(res.body as unknown).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        details: [{ field: 'bbox', code: 'REQUIRED' }],
      },
    });
  });

  it('rechaza un bbox con menos de cuatro números', async () => {
    const res = await request(app).get('/api/graph').query({ bbox: '-68.8444,-32.8897,-68.8443' });

    expect(res.status).toBe(400);
    expect(res.body as unknown).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        details: [{ field: 'bbox', code: 'INVALID' }],
      },
    });
  });

  it('rechaza un bbox con las esquinas invertidas', async () => {
    // El oeste quedó al este del este: es un bbox que no encierra ningún área.
    const res = await request(app).get('/api/graph').query({ bbox: '-68.8443,-32.8897,-68.8444,-32.8898' });

    expect(res.status).toBe(400);
    expect(res.body as unknown).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        details: [{ field: 'bbox', code: 'INVALID' }],
      },
    });
  });

  it('rechaza una coordenada fuera de rango', async () => {
    const res = await request(app).get('/api/graph').query({ bbox: '-68.8444,-32.8897,-68.8443,-91' });

    expect(res.status).toBe(400);
    expect(res.body as unknown).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        details: [{ field: 'bbox', code: 'INVALID' }],
      },
    });
  });

  it('rechaza un bbox que no son números', async () => {
    const res = await request(app).get('/api/graph').query({ bbox: 'a,b,c,d' });

    expect(res.status).toBe(400);
    expect(res.body as unknown).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        details: [{ field: 'bbox', code: 'INVALID' }],
      },
    });
  });
});

describe('GET /api/openapi.json', () => {
  it('publica el contrato del grafo generado desde los esquemas Zod', async () => {
    const res = await request(app).get('/api/openapi.json');

    expect(res.status).toBe(200);

    const document = res.body as {
      paths: Record<string, unknown>;
      components: { schemas: Record<string, unknown> };
    };
    expect(Object.keys(document.paths)).toContain('/api/graph');
    expect(Object.keys(document.paths)).toContain('/api/graph/elements/{kind}/{id}');
    expect(Object.keys(document.components.schemas)).toContain('GraphFeatureCollection');
    // El elemento tiene nombre propio porque es la respuesta del PATCH y la feature de
    // la colección: un solo componente para las dos caras (docs/14 §7).
    expect(Object.keys(document.components.schemas)).toContain('GraphElement');
  });

  it('publica las áreas de servicio como componente propio de la respuesta', async () => {
    const res = await request(app).get('/api/openapi.json');

    expect(res.status).toBe(200);

    const document = res.body as {
      components: { schemas: Record<string, { properties?: Record<string, unknown> }> };
    };

    // El área tiene nombre propio por el mismo mecanismo que `GraphElement`: el cliente
    // necesita el tipo del conjunto, no un objeto anidado anónimo (docs/14 §5.2).
    expect(Object.keys(document.components.schemas)).toContain('ServiceAreaCollection');

    const collection = document.components.schemas.GraphFeatureCollection;
    expect(collection?.properties).toHaveProperty('service_areas');
  });
});

describe('PATCH /api/graph/elements/:kind/:id', () => {
  // Todos estos casos fallan en la validación, así que no tocan la base.
  const patch = (path: string, body?: unknown) =>
    request(app)
      .patch(path)
      .set('content-type', 'application/json')
      .send(body as string);

  it('rechaza un cuerpo sin `level`: no hay "no toques nada"', async () => {
    const res = await patch('/api/graph/elements/sidewalk/1', {});

    expect(res.status).toBe(400);
    expect(res.body as unknown).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        details: [{ field: 'level', code: 'REQUIRED' }],
      },
    });
  });

  it('rechaza un nivel que no es del enum', async () => {
    const res = await patch('/api/graph/elements/sidewalk/1', { level: 'ACCESIBLE' });

    expect(res.status).toBe(400);
    expect(res.body as unknown).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        details: [{ field: 'level', code: 'INVALID' }],
      },
    });
  });

  it('rechaza `is_verified` en el cuerpo, y lo nombra', async () => {
    const res = await patch('/api/graph/elements/sidewalk/1', {
      level: 'NONE',
      is_verified: true,
    });

    // El servidor decide la verificación; un campo de más es un error, no algo que
    // se ignore en silencio (docs/14 §7).
    expect(res.status).toBe(400);
    expect(res.body as unknown).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        details: [{ field: 'is_verified', code: 'INVALID' }],
      },
    });
  });

  it('rechaza una clase de elemento que no existe', async () => {
    const res = await patch('/api/graph/elements/street/1', { level: 'NONE' });

    expect(res.status).toBe(400);
    expect(res.body as unknown).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        details: [{ field: 'kind', code: 'INVALID' }],
      },
    });
  });

  it('rechaza un id que no es un entero positivo', async () => {
    const res = await patch('/api/graph/elements/kerb/abc', { level: 'FULL' });

    expect(res.status).toBe(400);
    expect(res.body as unknown).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        details: [{ field: 'id', code: 'INVALID' }],
      },
    });
  });
});
