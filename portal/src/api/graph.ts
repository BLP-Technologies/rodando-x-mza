/**
 * `GET /api/graph`: el grafo peatonal de un área
 * ([14](../../docs/14-la-api-del-grafo.md)).
 *
 * Los tipos salen de `schema.d.ts`, generado desde `/api/openapi.json`: acá no
 * se escribe a mano ninguna forma de la respuesta
 * ([15 §2](../../docs/15-integracion-con-el-cliente.md)).
 */

import type { BBox } from '@/config';
import { apiGet } from './client';
import type { components } from './schema';

export type GraphFeatureCollection = components['schemas']['GraphFeatureCollection'];

export type GraphFeature = GraphFeatureCollection['features'][number];

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
 * Lee las veredas, los cruces y los cordones que intersecan el área.
 *
 * `truncated` viene al lado de las features y no adentro: si es `true`, el área
 * tenía más de 2000 elementos y la respuesta está recortada ([14 §5.1]).
 */
export async function readGraph(bbox: BBox): Promise<GraphFeatureCollection> {
  const query = new URLSearchParams({ bbox: formatBBox(bbox) });
  return apiGet<GraphFeatureCollection>(`/api/graph?${query.toString()}`);
}
