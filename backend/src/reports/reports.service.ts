import type { Kysely } from 'kysely';
import type { DB, ReportStatus } from '../db/types.js';
import { pointGeometrySchema } from '../graph/graph.schemas.js';
import { ERROR_CODES } from '../http/error-codes.js';
import { HttpError } from '../http/errors.js';
import { createObstacle, readObstacle } from '../obstacles/obstacles.service.js';
import {
  reportsResponseSchema,
  type ApproveReportRequest,
  type ApproveReportResponse,
  type CreateReportRequest,
  type Report,
  type ReportDecision,
  type ReportFeature,
  type ReportsResponse,
} from './reports.schemas.js';
import {
  findReports,
  insertReport,
  lockReportForUpdate,
  markReportApproved,
  markReportRejected,
  type LockedReport,
  type ReportFeatureRow,
} from './reports.sql.js';

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
      obstacle_id: row.obstacleId,
      created_at: row.createdAt.toISOString(),
    },
  };
}

/**
 * Aprueba un reporte: crea el obstáculo y marca el reporte, en una sola transacción (C012).
 *
 * El orden es el de [18 §6](../../../docs/18-la-api-de-obstaculos.md): bloquear el reporte,
 * rechazar si ya no está pendiente, pegar el punto del reporte al elemento más cercano,
 * insertar el obstáculo y recién ahí marcar el reporte. Así no puede quedar un reporte
 * `APPROVED` sin obstáculo ni un obstáculo huérfano de una aprobación que falló.
 *
 * **Se llama con una transacción abierta.** La lee quien la usa —la ruta, con
 * `getDb().transaction()`— y no este servicio: el orden de las tres escrituras vive acá,
 * pero abrir la transacción es de quien puede deshacerla, y así el servicio corre igual
 * dentro de una transacción de prueba.
 *
 * **El punto sale del reporte y no del cuerpo**: el moderador clasifica lo que alguien
 * reportó, no mueve el pin. Si no hay ningún elemento del grafo cerca, el pedido falla con
 * `NO_NEARBY_ELEMENT`, la transacción se deshace y el reporte sigue `PENDING` para que el
 * moderador lo descarte o lo revise ([17 §7](../../../docs/17-la-api-de-reportes.md)).
 */
export async function approveReport(
  db: Kysely<DB>,
  id: number,
  decision: ApproveReportRequest,
): Promise<ApproveReportResponse> {
  const report = await assertPendingReport(db, id);

  const created = await createObstacle(db, {
    type: decision.type,
    severity: decision.severity,
    lon: report.lon,
    lat: report.lat,
  });

  const marked = await markReportApproved(db, id, created.properties.id);

  // El obstáculo se vuelve a leer después de marcar el reporte: así `reports_count` incluye
  // el reporte que se acaba de aprobar y la respuesta no se contradice con la que devuelve.
  const obstacle = await readObstacle(db, created.properties.id);

  return {
    obstacle,
    report: toReportDecision(marked.id, marked.status, marked.obstacleId),
  };
}

/**
 * Descarta un reporte sin crear nada (C012).
 *
 * Es la otra salida de la moderación y la que se usa cuando el reporte no corresponde a un
 * obstáculo, ya está reportado o no se puede publicar porque no hay un elemento del grafo
 * cerca. `REJECTED` es el estado previsto para “duplicado” y para “descartado”
 * ([09 §4.5](../../../docs/09-modelo-de-datos.md)).
 *
 * No borra: `deleted_at` y un estado del enum son cosas distintas, y una moderación hecha se
 * tiene que poder leer. Igual que la aprobación, se llama con una transacción abierta.
 */
export async function rejectReport(db: Kysely<DB>, id: number): Promise<ReportDecision> {
  await assertPendingReport(db, id);

  const marked = await markReportRejected(db, id);

  return toReportDecision(marked.id, marked.status, marked.obstacleId);
}

/**
 * Bloquea el reporte y exige que esté pendiente.
 *
 * Un reporte moderado se rechaza con `409` y no se vuelve a moderar: `APPROVED` ya tiene su
 * obstáculo y `REJECTED` ya está descartado, así que repetir la acción no es idempotente, es
 * una segunda decisión sobre lo mismo.
 */
async function assertPendingReport(trx: Kysely<DB>, id: number): Promise<LockedReport> {
  const report = await lockReportForUpdate(trx, id);

  if (report === null) {
    throw new HttpError(404, ERROR_CODES.NOT_FOUND, `report ${id} not found`);
  }

  if (report.status !== 'PENDING') {
    throw new HttpError(409, ERROR_CODES.CONFLICT, `report ${id} is not pending`);
  }

  return report;
}

/** La fila del reporte con los nombres de la respuesta. */
function toReportDecision(
  id: number,
  status: ReportStatus,
  obstacleId: number | null,
): ReportDecision {
  return { id, status, obstacle_id: obstacleId };
}
