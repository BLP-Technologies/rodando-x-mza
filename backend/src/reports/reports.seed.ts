import { sql, type Kysely } from 'kysely';
import type { DB, ReportStatus } from '../db/types.js';
import type { ReportSeverity } from './reports.schemas.js';

/**
 * Los datos de prueba del portal: diez reportes ciudadanos.
 *
 * Es una herramienta de desarrollo y no de la API: no hay endpoint que los cargue ni
 * los borre, y las filas son indistinguibles de las que crearía un ciudadano. El
 * `status` se escribe directo porque el `POST` siempre crea `PENDING`, y lo que hay
 * que poder probar es justamente el selector de estados ([17 §7]).
 */

export type SeedReport = {
  type: string;
  severity: ReportSeverity;
  description: string;
  lon: number;
  lat: number;
  status: ReportStatus;
};

/**
 * Los diez reportes de prueba: uno por cada tipo del catálogo que tiene sentido
 * visualizar, repartidos dentro de la zona piloto y con los tres estados que un
 * moderador va a querer mirar (pendientes, aprobados y rechazados).
 *
 * Van dentro del piloto y no en cualquier lado para que, cuando el mapa dibuje
 * reportes, sirvan; hoy sólo alimentan la tabla de `/reports`.
 */
export const SEED_REPORTS: readonly SeedReport[] = [
  {
    type: 'POTHOLE',
    severity: 'MODERATE',
    description: 'Pozo profundo en la esquina de San Martín y 9 de Julio',
    lon: -68.8444,
    lat: -32.8897,
    status: 'PENDING',
  },
  {
    type: 'MISSING_RAMP',
    severity: 'CRITICAL',
    description: 'Falta la rampa de la ochava, hay un escalón de 15 cm',
    lon: -68.8451,
    lat: -32.8901,
    status: 'PENDING',
  },
  {
    type: 'BROKEN_PAVEMENT',
    severity: 'MINOR',
    description: 'Baldosas sueltas en toda la cuadra',
    lon: -68.8429,
    lat: -32.8878,
    status: 'PENDING',
  },
  {
    type: 'TREE',
    severity: 'MODERATE',
    description: 'Raíces levantadas, la vereda queda despareja',
    lon: -68.8462,
    lat: -32.8869,
    status: 'PENDING',
  },
  {
    type: 'NARROWING',
    severity: 'MINOR',
    description: 'Pasan dos personas con dificultad por los toldos',
    lon: -68.8437,
    lat: -32.8919,
    status: 'PENDING',
  },
  {
    type: 'BLOCKED_PASSAGE',
    severity: 'CRITICAL',
    description: 'Un auto estacionado sobre la rampa, no se puede pasar',
    lon: -68.8455,
    lat: -32.8882,
    status: 'PENDING',
  },
  {
    type: 'CONSTRUCTION',
    severity: 'CRITICAL',
    description: 'Obra con rejas que corta la vereda entera',
    lon: -68.8418,
    lat: -32.8894,
    status: 'PENDING',
  },
  {
    type: 'STEP',
    severity: 'MODERATE',
    description: 'Escalón de acceso al local, sin baranda',
    lon: -68.8481,
    lat: -32.8888,
    status: 'APPROVED',
  },
  {
    type: 'STEEP_SLOPE',
    severity: 'MODERATE',
    description: 'La rampa de la plaza tiene mucha pendiente',
    lon: -68.8448,
    lat: -32.8908,
    status: 'APPROVED',
  },
  {
    type: 'OTHER',
    severity: 'MINOR',
    description: 'Semáforo sin aviso sonoro para cruzar',
    lon: -68.8408,
    lat: -32.8874,
    status: 'REJECTED',
  },
];

/**
 * Escribe los diez reportes y devuelve cuántos quedaron en la tabla.
 *
 * **Agrega, no reemplaza**: dos corridas dejan veinte. La alternativa —borrar por
 * descripción antes de insertar— podría borrar un reporte real que diga lo mismo, y
 * limpiar datos de prueba es un `DELETE` que cada uno decide cuándo correr.
 *
 * Los tipos van por código, igual que en el contrato: un código que no esté entre los
 * activos no inserta esa fila, y el total que se imprime lo delata.
 */
export async function seedReports(
  db: Kysely<DB>,
): Promise<{ inserted: number; total: number }> {
  for (const report of SEED_REPORTS) {
    await sql`
      INSERT INTO reports (type_id, severity, description, geom, status)
      SELECT catalogue.id, ${report.severity}::obstacle_severity, ${report.description},
             ST_SetSRID(ST_MakePoint(${report.lon}, ${report.lat}), 4326),
             ${report.status}::report_status
      FROM obstacle_types catalogue
      WHERE catalogue.code = ${report.type} AND catalogue.is_active
    `.execute(db);
  }

  const result = await sql<{ total: string }>`
    SELECT count(*) AS total FROM reports
  `.execute(db);

  return { inserted: SEED_REPORTS.length, total: Number(result.rows[0]?.total ?? 0) };
}
