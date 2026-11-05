import type { Kysely } from 'kysely';
import type { DB } from '../db/types.js';
import {
  polygonGeometrySchema,
  serviceAreasCollectionSchema,
  type ServiceAreaFeature,
  type ServiceAreasCollection,
} from './service-areas.schemas.js';
import { findActiveServiceAreas, type ServiceAreaRow } from './service-areas.sql.js';

/**
 * Las áreas de servicio activas, como `FeatureCollection`.
 *
 * **Es el único lugar donde se arma la colección.** La usan las dos respuestas que la
 * llevan: `GET /api/service-areas`, que es la del mobile, y el campo `service_areas` de
 * `GET /api/graph`, que es la del portal, que ya pide el grafo
 * ([14 §5.2](../../../docs/14-la-api-del-grafo.md)). Con una sola función, las dos no
 * pueden separarse: es el mismo dato y no tiene dos verdades.
 *
 * Sólo lee: no hay caché ni nada que recordar entre pedidos, así que dos pedidos iguales
 * devuelven lo mismo mientras el dato no cambie ([14 §1](../../../docs/14-la-api-del-grafo.md)).
 * Una base sin área activa devuelve una colección vacía, que es una respuesta válida: el
 * grafo y el ruteo se comportan distinto, pero acá no es un error.
 */
export async function readServiceAreas(db: Kysely<DB>): Promise<ServiceAreasCollection> {
  const rows = await findActiveServiceAreas(db);

  return serviceAreasCollectionSchema.parse({
    type: 'FeatureCollection',
    features: rows.map(toServiceAreaFeature),
  });
}

/**
 * Un área de servicio, con la forma que tiene en la respuesta.
 *
 * Misma regla del borde que `toFeature` del grafo: el GeoJSON sale de la base como texto y
 * se valida antes de entrar al tipado, en vez de afirmarlo.
 */
function toServiceAreaFeature(row: ServiceAreaRow): ServiceAreaFeature {
  const geometry: unknown = JSON.parse(row.geometry);

  return {
    type: 'Feature',
    geometry: polygonGeometrySchema.parse(geometry),
    properties: { id: row.id, name: row.name },
  };
}
