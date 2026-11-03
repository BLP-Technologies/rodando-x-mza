import type { Kysely } from 'kysely';
import type { DB } from '../db/types.js';
import { ERROR_CODES } from '../http/error-codes.js';
import { HttpError } from '../http/errors.js';
import type { CreateReportRequest, Report } from './reports.schemas.js';
import { insertReport } from './reports.sql.js';

/**
 * Crea un reporte de obstáculo.
 *
 * Es la escritura ciudadana de C010: guarda la **percepción** de quien reporta y
 * no crea ningún obstáculo; eso es la moderación (#47)
 * ([09 §4.5](../../../docs/09-modelo-de-datos.md)).
 *
 * **Un código de tipo inexistente o inactivo es el mismo `INVALID`**: para el
 * cliente la acción es idéntica —elegir otro tipo del catálogo— y distinguirlos
 * no le cambiaría el mensaje ([17 §5](../../../docs/17-la-api-de-reportes.md)).
 * El 400 es el mismo que devuelve cualquier campo mal formado, con el `details`
 * que nombra el campo.
 */
export async function createReport(
  db: Kysely<DB>,
  input: CreateReportRequest,
): Promise<Report> {
  const row = await insertReport(db, {
    type: input.type,
    severity: input.severity,
    description: input.description,
    lon: input.geom.lon,
    lat: input.geom.lat,
    imageUrl: input.image_url ?? null,
  });

  if (row === null) {
    throw new HttpError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      `unknown report type ${input.type}`,
      [{ field: 'type', code: 'INVALID' }],
    );
  }

  // El tipo y la severidad se devuelven como llegaron: `RETURNING` sólo trae lo
  // que decide la base, que es el `id` y el `status` inicial.
  return {
    id: row.id,
    type: input.type,
    severity: input.severity,
    status: row.status,
  };
}
