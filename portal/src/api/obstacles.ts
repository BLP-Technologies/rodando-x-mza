/**
 * La API de obstáculos: la lectura, el alta, la resolución y la moderación de un reporte
 * ([18](../../docs/18-la-api-de-obstaculos.md)).
 *
 * Las cinco funciones viven juntas porque son el mismo trabajo del moderador —publicar o
 * cerrar una barrera—, aunque las dos últimas escriban en `reports`: aprobar un reporte es
 * crear un obstáculo ([17 §7](../../docs/17-la-api-de-reportes.md)).
 *
 * Los tipos salen de `schema.d.ts`, generado desde `/api/openapi.json`: acá no se escribe a
 * mano ninguna forma de la respuesta ([15 §2](../../docs/15-integracion-con-el-cliente.md)).
 */

import { apiGet, apiPost } from './client';
import type { components, paths } from './schema';

/** La colección que devuelve la lectura, con el catálogo de tipos y el aviso de recorte. */
export type ObstacleFeatureCollection = components['schemas']['ObstacleFeatureCollection'];

/** Un obstáculo, con su punto y sus nueve propiedades. */
export type ObstacleFeature = components['schemas']['ObstacleFeature'];

/**
 * El filtro de la lectura: activos, resueltos o todos.
 *
 * Sale del parámetro generado y no se escribe a mano: el enum es del contrato y una copia
 * acá se desincroniza el día que se agregue un estado.
 */
export type ObstacleStatusFilter = NonNullable<
  NonNullable<paths['/api/obstacles']['get']['parameters']['query']>['status']
>;

/** Un tipo del catálogo, como lo necesita el formulario. */
export type ObstacleType = ObstacleFeatureCollection['obstacle_types'][number];

/** El alta de un obstáculo, sin el elemento: lo decide el servidor. */
export type CreateObstacleRequest = components['schemas']['CreateObstacleRequest'];

export type ObstacleSeverity = ObstacleFeature['properties']['severity'];

export type ObstacleElementKind = ObstacleFeature['properties']['element_kind'];

/** La clasificación con la que el moderador publica el obstáculo de un reporte. */
export type ApproveReportRequest = components['schemas']['ApproveReportRequest'];

/** La respuesta de la aprobación: el obstáculo creado y el reporte marcado. */
export type ApproveReportResponse = components['schemas']['ApproveReportResponse'];

/** El reporte después de una decisión: su estado nuevo y el obstáculo que nombra. */
export type ReportDecision = components['schemas']['ReportDecision'];

/**
 * El prefijo de todas las claves de obstáculos.
 *
 * Sirve para invalidar la lectura entera después de crear o resolver, igual que `['graph']`
 * después de guardar un nivel ([16 §8](../../docs/16-el-portal.md)).
 */
export const OBSTACLES_QUERY_PREFIX = ['obstacles'] as const;

/**
 * La clave de la query: el prefijo más el estado.
 *
 * El estado es el filtro del servidor, así que pedir otro estado es pedir otra entrada de
 * caché. La pantalla de obstáculos y la ficha del elemento comparten la de `ALL` cuando
 * miran lo mismo.
 */
export function obstacleQueryKey(status: ObstacleStatusFilter) {
  return [...OBSTACLES_QUERY_PREFIX, status] as const;
}

/**
 * Lee los obstáculos de un estado, con el catálogo de tipos que el formulario necesita.
 *
 * El catálogo llega en la misma respuesta que las features —`obstacle_types`, hermano de
 * `features`— para que el cliente no tenga que copiarlo ni hacer un segundo viaje
 * ([18 §4](../../docs/18-la-api-de-obstaculos.md)).
 */
export async function readObstacles(
  status: ObstacleStatusFilter,
): Promise<ObstacleFeatureCollection> {
  const query = new URLSearchParams({ status });
  return apiGet<ObstacleFeatureCollection>(`/api/obstacles?${query.toString()}`);
}

/**
 * Crea un obstáculo y devuelve cómo quedó, con la misma forma que una feature de la lectura.
 *
 * Si no hay ningún elemento del grafo cerca del punto, la API responde `VALIDATION_ERROR` con
 * el motivo de dominio `NO_NEARBY_ELEMENT` y no escribe nada
 * ([18 §3](../../docs/18-la-api-de-obstaculos.md)).
 */
export async function createObstacle(
  input: CreateObstacleRequest,
): Promise<ObstacleFeature> {
  return apiPost<ObstacleFeature>('/api/obstacles', input);
}

/**
 * Resuelve un obstáculo y devuelve cómo quedó.
 *
 * No lleva cuerpo y es idempotente: resolver uno ya resuelto no es un error
 * ([18 §5](../../docs/18-la-api-de-obstaculos.md)).
 */
export async function resolveObstacle(id: number): Promise<ObstacleFeature> {
  return apiPost<ObstacleFeature>(`/api/obstacles/${id}/resolve`);
}

/**
 * Aprueba un reporte: crea el obstáculo con el punto del reporte y lo marca `APPROVED`.
 *
 * El cuerpo es sólo la clasificación: aprobar no mueve el pin
 * ([18 §6](../../docs/18-la-api-de-obstaculos.md)).
 */
export async function approveReport(
  id: number,
  decision: ApproveReportRequest,
): Promise<ApproveReportResponse> {
  return apiPost<ApproveReportResponse>(`/api/reports/${id}/approve`, decision);
}

/** Descarta un reporte sin crear nada. */
export async function rejectReport(id: number): Promise<ReportDecision> {
  return apiPost<ReportDecision>(`/api/reports/${id}/reject`);
}
