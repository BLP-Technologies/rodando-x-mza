/**
 * `GET /api/reports`: la lectura de reportes ciudadanos de un estado
 * ([17 §7](../../docs/17-la-api-de-reportes.md)).
 *
 * Los tipos salen de `schema.d.ts`, generado desde `/api/openapi.json`: acá no se
 * escribe a mano ninguna forma de la respuesta
 * ([15 §2](../../docs/15-integracion-con-el-cliente.md)).
 */

import { apiGet } from './client';
import type { components } from './schema';

/** La colección que devuelve la lectura, con el aviso de recorte al lado de `type`. */
export type ReportFeatureCollection = components['schemas']['ReportFeatureCollection'];

/** Un reporte, con su punto y sus ocho propiedades. */
export type ReportFeature = components['schemas']['ReportFeature'];

/** El estado dentro del ciclo de moderación: los cinco del enum de la base. */
export type ReportStatus = components['schemas']['ReportStatus'];

/**
 * El prefijo de todas las claves de reportes.
 *
 * Sirve para invalidar la lista cuando la moderación escriba (#47), igual que
 * `['graph']` después de guardar un nivel ([16 §8](../../docs/16-el-portal.md)).
 */
export const REPORTS_QUERY_PREFIX = ['reports'] as const;

/**
 * La clave de la query: el prefijo más el estado.
 *
 * El estado es el filtro del servidor, así que pedir otro estado es pedir otra entrada
 * de caché y no hay que coordinar nada a mano.
 */
export function reportQueryKey(status: ReportStatus) {
  return [...REPORTS_QUERY_PREFIX, status] as const;
}

/**
 * Lee los reportes de un estado, del más nuevo al más antiguo.
 *
 * `truncated` viene al lado de las features: si es `true`, había más de 2000 y la
 * respuesta trae sólo las más nuevas ([17 §7]).
 */
export async function readReports(
  status: ReportStatus,
): Promise<ReportFeatureCollection> {
  const query = new URLSearchParams({ status });
  return apiGet<ReportFeatureCollection>(`/api/reports?${query.toString()}`);
}
