import { sql, type Transaction } from 'kysely';
import { afterAll, describe, expect, it } from 'vitest';
import { getDb } from '../db/index.js';
import { inRolledBackTransaction } from '../db/test-transaction.js';
import type { DB } from '../db/types.js';
import type { CreateReportRequest } from './reports.schemas.js';
import { createReport } from './reports.service.js';

/**
 * Lo que el `POST` escribe de verdad, contra la base.
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

// Sin base no hay nada que escribir: el resto de la suite no la necesita.
describe.skipIf(!process.env.DATABASE_URL)('createReport contra la base', () => {
  afterAll(async () => {
    await getDb().destroy();
  });

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
