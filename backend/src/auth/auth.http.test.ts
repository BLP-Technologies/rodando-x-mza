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

describe('GET /api/openapi.json', () => {
  it('publica los cuatro endpoints del auth y sus componentes', async () => {
    const res = await request(app).get('/api/openapi.json');

    expect(res.status).toBe(200);

    const document = res.body as {
      paths: Record<string, Record<string, { responses?: Record<string, unknown> }>>;
      components: { schemas: Record<string, unknown> };
    };

    // El contrato se lee, no se transcribe: si un path no está acá, el cliente no lo
    // puede generar (docs/15 §2).
    expect(document.paths['/api/auth/register']).toHaveProperty('post');
    expect(document.paths['/api/auth/login']).toHaveProperty('post');
    expect(document.paths['/api/auth/me']).toHaveProperty('get');
    expect(document.paths['/api/auth/logout']).toHaveProperty('post');

    // Los estados que el cliente tiene que saber tratar: el alta choca con un email
    // repetido y los endpoints con token rechazan la sesión que no sirve.
    expect(document.paths['/api/auth/register']?.['post']?.responses).toHaveProperty('201');
    expect(document.paths['/api/auth/register']?.['post']?.responses).toHaveProperty('409');
    expect(document.paths['/api/auth/login']?.['post']?.responses).toHaveProperty('401');
    expect(document.paths['/api/auth/me']?.['get']?.responses).toHaveProperty('401');
    expect(document.paths['/api/auth/logout']?.['post']?.responses).toHaveProperty('204');

    for (const name of ['RegisterRequest', 'LoginRequest', 'User', 'UserResponse', 'LoginResponse']) {
      expect(Object.keys(document.components.schemas)).toContain(name);
    }
  });
});
