import type { Kysely } from 'kysely';
import type { AccessibilityLevel, DB } from '../db/types.js';
import { ERROR_CODES } from '../http/error-codes.js';
import { HttpError } from '../http/errors.js';
import { findGraphFeatures, updateElementLevel, type GraphFeatureRow } from './graph.sql.js';
import {
  graphResponseSchema,
  lineStringGeometrySchema,
  pointGeometrySchema,
  type BBox,
  type ElementKind,
  type GraphElement,
  type GraphFeature,
  type GraphResponse,
} from './graph.schemas.js';

/**
 * El tope de features de una respuesta.
 *
 * El piloto entero son ~1000 features, así que en la práctica no se llega; el número está
 * para que un bbox enorme no arme una respuesta de decenas de megabytes. Cuando se supera,
 * la respuesta lo dice en `truncated` en vez de mentir sobre el recorte
 * ([14 §5](../../../docs/14-la-api-del-grafo.md)).
 */
const MAX_FEATURES = 2000;

/**
 * Lee el grafo de un área, como `FeatureCollection`.
 *
 * Sólo lee: no hay caché ni nada que recordar entre pedidos, así que dos pedidos iguales
 * devuelven lo mismo mientras el dato no cambie
 * ([14 §1](../../../docs/14-la-api-del-grafo.md)). Una `FeatureCollection` vacía es una
 * respuesta válida: el área no tiene grafo, no es un error.
 */
export async function readGraph(db: Kysely<DB>, bbox: BBox): Promise<GraphResponse> {
  // Se pide una de más para distinguir "entraron justo 2000" de "había más".
  const rows = await findGraphFeatures(db, bbox, MAX_FEATURES + 1);
  const truncated = rows.length > MAX_FEATURES;

  return graphResponseSchema.parse({
    type: 'FeatureCollection',
    truncated,
    features: (truncated ? rows.slice(0, MAX_FEATURES) : rows).map(toFeature),
  });
}

/**
 * Escribe el nivel de un elemento del grafo y lo devuelve como quedó.
 *
 * Es la escritura de la edición manual ([14 §7](../../../docs/14-la-api-del-grafo.md)):
 * una sola tabla, y el costo del ruteo cambia solo porque se deriva de la vista
 * ([09 §4.7](../../../docs/09-modelo-de-datos.md)). `is_verified` lo decide la base a
 * partir del nivel: el portal no puede escribir un nivel sin verificar.
 *
 * Un id que no existe es `NOT_FOUND`: para quien pregunta, ese elemento del grafo no
 * está, sin importar que el número exista en otra tabla.
 */
export async function updateGraphElement(
  db: Kysely<DB>,
  kind: ElementKind,
  id: number,
  level: AccessibilityLevel | null,
): Promise<GraphElement> {
  const row = await updateElementLevel(db, kind, id, level);

  if (row === null) {
    throw new HttpError(
      404,
      ERROR_CODES.NOT_FOUND,
      `graph element ${kind} ${id} not found`,
    );
  }

  return toFeature(row);
}

/** Una fila del grafo, con la forma que tiene en la respuesta. */
function toFeature(row: GraphFeatureRow): GraphFeature {
  const geometry: unknown = JSON.parse(row.geometry);

  const properties = {
    element_id: row.elementId,
    level: row.level,
    is_verified: row.isVerified,
  };

  switch (row.elementKind) {
    case 'sidewalk':
      return {
        type: 'Feature',
        geometry: lineStringGeometrySchema.parse(geometry),
        properties: {
          element_kind: 'sidewalk',
          ...properties,
          street_name: row.streetName,
        },
      };
    case 'crossing':
      return {
        type: 'Feature',
        geometry: lineStringGeometrySchema.parse(geometry),
        properties: { element_kind: 'crossing', ...properties },
      };
    case 'kerb':
      return {
        type: 'Feature',
        geometry: pointGeometrySchema.parse(geometry),
        properties: { element_kind: 'kerb', ...properties },
      };
  }
}
