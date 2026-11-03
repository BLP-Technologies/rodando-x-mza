import { sql, type Kysely } from 'kysely';
import type { DB, ReportStatus } from '../db/types.js';
import type { ReportSeverity } from './reports.schemas.js';

/**
 * La escritura del reporte: una sola consulta.
 *
 * Ver [17 §2 y §3](../../../docs/17-la-api-de-reportes.md).
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
