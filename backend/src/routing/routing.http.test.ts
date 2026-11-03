import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.js';

const app = createApp();

/**
 * Lo que se puede probar sin base: la forma del pedido y el contrato publicado.
 *
 * Los casos que necesitan el grafo están en `routing.db.test.ts`, que se saltea si no
 * hay base configurada.
 */
describe('POST /api/routes/calculate', () => {
  it('rechaza un pedido sin destino', async () => {
    const res = await request(app)
      .post('/api/routes/calculate')
      .send({ origin: { lat: -32.889727, lon: -68.844499 } });

    expect(res.status).toBe(400);
    expect(res.body as unknown).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        details: [{ field: 'destination', code: 'REQUIRED' }],
      },
    });
  });

  it('rechaza una latitud fuera de rango con el campo que falló', async () => {
    const res = await request(app)
      .post('/api/routes/calculate')
      .send({
        origin: { lat: 91, lon: -68.844499 },
        destination: { lat: -32.89296, lon: -68.842028 },
      });

    expect(res.status).toBe(400);
    expect(res.body as unknown).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        details: [{ field: 'origin.lat', code: 'INVALID' }],
      },
    });
  });

  it('distingue un campo que falta de uno que está mal', async () => {
    const res = await request(app)
      .post('/api/routes/calculate')
      .send({
        origin: { lat: 'no es un número', lon: -68.844499 },
        destination: { lat: -32.89296, lon: -68.842028 },
      });

    // El campo está presente, así que no es `REQUIRED`: el valor no sirve.
    expect(res.status).toBe(400);
    expect(res.body as unknown).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        details: [{ field: 'origin.lat', code: 'INVALID' }],
      },
    });
  });

  it('no devuelve texto para el usuario, sólo el código', async () => {
    const res = await request(app).post('/api/routes/calculate').send({});

    expect(res.status).toBe(400);
    expect(res.body as { error: Record<string, unknown> }).not.toHaveProperty('message');
  });
});

describe('GET /api/openapi.json', () => {
  it('publica el contrato generado desde los esquemas Zod', async () => {
    const res = await request(app).get('/api/openapi.json');

    expect(res.status).toBe(200);

    const document = res.body as { openapi: string; paths: Record<string, unknown> };
    expect(document.openapi).toBe('3.1.0');
    expect(Object.keys(document.paths)).toContain('/api/routes/calculate');
  });
});
