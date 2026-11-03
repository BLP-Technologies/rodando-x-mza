import type { Kysely } from 'kysely';
import type { DB, ReportStatus } from '../db/types.js';
import { pointGeometrySchema } from '../graph/graph.schemas.js';
import { ERROR_CODES } from '../http/error-codes.js';
import { HttpError } from '../http/errors.js';
import {
  reportsResponseSchema,
  type CreateReportRequest,
  type Report,
  type ReportFeature,
  type ReportsResponse,
} from './reports.schemas.js';
import { findReports, insertReport, type ReportFeatureRow } from './reports.sql.js';

/**
 * El tope de reportes de una respuesta.
 *
 * Es el mismo número y el mismo motivo que el tope del grafo
 * ([14 §5.1](../../../docs/14-la-api-del-grafo.md)): no es una regla de negocio sino una
 * red para que un pedido no arme una respuesta de decenas de megabytes. La cola de
 * moderación real son decenas de reportes y no se llega; cuando se llega, la respuesta
 * lo dice en `truncated` en vez de mentir sobre el recorte.
 */
const MAX_REPORTS = 2000;

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

/**
 * Lee los reportes de un estado, como `FeatureCollection`.
 *
 * Sólo lee: no hay caché ni nada que recordar entre pedidos. Una colección vacía es una
 * respuesta válida (no hay reportes en ese estado), no un error
 * ([17 §7](../../../docs/17-la-api-de-reportes.md)).
 *
 * El filtro por estado va en la consulta y no en el cliente por volumen: la pantalla
 * pide un estado por vez y traer todas para descartar en el navegador crecería con lo
 * que la moderación acumule.
 *
 * El tope se aplica igual que en el grafo: se pide una fila de más para distinguir
 * "entraron justo 2000" de "había más", y el recorte se avisa en `truncated`.
 */
export async function readReports(
  db: Kysely<DB>,
  status: ReportStatus,
): Promise<ReportsResponse> {
  const rows = await findReports(db, status, MAX_REPORTS + 1);
  const truncated = rows.length > MAX_REPORTS;

  return reportsResponseSchema.parse({
    type: 'FeatureCollection',
    truncated,
    features: (truncated ? rows.slice(0, MAX_REPORTS) : rows).map(toReportFeature),
  });
}

/**
 * Una fila de la lectura, con la forma que tiene en la respuesta.
 *
 * Misma regla del borde que el grafo: el GeoJSON sale de la base como texto y se valida
 * antes de entrar al tipado. La fecha se pasa a ISO acá porque el driver la entrega
 * como `Date`: el cliente no tiene que adivinar la zona horaria de la base.
 */
function toReportFeature(row: ReportFeatureRow): ReportFeature {
  const geometry: unknown = JSON.parse(row.geometry);

  return {
    type: 'Feature',
    geometry: pointGeometrySchema.parse(geometry),
    properties: {
      id: row.id,
      status: row.status,
      type: row.type,
      type_name: row.typeName,
      severity: row.severity,
      description: row.description,
      image_url: row.imageUrl,
      created_at: row.createdAt.toISOString(),
    },
  };
}
