import express, { type RequestHandler } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { errorHandler, notFound } from './http/error-handler.js';
import { HttpError } from './http/errors.js';

const app = createApp();

describe('app', () => {
  it('responde ok en /api/health', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body as unknown).toEqual({ status: 'ok' });
  });

  it('devuelve 404 con código para una ruta desconocida', async () => {
    const res = await request(app).get('/api/no-existe');

    expect(res.status).toBe(404);
    expect(res.body as unknown).toEqual({ error: { code: 'NOT_FOUND' } });
  });
});

/** App mínima con una ruta que lanza, para probar el errorHandler en aislamiento. */
function appThrowing(handler: RequestHandler) {
  const app = express();
  app.get('/boom', handler);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

describe('errorHandler', () => {
  it('devuelve code y details de un error esperado', async () => {
    const res = await request(
      appThrowing(() => {
        throw new HttpError(400, 'VALIDATION_ERROR', 'invalid input', [
          { field: 'email', code: 'INVALID_EMAIL' },
        ]);
      }),
    ).get('/boom');

    expect(res.status).toBe(400);
    expect(res.body as unknown).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        details: [{ field: 'email', code: 'INVALID_EMAIL' }],
      },
    });
  });

  it('generaliza un error no esperado sin filtrar el mensaje interno', async () => {
    const res = await request(
      appThrowing(() => {
        throw new Error('detalle interno que no debe salir');
      }),
    ).get('/boom');

    expect(res.status).toBe(500);
    expect(res.body as unknown).toEqual({ error: { code: 'INTERNAL_ERROR' } });
  });

  it('generaliza un HttpError con status >= 500', async () => {
    const res = await request(
      appThrowing(() => {
        throw new HttpError(500, 'INTERNAL_ERROR', 'database connection failed');
      }),
    ).get('/boom');

    expect(res.status).toBe(500);
    expect(res.body as unknown).toEqual({ error: { code: 'INTERNAL_ERROR' } });
  });
});
