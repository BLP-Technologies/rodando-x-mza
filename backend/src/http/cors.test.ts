import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { PREFLIGHT_MAX_AGE_SECONDS } from './cors.js';

const PORTAL_ORIGIN = 'http://localhost:3000';

/** Encabezados CORS de una respuesta, para afirmar que no hay ninguno. */
function corsHeaders(res: request.Response): string[] {
  return Object.keys(res.headers).filter((name) => name.startsWith('access-control-'));
}

describe('cors', () => {
  const app = createApp({ corsOrigins: [PORTAL_ORIGIN] });

  it('responde el origen exacto y Vary: Origin cuando está en la allowlist', async () => {
    const res = await request(app).get('/api/health').set('Origin', PORTAL_ORIGIN);

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe(PORTAL_ORIGIN);
    expect(res.headers.vary).toBe('Origin');
  });

  it('no emite ningún encabezado CORS para un origen fuera de la allowlist', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'http://evil.example');

    // El pedido sigue su curso: la respuesta es la normal, no un 403.
    expect(res.status).toBe(200);
    expect(res.body as unknown).toEqual({ status: 'ok' });
    expect(corsHeaders(res)).toEqual([]);
  });

  it('responde el preflight con 204, métodos y encabezados permitidos', async () => {
    const res = await request(app)
      .options('/api/routes/calculate')
      .set('Origin', PORTAL_ORIGIN)
      .set('Access-Control-Request-Method', 'POST');

    expect(res.status).toBe(204);
    expect(res.text).toBe('');
    expect(res.headers['access-control-allow-origin']).toBe(PORTAL_ORIGIN);
    expect(res.headers['access-control-allow-methods']).toBe('GET, POST, OPTIONS');
    expect(res.headers['access-control-allow-headers']).toBe('Content-Type');
    expect(res.headers['access-control-max-age']).toBe(String(PREFLIGHT_MAX_AGE_SECONDS));
  });

  it('no emite encabezados en el preflight de un origen fuera de la allowlist', async () => {
    const res = await request(app)
      .options('/api/routes/calculate')
      .set('Origin', 'http://evil.example')
      .set('Access-Control-Request-Method', 'POST');

    // Sin CORS, el OPTIONS es un pedido cualquiera: lo resuelve el router, que
    // responde 200 con `Allow` y sin ningún encabezado de CORS.
    expect(res.status).toBe(200);
    expect(corsHeaders(res)).toEqual([]);
  });

  it('no cambia la respuesta de un pedido sin Origin', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body as unknown).toEqual({ status: 'ok' });
    expect(corsHeaders(res)).toEqual([]);
  });

  it('no emite nada con la allowlist vacía', async () => {
    const res = await request(createApp()).get('/api/health').set('Origin', PORTAL_ORIGIN);

    expect(res.status).toBe(200);
    expect(corsHeaders(res)).toEqual([]);
  });

  it('matchea una entrada con barra final o en mayúsculas', async () => {
    const app = createApp({ corsOrigins: ['HTTP://LocalHost:3000/'] });

    const res = await request(app).get('/api/health').set('Origin', PORTAL_ORIGIN);

    expect(res.headers['access-control-allow-origin']).toBe(PORTAL_ORIGIN);
  });

  it('no emite el preflight cuando el pedido no trae Origin', async () => {
    const res = await request(app).options('/api/routes/calculate');

    expect(res.status).toBe(200);
    expect(corsHeaders(res)).toEqual([]);
  });
});
