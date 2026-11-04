import { sql } from 'kysely';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { getDb } from '../db/index.js';
import { obstaclesQuerySchema } from './obstacles.schemas.js';

const app = createApp();

/**
 * Lo que se puede probar sin tocar el grafo: la forma del pedido, la de la query y el
 * contrato publicado.
 *
 * Lo que necesita escribir —el alta, la resolución y la moderación de un reporte— está en el
 * bloque de abajo, que se saltea si no hay base configurada y se limpia solo al terminar.
 */

/** Un obstáculo que pasa la validación entera. */
const VALID_OBSTACLE = {
  type: 'POTHOLE',
  severity: 'MODERATE',
  geom: { lon: -68.8444, lat: -32.8897 },
};

function postObstacle(body: unknown) {
  return request(app)
    .post('/api/obstacles')
    .set('content-type', 'application/json')
    .send(body as string);
}

describe('POST /api/obstacles', () => {
  it('rechaza un pedido sin tipo', async () => {
    const { type: _type, ...body } = VALID_OBSTACLE;
    const res = await postObstacle(body);

    expect(res.status).toBe(400);
    expect(res.body as unknown).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        details: [{ field: 'type', code: 'REQUIRED' }],
      },
    });
  });

  it('rechaza un pedido sin severidad', async () => {
    const { severity: _severity, ...body } = VALID_OBSTACLE;
    const res = await postObstacle(body);

    expect(res.status).toBe(400);
    expect(res.body as unknown).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        details: [{ field: 'severity', code: 'REQUIRED' }],
      },
    });
  });

  it('rechaza un pedido sin punto', async () => {
    const { geom: _geom, ...body } = VALID_OBSTACLE;
    const res = await postObstacle(body);

    expect(res.status).toBe(400);
    expect(res.body as unknown).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        details: [{ field: 'geom', code: 'REQUIRED' }],
      },
    });
  });

  it('rechaza una severidad fuera del enum', async () => {
    const res = await postObstacle({ ...VALID_OBSTACLE, severity: 'SEVERE' });

    expect(res.status).toBe(400);
    expect(res.body as unknown).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        details: [{ field: 'severity', code: 'INVALID' }],
      },
    });
  });

  it('rechaza una longitud fuera de rango', async () => {
    const res = await postObstacle({
      ...VALID_OBSTACLE,
      geom: { lon: -181, lat: VALID_OBSTACLE.geom.lat },
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
    const res = await postObstacle({
      ...VALID_OBSTACLE,
      geom: { lon: VALID_OBSTACLE.geom.lon, lat: 'sur' },
    });

    expect(res.status).toBe(400);
    expect(res.body as unknown).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        details: [{ field: 'geom.lat', code: 'INVALID' }],
      },
    });
  });

  it('rechaza un elemento en el cuerpo y lo nombra', async () => {
    // El vínculo lo decide el servidor: mandarlo es un pedido que la API no ofrece, no algo
    // que se ignora en silencio ([18 §3]).
    const res = await postObstacle({ ...VALID_OBSTACLE, element_kind: 'sidewalk' });

    expect(res.status).toBe(400);
    expect(res.body as unknown).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        details: [{ field: 'element_kind', code: 'INVALID' }],
      },
    });
  });
});

describe('GET /api/obstacles', () => {
  it('rechaza un estado fuera del enum', async () => {
    const res = await request(app).get('/api/obstacles?status=NOPE');

    expect(res.status).toBe(400);
    expect(res.body as unknown).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        details: [{ field: 'status', code: 'INVALID' }],
      },
    });
  });

  it('rechaza un estado vacío en vez de caer al default', async () => {
    const res = await request(app).get('/api/obstacles?status=');

    expect(res.status).toBe(400);
    expect(res.body as unknown).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        details: [{ field: 'status', code: 'INVALID' }],
      },
    });
  });

  it('rechaza un parámetro de más y lo nombra', async () => {
    const res = await request(app).get('/api/obstacles?staus=ACTIVE');

    expect(res.status).toBe(400);
    expect(res.body as unknown).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        details: [{ field: 'staus', code: 'INVALID' }],
      },
    });
  });

  it('tiene ACTIVE por defecto', () => {
    // Se afirma sobre el esquema y no sobre un pedido: uno válido iría a la base y esta
    // suite corre sin base.
    expect(obstaclesQuerySchema.parse({}).status).toBe('ACTIVE');
    expect(obstaclesQuerySchema.parse({ status: 'ALL' }).status).toBe('ALL');
  });
});

describe.skipIf(!process.env.DATABASE_URL)('los obstáculos contra la base', () => {
  /** Un cordón propio, lejos de todo, para no depender de que el piloto esté importado. */
  const KERB = { lon: -68.8, lat: -32.9 };
  let kerbId = 0;
  const reportIds: number[] = [];

  beforeAll(async () => {
    const result = await sql<{ id: number }>`
      INSERT INTO kerb_nodes (geom)
      VALUES (ST_SetSRID(ST_MakePoint(${KERB.lon}, ${KERB.lat}), 4326))
      RETURNING id
    `.execute(getDb());

    const row = result.rows[0];
    if (row === undefined) throw new Error('the test kerb could not be inserted');
    kerbId = row.id;
  });

  afterAll(async () => {
    // Primero los reportes: la FK a `obstacles` es `ON DELETE RESTRICT`.
    for (const id of reportIds) {
      await sql`DELETE FROM reports WHERE id = ${id}`.execute(getDb());
    }
    await sql`DELETE FROM reports WHERE obstacle_id IN (
      SELECT id FROM obstacles WHERE kerb_node_id = ${kerbId}
    )`.execute(getDb());
    await sql`DELETE FROM obstacles WHERE kerb_node_id = ${kerbId}`.execute(getDb());
    await sql`DELETE FROM kerb_nodes WHERE id = ${kerbId}`.execute(getDb());
  });

  it('crea el obstáculo y devuelve la forma completa', async () => {
    const res = await postObstacle({
      type: 'POTHOLE',
      severity: 'MODERATE',
      geom: { ...KERB },
    });

    expect(res.status).toBe(201);

    const feature = res.body as {
      type: string;
      geometry: { type: string; coordinates: [number, number] };
      properties: Record<string, unknown>;
    };

    expect(feature.type).toBe('Feature');
    expect(feature.geometry.type).toBe('Point');
    expect(feature.geometry.coordinates[0]).toBeCloseTo(KERB.lon, 6);
    expect(feature.geometry.coordinates[1]).toBeCloseTo(KERB.lat, 6);

    // Las nueve propiedades, ni una más ni una menos ([18 §3]).
    expect(Object.keys(feature.properties).sort()).toEqual([
      'created_at',
      'element_id',
      'element_kind',
      'id',
      'reports_count',
      'resolved_at',
      'severity',
      'type',
      'type_name',
    ]);

    expect(feature.properties['type']).toBe('POTHOLE');
    expect(feature.properties['type_name']).toBe('Pozo');
    expect(feature.properties['severity']).toBe('MODERATE');
    expect(feature.properties['resolved_at']).toBeNull();
    expect(feature.properties['reports_count']).toBe(0);
    // El pegamento colgó el obstáculo de nuestro cordón.
    expect(feature.properties['element_kind']).toBe('kerb');
    expect(feature.properties['element_id']).toBe(kerbId);
  });

  it('rechaza el alta sin elemento cerca', async () => {
    const res = await postObstacle({
      type: 'POTHOLE',
      severity: 'MINOR',
      geom: { lon: -58.4, lat: -34.6 },
    });

    expect(res.status).toBe(400);
    expect(res.body as unknown).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        details: [{ field: 'geom', code: 'NO_NEARBY_ELEMENT' }],
      },
    });
  });

  it('rechaza OTHER como tipo de obstáculo', async () => {
    const res = await postObstacle({ type: 'OTHER', severity: 'MINOR', geom: { ...KERB } });

    expect(res.status).toBe(400);
    expect(res.body as unknown).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        details: [{ field: 'type', code: 'INVALID' }],
      },
    });
  });

  it('responde NOT_FOUND al resolver un id que no existe', async () => {
    const res = await request(app).post('/api/obstacles/999999/resolve');

    expect(res.status).toBe(404);
    expect(res.body as unknown).toEqual({ error: { code: 'NOT_FOUND' } });
  });

  it('aprueba un reporte una sola vez', async () => {
    const created = await request(app)
      .post('/api/reports')
      .set('content-type', 'application/json')
      .send({
        type: 'POTHOLE',
        severity: 'MINOR',
        description: 'Pozo de prueba del alta de obstáculos',
        geom: { ...KERB },
      } as unknown as string);

    expect(created.status).toBe(201);
    const reportId = (created.body as { id: number }).id;
    reportIds.push(reportId);

    const approved = await request(app)
      .post(`/api/reports/${reportId}/approve`)
      .set('content-type', 'application/json')
      .send({ type: 'POTHOLE', severity: 'MODERATE' } as unknown as string);

    expect(approved.status).toBe(201);
    const body = approved.body as {
      obstacle: { properties: { id: number; element_kind: string } };
      report: { id: number; status: string; obstacle_id: number };
    };
    expect(body.obstacle.properties.element_kind).toBe('kerb');
    expect(body.report).toEqual({
      id: reportId,
      status: 'APPROVED',
      obstacle_id: body.obstacle.properties.id,
    });

    // La segunda vez ya no está pendiente: `409` y ningún obstáculo nuevo ([18 §6]).
    const again = await request(app)
      .post(`/api/reports/${reportId}/approve`)
      .set('content-type', 'application/json')
      .send({ type: 'POTHOLE', severity: 'MODERATE' } as unknown as string);

    expect(again.status).toBe(409);
    expect(again.body as unknown).toEqual({ error: { code: 'CONFLICT' } });
  });

  it('descarta un reporte', async () => {
    const created = await request(app)
      .post('/api/reports')
      .set('content-type', 'application/json')
      .send({
        type: 'OTHER',
        severity: 'MINOR',
        description: 'No corresponde a un obstáculo',
        geom: { ...KERB },
      } as unknown as string);

    expect(created.status).toBe(201);
    const reportId = (created.body as { id: number }).id;
    reportIds.push(reportId);

    const rejected = await request(app).post(`/api/reports/${reportId}/reject`);

    expect(rejected.status).toBe(200);
    expect(rejected.body as unknown).toEqual({
      id: reportId,
      status: 'REJECTED',
      obstacle_id: null,
    });
  });
});

describe('GET /api/openapi.json', () => {
  it('publica el contrato de los obstáculos generado desde los esquemas Zod', async () => {
    const res = await request(app).get('/api/openapi.json');

    expect(res.status).toBe(200);

    const document = res.body as {
      paths: Record<string, Record<string, unknown>>;
      components: { schemas: Record<string, unknown> };
    };

    expect(document.paths['/api/obstacles']?.['get']).toBeDefined();
    expect(document.paths['/api/obstacles']?.['post']).toBeDefined();
    expect(document.paths['/api/obstacles/{id}/resolve']?.['post']).toBeDefined();
    expect(document.paths['/api/reports/{id}/approve']?.['post']).toBeDefined();
    expect(document.paths['/api/reports/{id}/reject']?.['post']).toBeDefined();

    // Con nombre propio porque son los tipos que el cliente genera y usa.
    for (const schema of [
      'CreateObstacleRequest',
      'ObstacleFeature',
      'ObstacleFeatureCollection',
      'ApproveReportRequest',
      'ApproveReportResponse',
    ]) {
      expect(Object.keys(document.components.schemas)).toContain(schema);
    }
  });
});
