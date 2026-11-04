/**
 * Las etiquetas y los colores de los obstáculos, en español y en un solo lugar.
 *
 * Las severidades y el estado viajan como códigos de la base
 * ([09 §4.1 y §4.5](../../docs/09-modelo-de-datos.md)); traducirlos es trabajo del cliente, y
 * si la traducción viviera en cada componente, agregar una severidad sería buscar en todo el
 * portal.
 */

import type {
  ObstacleElementKind,
  ObstacleFeature,
  ObstacleSeverity,
  ObstacleStatusFilter,
} from '@/api/obstacles';

/** Los tres filtros de la lectura, con los activos primero: es lo que hay en la calle. */
export const OBSTACLE_STATUS_FILTERS: readonly ObstacleStatusFilter[] = [
  'ACTIVE',
  'RESOLVED',
  'ALL',
];

export const STATUS_FILTER_LABELS: Record<ObstacleStatusFilter, string> = {
  ACTIVE: 'Activos',
  RESOLVED: 'Resueltos',
  ALL: 'Todos',
};

/** Las tres severidades, de menos a más restrictiva: el orden del formulario. */
export const OBSTACLE_SEVERITIES: readonly ObstacleSeverity[] = [
  'MINOR',
  'MODERATE',
  'CRITICAL',
];

/**
 * El texto de cada severidad.
 *
 * `CRITICAL` no dice "muy grave": en el ruteo significa que **no se puede pasar**
 * ([09 §4.7](../../docs/09-modelo-de-datos.md)), y quien modera tiene que verlo así.
 */
export const SEVERITY_LABELS: Record<ObstacleSeverity, string> = {
  MINOR: 'Leve',
  MODERATE: 'Moderada',
  CRITICAL: 'Crítica (bloquea el paso)',
};

/** Los badges de la tabla y del detalle, con la paleta de niveles del mapa invertida. */
export const SEVERITY_COLORS: Record<ObstacleSeverity, string> = {
  MINOR: 'border-slate-300 bg-slate-100 text-slate-700',
  MODERATE: 'border-amber-300 bg-amber-50 text-amber-800',
  CRITICAL: 'border-red-300 bg-red-50 text-red-800',
};

/**
 * Los colores del marcador en el mapa, los mismos de los badges.
 *
 * El gris de un obstáculo resuelto es el mismo gris del nivel sin relevar: dice "esto ya no
 * cuenta", y no se confunde con el rojo de una barrera activa.
 */
export const SEVERITY_MARKER_COLORS: Record<ObstacleSeverity, string> = {
  MINOR: '#475569',
  MODERATE: '#b45309',
  CRITICAL: '#b91c1c',
};

/** El color de un obstáculo resuelto: queda en el mapa como historia, no como barrera. */
export const RESOLVED_MARKER_COLOR = '#94a3b8';

/** La clase de elemento con el nombre que ve el moderador. */
export const ELEMENT_KIND_LABELS: Record<ObstacleElementKind, string> = {
  sidewalk: 'Vereda',
  kerb: 'Cordón',
  crossing: 'Cruce',
};

/** El estado del obstáculo en una palabra, derivado de la fecha y no de un booleano. */
export function obstacleStateLabel(obstacle: ObstacleFeature): string {
  return obstacle.properties.resolved_at === null ? 'Activo' : 'Resuelto';
}
