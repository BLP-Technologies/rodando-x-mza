import { sql, type Transaction } from 'kysely';
import { afterAll, describe, expect, it } from 'vitest';
import { getDb } from '../db/index.js';
import { inRolledBackTransaction } from '../db/test-transaction.js';
import type { DB } from '../db/types.js';
import type { CreateReportRequest, ReportFeature } from './reports.schemas.js';
import { createReport, readReports } from './reports.service.js';

/**
 * Lo que el `POST` escribe y el `GET` lee, contra la base.
 *
 * Todo corre dentro de una transacción que se deshace: los reportes de prueba no
 * quedan en la base de desarrollo y no hay que limpiarlos.
 */

/** Un reporte válido, en el microcentro; cada test cambia sólo lo que le importa. */
const BASE_REPORT: CreateReportRequest = {
  type: 'POTHOLE',
  severity: 'MODERATE',
  description: 'Pozo profundo en la esquina',
  geom: { lon: -68.8444, lat: -32.8897 },
};

/** La fila guardada, con lo que la respuesta no devuelve. */
async function readReport(
  trx: Transaction<DB>,
  id: number,
): Promise<{
  type_id: number;
  status: string;
  user_id: number | null;
  image_url: string | null;
  lon: number;
  lat: number;
}> {
  const result = await sql<{
    type_id: number;
    status: string;
    user_id: number | null;
    image_url: string | null;
    lon: number;
    lat: number;
  }>`
    SELECT type_id, status, user_id, image_url, ST_X(geom) AS lon, ST_Y(geom) AS lat
    FROM reports
    WHERE id = ${id}
  `.execute(trx);

  const row = result.rows[0];
  if (row === undefined) throw new Error(`the report ${id} was not saved`);

  return row;
}

/** El id del catálogo para un código, para compararlo con lo que quedó escrito. */
async function typeIdOf(trx: Transaction<DB>, code: string): Promise<number> {
  const result = await sql<{ id: number }>`
    SELECT id FROM obstacle_types WHERE code = ${code}
  `.execute(trx);

  const row = result.rows[0];
  if (row === undefined) throw new Error(`the type ${code} is missing`);

  return row.id;
}

async function countReports(trx: Transaction<DB>): Promise<number> {
  const result = await sql<{ count: string }>`
    SELECT count(*) AS count FROM reports
  `.execute(trx);

  return Number(result.rows[0]?.count ?? 0);
}

/** Los `id` de una lectura, en el orden en que llegaron. */
function idsOf(features: readonly ReportFeature[]): number[] {
  return features.map((feature) => feature.properties.id);
}

/**
 * Cierra la conexión una sola vez, al terminar el archivo.
 *
 * Las dos suites comparten el mismo pool: destruirlo al final de la primera dejaría a
 * la segunda sin conexión.
 */
afterAll(async () => {
  if (process.env.DATABASE_URL) await getDb().destroy();
});

// Sin base no hay nada que escribir: el resto de la suite no la necesita.
describe.skipIf(!process.env.DATABASE_URL)('createReport contra la base', () => {
  it('escribe el reporte anónimo, en PENDING y con el tipo del catálogo', async () => {
    const outcome = await inRolledBackTransaction(async (trx) => {
      const report = await createReport(trx, BASE_REPORT);
      const row = await readReport(trx, report.id);

      return { report, row, potholeId: await typeIdOf(trx, 'POTHOLE') };
    });

    expect(outcome.report.status).toBe('PENDING');
    expect(outcome.report.type).toBe('POTHOLE');
    expect(outcome.report.severity).toBe('MODERATE');

    // Lo que la respuesta no dice: el estado lo puso la base, el autor no existe
    // todavía y el tipo es la fila del catálogo con ese código (docs/17 §6).
    expect(outcome.row.status).toBe('PENDING');
    expect(outcome.row.user_id).toBeNull();
    expect(outcome.row.type_id).toBe(outcome.potholeId);

    // La geometría quedó en el punto pedido, con el orden lon/lat de PostGIS.
    expect(outcome.row.lon).toBeCloseTo(BASE_REPORT.geom.lon, 6);
    expect(outcome.row.lat).toBeCloseTo(BASE_REPORT.geom.lat, 6);
  });

  it('acepta OTHER como cualquier otro tipo', async () => {
    const report = await inRolledBackTransaction((trx) =>
      createReport(trx, { ...BASE_REPORT, type: 'OTHER' }),
    );

    // `OTHER` no es un caso especial: está en el catálogo, así que se guarda
    // (docs/09 §4.5).
    expect(report.type).toBe('OTHER');
  });

  it('rechaza un código inexistente y no escribe nada', async () => {
    const outcome = await inRolledBackTransaction(async (trx) => {
      const before = await countReports(trx);
      const error = await createReport(trx, {
        ...BASE_REPORT,
        type: 'NO_EXISTE',
      }).catch((thrown: unknown) => thrown);

      return { before, error, after: await countReports(trx) };
    });

    expect(outcome.error).toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
      details: [{ field: 'type', code: 'INVALID' }],
    });
    expect(outcome.after).toBe(outcome.before);
  });

  it('rechaza un tipo inactivo con el mismo INVALID y tampoco escribe', async () => {
    const outcome = await inRolledBackTransaction(async (trx) => {
      await sql`UPDATE obstacle_types SET is_active = false WHERE code = 'TREE'`.execute(
        trx,
      );

      const before = await countReports(trx);
      const error = await createReport(trx, { ...BASE_REPORT, type: 'TREE' }).catch(
        (thrown: unknown) => thrown,
      );

      return { error, before, after: await countReports(trx) };
    });

    // Para el cliente es el mismo caso que un código inexistente: elegir otro
    // tipo del catálogo ([17 §5]).
    expect(outcome.error).toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
      details: [{ field: 'type', code: 'INVALID' }],
    });
    expect(outcome.after).toBe(outcome.before);
  });

  it('guarda la URL de la imagen tal como llegó', async () => {
    const imageUrl = 'http://localhost:3001/uploads/2f1c6c1e-0f6c-4a4e-9d3a-0c5b1b2f7a11.jpg';

    const outcome = await inRolledBackTransaction(async (trx) => {
      const report = await createReport(trx, { ...BASE_REPORT, image_url: imageUrl });

      return readReport(trx, report.id);
    });

    expect(outcome.image_url).toBe(imageUrl);
  });

  it('guarda un reporte fuera del piloto: no se valida contra service_areas', async () => {
    // Buenos Aires: lejísimos de la zona piloto, y aun así se guarda. El reporte
    // no es un pedido de recorrido; el punto dibuja y el moderador decide
    // ([17 §1]).
    const report = await inRolledBackTransaction((trx) =>
      createReport(trx, { ...BASE_REPORT, geom: { lon: -58.4, lat: -34.6 } }),
    );

    expect(report.id).toBeGreaterThan(0);
  });
});

/**
 * Lo que la lectura devuelve: el filtro, el orden, la baja y el tope.
 *
 * La lectura pide exactamente lo mismo que el `POST` deja escrito, así que los dos
 * bloques comparten `BASE_REPORT` y el patrón de la transacción deshecha.
 */
describe.skipIf(!process.env.DATABASE_URL)('readReports contra la base', () => {
  it('devuelve un PENDING con las ocho propiedades y el nombre del catálogo', async () => {
    const outcome = await inRolledBackTransaction(async (trx) => {
      const created = await createReport(trx, BASE_REPORT);

      return { created, reports: await readReports(trx, 'PENDING') };
    });

    const feature = outcome.reports.features.find(
      (candidate) => candidate.properties.id === outcome.created.id,
    );
    if (feature === undefined) throw new Error('the pending report is missing from the read');

    // Las ocho propiedades, ni una más ni una menos ([17 §7]).
    expect(Object.keys(feature.properties).sort()).toEqual([
      'created_at',
      'description',
      'id',
      'image_url',
      'severity',
      'status',
      'type',
      'type_name',
    ]);

    // El código es para el cliente y el nombre es para la persona: los dos salen
    // del `JOIN` con el catálogo.
    expect(feature.properties.type).toBe('POTHOLE');
    expect(feature.properties.type_name).toBe('Pozo');

    expect(feature.properties.status).toBe('PENDING');
    expect(feature.properties.severity).toBe('MODERATE');
    expect(feature.properties.description).toBe(BASE_REPORT.description);
    expect(feature.properties.image_url).toBeNull();

    // La fecha viaja en ISO, no en la forma del driver.
    const createdAt = new Date(feature.properties.created_at);
    expect(Number.isNaN(createdAt.getTime())).toBe(false);
    expect(createdAt.toISOString()).toBe(feature.properties.created_at);

    // La geometría es GeoJSON, con el orden [lon, lat] de PostGIS.
    expect(feature.geometry.type).toBe('Point');
    const [lon, lat] = feature.geometry.coordinates;
    expect(lon).toBeCloseTo(BASE_REPORT.geom.lon, 5);
    expect(lat).toBeCloseTo(BASE_REPORT.geom.lat, 5);
  });

  it('filtra por estado: un APPROVED no está en PENDING y sí en APPROVED', async () => {
    const outcome = await inRolledBackTransaction(async (trx) => {
      const created = await createReport(trx, BASE_REPORT);

      await sql`UPDATE reports SET status = 'APPROVED' WHERE id = ${created.id}`.execute(trx);

      return {
        id: created.id,
        pending: await readReports(trx, 'PENDING'),
        approved: await readReports(trx, 'APPROVED'),
      };
    });

    expect(idsOf(outcome.pending.features)).not.toContain(outcome.id);
    expect(idsOf(outcome.approved.features)).toContain(outcome.id);
  });

  it('no devuelve un reporte dado de baja en ningún estado', async () => {
    const outcome = await inRolledBackTransaction(async (trx) => {
      const created = await createReport(trx, BASE_REPORT);

      await sql`UPDATE reports SET deleted_at = now() WHERE id = ${created.id}`.execute(trx);

      const statuses = ['PENDING', 'APPROVED', 'UNDER_REPAIR', 'RESOLVED', 'REJECTED'] as const;

      return { id: created.id, reports: await Promise.all(statuses.map((s) => readReports(trx, s))) };
    });

    // `deleted_at` no es un estado más: la baja se lee en todos los estados
    // ([17 §7]).
    for (const reports of outcome.reports) {
      expect(idsOf(reports.features)).not.toContain(outcome.id);
    }
  });

  it('ordena del más nuevo al más antiguo y desempata por id', async () => {
    const outcome = await inRolledBackTransaction(async (trx) => {
      const older = await createReport(trx, BASE_REPORT);
      const newer = await createReport(trx, { ...BASE_REPORT, description: 'Más nuevo' });

      // Las fechas se fijan a mano: dos `now()` seguidos pueden caer en el mismo
      // microsegundo y el test no probaría el orden.
      await sql`UPDATE reports SET created_at = '2020-01-01T00:00:00Z' WHERE id = ${older.id}`.execute(
        trx,
      );
      await sql`UPDATE reports SET created_at = '2020-01-02T00:00:00Z' WHERE id = ${newer.id}`.execute(
        trx,
      );

      return { older, newer, reports: await readReports(trx, 'PENDING') };
    });

    const ours = idsOf(
      outcome.reports.features.filter((feature) =>
        [outcome.older.id, outcome.newer.id].includes(feature.properties.id),
      ),
    );

    expect(ours).toEqual([outcome.newer.id, outcome.older.id]);
  });

  it('recorta en el tope de 2000 y lo avisa en truncated', async () => {
    const reports = await inRolledBackTransaction(async (trx) => {
      // Un solo `INSERT ... SELECT` con `generate_series`, como el grafo con sus 2100
      // cordones: 2001 inserts serían el test más lento de la suite.
      await sql`
        INSERT INTO reports (type_id, severity, description, geom, status, created_at)
        SELECT (SELECT id FROM obstacle_types WHERE code = 'OTHER'),
               'MINOR',
               'relleno ' || serie,
               ST_SetSRID(ST_MakePoint(-68.8444, -32.8897), 4326),
               'PENDING',
               now() - (serie || ' seconds')::interval
        FROM generate_series(1, 2001) AS serie
      `.execute(trx);

      return readReports(trx, 'PENDING');
    });

    expect(reports.features).toHaveLength(2000);
    expect(reports.truncated).toBe(true);
  });
});
