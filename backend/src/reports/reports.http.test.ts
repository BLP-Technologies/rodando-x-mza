import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';

const app = createApp();

/**
 * Lo que se puede probar sin base: la forma del reporte, la de la subida y el
 * contrato publicado.
 *
 * El reporte que necesita escribir está en `reports.db.test.ts`, que se saltea si
 * no hay base configurada. La subida escribe un archivo, así que apunta
 * `UPLOAD_DIR` a un temporal que se borra al final.
 */

/** Un reporte que pasa la validación entera. */
const VALID_REPORT = {
  type: 'POTHOLE',
  severity: 'MODERATE',
  description: 'Pozo profundo en la esquina',
  geom: { lon: -68.8444, lat: -32.8897 },
};

/** Un PNG de 1x1 de verdad, para que la subida sea la de un archivo real. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const BASE_URL = 'http://localhost:3001/uploads';

function postReport(body: unknown) {
  return request(app)
    .post('/api/reports')
    .set('content-type', 'application/json')
    .send(body as string);
}

function postImage(attach: (req: request.Test) => request.Test) {
  return attach(request(app).post('/api/reports/images'));
}

describe('POST /api/reports', () => {
  it('rechaza un pedido sin tipo', async () => {
    const { type: _type, ...body } = VALID_REPORT;
    const res = await postReport(body);

    expect(res.status).toBe(400);
    expect(res.body as unknown).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        details: [{ field: 'type', code: 'REQUIRED' }],
      },
    });
  });

  it('rechaza un pedido sin descripción', async () => {
    const { description: _description, ...body } = VALID_REPORT;
    const res = await postReport(body);

    expect(res.status).toBe(400);
    expect(res.body as unknown).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        details: [{ field: 'description', code: 'REQUIRED' }],
      },
    });
  });

  it('rechaza una severidad fuera del enum', async () => {
    const res = await postReport({ ...VALID_REPORT, severity: 'SEVERE' });

    expect(res.status).toBe(400);
    expect(res.body as unknown).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        details: [{ field: 'severity', code: 'INVALID' }],
      },
    });
  });

  it('rechaza una descripción vacía', async () => {
    const res = await postReport({ ...VALID_REPORT, description: '   ' });

    expect(res.status).toBe(400);
    expect(res.body as unknown).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        details: [{ field: 'description', code: 'INVALID' }],
      },
    });
  });

  it('rechaza una descripción de más de 300 caracteres', async () => {
    // 301 y no 300: la columna es `varchar(300)` y el tope tiene que estar acá,
    // no en un 500 de Postgres.
    const res = await postReport({ ...VALID_REPORT, description: 'a'.repeat(301) });

    expect(res.status).toBe(400);
    expect(res.body as unknown).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        details: [{ field: 'description', code: 'INVALID' }],
      },
    });
  });

  it('rechaza una longitud fuera de rango', async () => {
    const res = await postReport({
      ...VALID_REPORT,
      geom: { lon: -181, lat: VALID_REPORT.geom.lat },
    });

    expect(res.status).toBe(400);
    expect(res.body as unknown).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        details: [{ field: 'geom.lon', code: 'INVALID' }],
      },
    });
  });

  it('rechaza una latitud que no es un número', async () => {
    const res = await postReport({
      ...VALID_REPORT,
      geom: { lon: VALID_REPORT.geom.lon, lat: 'sur' },
    });

    expect(res.status).toBe(400);
    expect(res.body as unknown).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        details: [{ field: 'geom.lat', code: 'INVALID' }],
      },
    });
  });

  it('rechaza una image_url que no es una URL', async () => {
    const res = await postReport({ ...VALID_REPORT, image_url: 'foto.jpg' });

    expect(res.status).toBe(400);
    expect(res.body as unknown).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        details: [{ field: 'image_url', code: 'INVALID' }],
      },
    });
  });

  it('rechaza un campo de más y lo nombra', async () => {
    const res = await postReport({ ...VALID_REPORT, reporter_name: 'Ana' });

    // El cuerpo es estricto: un campo que el contrato no tiene es un error, no
    // algo que se descarta en silencio ([17 §2]).
    expect(res.status).toBe(400);
    expect(res.body as unknown).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        details: [{ field: 'reporter_name', code: 'INVALID' }],
      },
    });
  });
});

describe('POST /api/reports/images', () => {
  let uploadDir: string;
  const savedEnv: Record<string, string | undefined> = {};

  beforeAll(async () => {
    uploadDir = await mkdtemp(join(tmpdir(), 'rodando-uploads-'));

    // `loadConfig()` no memoiza y se llama en cada pedido, así que apuntar las
    // variables acá alcanza. `DATABASE_URL` va porque la configuración se valida
    // entera, aunque la subida no toque la base.
    for (const key of ['UPLOAD_DIR', 'UPLOAD_BASE_URL', 'DATABASE_URL'] as const) {
      savedEnv[key] = process.env[key];
    }
    process.env.UPLOAD_DIR = uploadDir;
    // Con barra final: la configuración la normaliza y la URL sale con una sola.
    process.env.UPLOAD_BASE_URL = `${BASE_URL}/`;
    process.env.DATABASE_URL ??= 'postgres://rodando:rodando@localhost:5432/rodando';
  });

  afterAll(async () => {
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }

    await rm(uploadDir, { recursive: true, force: true });
  });

  it('rechaza un pedido sin archivo', async () => {
    const res = await postImage((req) => req);

    expect(res.status).toBe(400);
    expect(res.body as unknown).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        details: [{ field: 'file', code: 'REQUIRED' }],
      },
    });
  });

  it('rechaza un archivo que no es PNG, JPEG ni WebP', async () => {
    const res = await postImage((req) =>
      req.attach('file', Buffer.from('no soy una imagen'), {
        filename: 'nota.txt',
        contentType: 'text/plain',
      }),
    );

    expect(res.status).toBe(400);
    expect(res.body as unknown).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        details: [{ field: 'file', code: 'INVALID' }],
      },
    });
  });

  it('rechaza un archivo de más de 5 MB', async () => {
    const res = await postImage((req) =>
      req.attach('file', Buffer.alloc(5 * 1024 * 1024 + 1), {
        filename: 'grande.png',
        contentType: 'image/png',
      }),
    );

    expect(res.status).toBe(400);
    expect(res.body as unknown).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        details: [{ field: 'file', code: 'INVALID' }],
      },
    });
  });

  it('guarda un PNG y devuelve su URL', async () => {
    const res = await postImage((req) =>
      req.attach('file', PNG, { filename: 'pozo.png', contentType: 'image/png' }),
    );

    expect(res.status).toBe(201);

    const { url } = res.body as { url: string };
    expect(url.startsWith(`${BASE_URL}/`)).toBe(true);

    // El nombre lo pone el servidor con la extensión del MIME, no la del archivo
    // que mandó el cliente ([17 §4]).
    const fileName = url.slice(BASE_URL.length + 1);
    expect(fileName).toMatch(/^[0-9a-f-]{36}\.png$/);
    expect(await readdir(uploadDir)).toContain(fileName);
  });
});

describe('GET /api/openapi.json', () => {
  it('publica el contrato de los reportes generado desde los esquemas Zod', async () => {
    const res = await request(app).get('/api/openapi.json');

    expect(res.status).toBe(200);

    const document = res.body as {
      paths: Record<string, unknown>;
      components: { schemas: Record<string, unknown> };
    };
    expect(Object.keys(document.paths)).toContain('/api/reports');
    // El pedido y la respuesta tienen nombre propio: son los tipos que el
    // cliente genera y usa ([17 §2 y §3]).
    expect(Object.keys(document.components.schemas)).toContain('CreateReportRequest');
    expect(Object.keys(document.components.schemas)).toContain('Report');
  });
});
