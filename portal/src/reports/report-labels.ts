/**
 * Las etiquetas y los colores de los reportes, en español y en un solo lugar.
 *
 * Los estados y las severidades viajan como códigos de la base
 * ([09 §4.1](../../docs/09-modelo-de-datos.md)); traducirlos es trabajo del cliente, y
 * si la traducción viviera en cada componente, agregar un estado sería buscar en todo
 * el portal.
 */

import type { ReportFeature, ReportStatus } from '@/api/reports';

/** La severidad tal como la reportó el ciudadano. */
export type ReportSeverity = ReportFeature['properties']['severity'];

/** Los cinco estados, en el orden del ciclo de moderación. */
export const REPORT_STATUSES: readonly ReportStatus[] = [
  'PENDING',
  'APPROVED',
  'UNDER_REPAIR',
  'RESOLVED',
  'REJECTED',
];

export const STATUS_LABELS: Record<ReportStatus, string> = {
  PENDING: 'Pendiente',
  APPROVED: 'Aprobado',
  UNDER_REPAIR: 'En reparación',
  RESOLVED: 'Resuelto',
  REJECTED: 'Rechazado',
};

export const SEVERITY_LABELS: Record<ReportSeverity, string> = {
  MINOR: 'Leve',
  MODERATE: 'Moderada',
  CRITICAL: 'Crítica',
};

/**
 * Los colores por severidad.
 *
 * Son la **percepción del ciudadano**, no la decisión del moderador
 * ([09 §4.5](../../docs/09-modelo-de-datos.md)): describen cuánto le pareció que molesta
 * a quien reportó, y por eso no usan la paleta de niveles del mapa. Cuando el moderador
 * decida la severidad de un obstáculo, ese dato tendrá sus propios colores.
 */
export const SEVERITY_COLORS: Record<ReportSeverity, string> = {
  MINOR: 'border-slate-300 bg-slate-100 text-slate-700',
  MODERATE: 'border-amber-300 bg-amber-50 text-amber-800',
  CRITICAL: 'border-red-300 bg-red-50 text-red-800',
};
