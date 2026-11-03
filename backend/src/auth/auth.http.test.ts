import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.js';

const app = createApp();

/**
 * Lo que se puede probar sin base: la forma de los pedidos y el rechazo de un token que
 * falta o está mal formado, que se decide antes de consultar nada.
 *
 * Los casos que necesitan cuentas y sesiones están en `auth.db.test.ts`, que se saltea si
 * no hay base configurada.
 */
describe('POST /api/auth/register', () => {
  it('marca como REQUIRED cada campo que falta', async () => {
    const res = await request(app).post('/api/auth/register').send({});

    expect(res.status).toBe(400);
    expect(res.body as unknown).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        details: [
          { field: 'name', code: 'REQUIRED' },
          { field: 'email', code: 'REQUIRED' },
          { field: 'password', code: 'REQUIRED' },
        ],
      },
    });
  });

  it('rechaza una contraseña de menos de 8 caracteres', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Ana', email: 'ana@example.com', password: '1234567' });

    expect(res.status).toBe(400);
    expect(res.body as unknown).toEqual({
      error: { code: 'VALIDATION_ERROR', details: [{ field: 'password', code: 'INVALID' }] },
    });
  });

  it('rechaza un email con formato inválido', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Ana', email: 'no-es-un-email', password: 'una-clave-larga' });

    expect(res.status).toBe(400);
    expect(res.body as unknown).toEqual({
      error: { code: 'VALIDATION_ERROR', details: [{ field: 'email', code: 'INVALID' }] },
    });
  });
});

describe('POST /api/auth/login', () => {
  it('marca como REQUIRED la contraseña que falta', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'ana@example.com' });

    expect(res.status).toBe(400);
    expect(res.body as unknown).toEqual({
      error: { code: 'VALIDATION_ERROR', details: [{ field: 'password', code: 'REQUIRED' }] },
    });
  });

  it('no devuelve texto para el usuario, sólo el código', async () => {
    const res = await request(app).post('/api/auth/login').send({});

    expect(res.status).toBe(400);
    expect(res.body as { error: Record<string, unknown> }).not.toHaveProperty('message');
  });
});

describe('rutas que exigen sesión', () => {
  it('GET /me sin token responde 401', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body as unknown).toEqual({ error: { code: 'UNAUTHENTICATED' } });
  });

  it('GET /me con un encabezado que no es Bearer responde 401', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Basic YW5hOmNsYXZl');

    expect(res.status).toBe(401);
    expect(res.body as unknown).toEqual({ error: { code: 'UNAUTHENTICATED' } });
  });

  it('POST /logout sin token responde 401', async () => {
    const res = await request(app).post('/api/auth/logout');

    expect(res.status).toBe(401);
    expect(res.body as unknown).toEqual({ error: { code: 'UNAUTHENTICATED' } });
  });
});
