/**
 * `GET /api/graph`: el grafo peatonal de un área y las áreas de servicio activas
 * ([14](../../docs/14-la-api-del-grafo.md)).
 *
 * Los tipos salen de `schema.d.ts`, generado desde `/api/openapi.json`: acá no
 * se escribe a mano ninguna forma de la respuesta
 * ([15 §2](../../docs/15-integracion-con-el-cliente.md)).
 */

import type { BBox } from '@/config';
import { apiGet, apiPatch } from './client';
import type { components } from './schema';

export type GraphFeatureCollection = components['schemas']['GraphFeatureCollection'];

/** El conjunto de áreas activas que viaja al lado de las features. */
export type ServiceAreaCollection = components['schemas']['ServiceAreaCollection'];

/** Una zona: un polígono con nombre, que el mapa dibuja como contexto. */
export type ServiceArea = ServiceAreaCollection['features'][number];

export type GraphFeature = GraphFeatureCollection['features'][number];

/** Un elemento suelto: la respuesta del `PATCH` y la misma forma que una feature. */
export type GraphElement = components['schemas']['GraphElement'];

/** La clase del elemento, tal como viaja en la ruta del `PATCH`. */
export type ElementKind = GraphElement['properties']['element_kind'];

/**
 * El nivel de accesibilidad tal como se guardó: `null` es "nadie lo relevó"
 * ([09 §4.1](../../docs/09-modelo-de-datos.md)).
 */
export type GraphLevel = GraphFeature['properties']['level'];

/** El bbox en el orden en que viaja en la URL: oeste,sur,este,norte. */
export function formatBBox(bbox: BBox): string {
  return [bbox.minLon, bbox.minLat, bbox.maxLon, bbox.maxLat].map(String).join(',');
}

/**
 * Redondea el bbox a 5 decimales (~1 m), que es la precisión con la que tiene
 * sentido pedir un área: dos paneos que terminan en el mismo lugar comparten
 * clave de query y no piden dos veces el mismo grafo.
 */
export function roundBBox(bbox: BBox): BBox {
  const round = (value: number) => Number(value.toFixed(5));

  return {
    minLon: round(bbox.minLon),
    minLat: round(bbox.minLat),
    maxLon: round(bbox.maxLon),
    maxLat: round(bbox.maxLat),
  };
}

/**
 * El prefijo de todas las claves del grafo. Invalidarlo invalida todas las áreas, que
 * es lo que hace falta después de escribir: sólo la que está en pantalla se vuelve a
 * pedir, las demás quedan marcadas ([16 §5.4](../../docs/16-el-portal.md)).
 */
export const GRAPH_QUERY_PREFIX = ['graph'] as const;

/**
 * La clave de la query del grafo. Es el prefijo más las cuatro coordenadas, así que
 * cada área tiene su entrada y dos paneos iguales comparten la misma.
 */
export function graphQueryKey(bbox: BBox) {
  return [
    ...GRAPH_QUERY_PREFIX,
    bbox.minLon,
    bbox.minLat,
    bbox.maxLon,
    bbox.maxLat,
  ] as const;
}

/**
 * Lee las veredas, los cruces y los cordones que intersecan el área, más las
 * áreas de servicio activas.
 *
 * `truncated` viene al lado de las features y no adentro: si es `true`, el área
 * tenía más de 2000 elementos y la respuesta está recortada ([14 §5.1]).
 * `service_areas` también: el área es contexto de la zona, no un elemento del
 * grafo, y por eso no la recorta el tope ni la filtra el bbox ([14 §5.2]).
 */
export async function readGraph(bbox: BBox): Promise<GraphFeatureCollection> {
  const query = new URLSearchParams({ bbox: formatBBox(bbox) });
  return apiGet<GraphFeatureCollection>(`/api/graph?${query.toString()}`);
}

/**
 * Cambia el nivel de un elemento y devuelve cómo quedó ([14 §7](../../docs/14-la-api-del-grafo.md)).
 *
 * `null` es "sin dato", y es una escritura como cualquier otra: el servidor baja el
 * nivel y desmarca la verificación en la misma escritura. `is_verified` no se manda.
 */
export async function updateElementLevel(
  kind: ElementKind,
  id: number,
  level: GraphLevel,
): Promise<GraphElement> {
  return apiPatch<GraphElement>(`/api/graph/elements/${kind}/${id}`, { level });
}
