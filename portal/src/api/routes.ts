/**
 * `POST /api/routes/calculate`: el recorrido accesible entre dos puntos
 * ([13](../../docs/13-api-de-ruteo.md)).
 *
 * Los tipos salen de `schema.d.ts`, generado desde `/api/openapi.json`: acá no se escribe a
 * mano ninguna forma de la respuesta ([15 §2](../../docs/15-integracion-con-el-cliente.md)).
 */

import { apiPost } from './client';
import type { components } from './schema';

/** El pedido: dos coordenadas con `lat` y `lon` por nombre, no un par anónimo ([13 §3]). */
export type RouteRequest = components['schemas']['RouteRequest'];

/**
 * La respuesta, que es una unión discriminada por `found`.
 *
 * `found: false` **no es un error**: es un pedido válido sin camino, y viene con 200
 * ([13 §6](../../docs/13-api-de-ruteo.md)). Por eso el tipo tiene dos ramas y no una con
 * campos opcionales: si no hay recorrido no hay `legs` ni `summary`, y leerlos por descuido
 * tiene que ser un error de compilación.
 */
export type RouteResponse = components['schemas']['RouteResponse'];

export type RouteLeg = components['schemas']['RouteLeg'];

/** Un punto en WGS 84, en el orden que usa la API (y no el de Leaflet). */
export type RoutePoint = RouteRequest['origin'];

/**
 * Pide un recorrido accesible entre dos puntos.
 *
 * Es un `POST` y no una lectura —el pedido lleva dos puntos en el cuerpo—, pero no escribe
 * nada: el portal lo pide como una mutación porque el disparador es un botón y porque el
 * resultado no se cachea, a diferencia del grafo ([16 §8.3](../../docs/16-el-portal.md)).
 */
export async function calculateRoute(request: RouteRequest): Promise<RouteResponse> {
  return apiPost<RouteResponse>('/api/routes/calculate', request);
}
