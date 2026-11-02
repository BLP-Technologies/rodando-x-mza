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
    expect(Object.keys(document.components.schemas)).toContain('GraphFeatureCollection');
  });
});
