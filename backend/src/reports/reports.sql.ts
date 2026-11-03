import { sql, type Kysely } from 'kysely';
import type { DB, ReportStatus } from '../db/types.js';
import type { ReportSeverity } from './reports.schemas.js';

/**
 * La escritura y la lectura de los reportes.
 *
 * Ver [17 §2, §3 y §7](../../../docs/17-la-api-de-reportes.md).
 */

/** Lo que la escritura necesita del pedido, ya con el tipo resuelto a código. */
export type InsertReportInput = {
  type: string;
  severity: ReportSeverity;
  description: string;
  lon: number;
  lat: number;
  imageUrl: string | null;
};

/** El reporte tal como quedó guardado: lo que el default y el trigger deciden. */
export type ReportRow = { id: number; status: ReportStatus };

/**
 * Guarda un reporte y devuelve su `id` y su `status`, o `null` si ese código de
 * obstáculo no existe entre los activos.
 *
 * Tres decisiones (ver [17](../../../docs/17-la-api-de-reportes.md)):
 *
 * - **Una sola consulta, sin `SELECT` previo**: el catálogo se resuelve en el
 *   mismo `INSERT ... SELECT`, así que no hay carrera entre chequear que el
 *   código existe y escribir.
 * - **Cero filas devueltas significa exactamente una cosa**: no hay una fila
 *   activa en `obstacle_types` con ese código. El servicio lo traduce a un 400.
 * - **`user_id` no se escribe**: queda `NULL`, porque todavía no hay
 *   autenticación ([17 §6](../../../docs/17-la-api-de-reportes.md)).
 *   `status` y `created_at` toman su default, y el estado se devuelve con
 *   `RETURNING` para no suponerlo en el código.
 */
export async function insertReport(
  db: Kysely<DB>,
  input: InsertReportInput,
): Promise<ReportRow | null> {
  const result = await sql<{ id: number; status: ReportStatus }>`
    INSERT INTO reports (type_id, severity, description, geom, image_url)
    SELECT catalogue.id, ${input.severity}::obstacle_severity, ${input.description},
           ST_SetSRID(ST_MakePoint(${input.lon}, ${input.lat}), 4326), ${input.imageUrl}
    FROM obstacle_types catalogue
    WHERE catalogue.code = ${input.type} AND catalogue.is_active
    RETURNING id, status
  `.execute(db);

  return result.rows[0] ?? null;
}

/**
 * Un reporte leído, con lo que la respuesta necesita para dibujarlo y listarlo.
 *
 * `createdAt` llega como `Date` del driver de `pg`, no como texto: convertirlo a ISO es
 * trabajo del mapeo de la respuesta.
 */
export type ReportFeatureRow = {
  id: number;
  status: ReportStatus;
  type: string;
  typeName: string;
  severity: ReportSeverity;
  description: string;
  imageUrl: string | null;
  createdAt: Date;
  geometry: string;
};

/**
 * Los reportes de un estado, como mucho `limit`.
 *
 * Cuatro decisiones (ver [17 §7](../../../docs/17-la-api-de-reportes.md)):
 *
 * - **`JOIN` con el catálogo y no dos viajes**: `name_es` es para la persona que modera
 *   y `code` es para el cliente, y los dos salen de `obstacle_types`. Resolverlos acá
 *   evita que el servicio arme un mapa de códigos o que el cliente muestre `POTHOLE`.
 * - **`deleted_at IS NULL` siempre, sin parámetro**: un reporte dado de baja no se lee
 *   en ningún estado. No es un filtro que el cliente pida, es la definición de "lo que
 *   hay" ([09 §4.5](../../../docs/09-modelo-de-datos.md)).
 * - **El orden es determinístico**: de él depende qué filas entran cuando la respuesta
 *   se recorta. Con `created_at DESC, id DESC` los reportes más nuevos entran primero y
 *   dos pedidos iguales recortan en el mismo lugar; el `id` desempata los que comparten
 *   fecha.
 * - **No se filtra por bbox**: la pantalla de reportes es la cola de trabajo entera, no
 *   el mapa ([17 §7](../../../docs/17-la-api-de-reportes.md)).
 */
export async function findReports(
  db: Kysely<DB>,
  status: ReportStatus,
  limit: number,
): Promise<ReportFeatureRow[]> {
  const result = await sql<{
    id: number;
    status: ReportStatus;
    type: string;
    type_name: string;
    severity: ReportSeverity;
    description: string;
    image_url: string | null;
    created_at: Date;
    geometry: string;
  }>`
    SELECT report.id, report.status, catalogue.code AS type, catalogue.name_es AS type_name,
           report.severity, report.description, report.image_url,
           report.created_at, ST_AsGeoJSON(report.geom) AS geometry
    FROM reports report
    JOIN obstacle_types catalogue ON catalogue.id = report.type_id
    WHERE report.status = ${status}::report_status AND report.deleted_at IS NULL
    ORDER BY report.created_at DESC, report.id DESC
    LIMIT ${limit}
  `.execute(db);

  return result.rows.map((row) => ({
    id: row.id,
    status: row.status,
    type: row.type,
    typeName: row.type_name,
    severity: row.severity,
    description: row.description,
    imageUrl: row.image_url,
    createdAt: row.created_at,
    geometry: row.geometry,
  }));
}
