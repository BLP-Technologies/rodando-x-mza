import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.js';

const app = createApp();

/**
 * La página de docs y el contrato que consume. Sin base: no tocan el grafo.
 *
 * No se prueba la UI en el navegador; sí que el backend sirva el HTML, el bundle que
 * necesita la página y el documento que la página pide.
 */
describe('GET /api/docs', () => {
  it('sirve el HTML de la página', async () => {
    const res = await request(app).get('/api/docs');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.text).toContain('SwaggerUIBundle');
    // La página se arma sola: no depende de un CDN para mostrarse.
    expect(res.text).not.toMatch(/https?:\/\//);
  });

  it('sirve la UI desde el propio backend', async () => {
    const res = await request(app).get('/api/docs/swagger-ui-bundle.js');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('javascript');
  });

  it('publica el contrato que consume la página, con el path de ruteo', async () => {
    const res = await request(app).get('/api/openapi.json');

    expect(res.status).toBe(200);

    const document = res.body as { openapi: string; paths: Record<string, unknown> };
    expect(document.openapi).toBe('3.1.0');
    expect(Object.keys(document.paths)).toContain('/api/routes/calculate');
  });
});
