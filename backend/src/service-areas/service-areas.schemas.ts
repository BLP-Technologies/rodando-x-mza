import { z } from 'zod';

/**
 * El contrato del área de servicio, en esquemas Zod.
 *
 * Vive en su propio módulo y no en el del grafo porque el área de servicio no es un
 * elemento del grafo: no la filtra el bbox, no la recorta el tope de 2000 y ahora tiene su
 * propio viaje en `GET /api/service-areas` ([14 §5.2](../../../docs/14-la-api-del-grafo.md)).
 *
 * El conjunto es el mismo objeto que anida la respuesta del grafo
 * ([`graphResponseSchema`](../graph/graph.schemas.ts)): una sola definición para las dos
 * respuestas, porque el dato que devuelven es el mismo y no puede tener dos verdades.
 */

/**
 * La geometría de un área de servicio: un polígono, en orden `[lon, lat]`.
 *
 * Es la que devuelve `ST_AsGeoJSON` y se valida antes de entrar al tipado, como la del
 * grafo. Existe aparte de la línea porque el área es una sola pieza y su tipo no se negocia
 * al dibujar ([14 §5.2](../../../docs/14-la-api-del-grafo.md)).
 */
export const polygonGeometrySchema = z.object({
  type: z.literal('Polygon'),
  coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))),
});

/**
 * Un área de servicio activa, con el `id` como clave estable y el nombre que la operación
 * ya usa ([09 §4.8](../../../docs/09-modelo-de-datos.md)).
 *
 * El `id` viaja acá y no es sólo interno: es lo que el mapa usa para identificar el área
 * entre dos respuestas.
 */
const serviceAreaFeatureSchema = z.object({
  type: z.literal('Feature'),
  geometry: polygonGeometrySchema,
  properties: z.object({
    id: z.number().int(),
    name: z.string(),
  }),
});

/**
 * Las áreas activas, como su propia `FeatureCollection`.
 *
 * Tiene nombre propio en OpenAPI (`ServiceAreaCollection`) por el mismo motivo que
 * `GraphElement`: el cliente necesita el tipo del conjunto y el de la feature sin traducir
 * entre dos formas del mismo dato. El nombre se registra una sola vez y lo usan las dos
 * respuestas, que anidan este mismo esquema.
 */
export const serviceAreasCollectionSchema = z
  .object({
    type: z.literal('FeatureCollection'),
    features: z.array(serviceAreaFeatureSchema),
  })
  .meta({ id: 'ServiceAreaCollection' });

export type ServiceAreasCollection = z.infer<typeof serviceAreasCollectionSchema>;
export type ServiceAreaFeature = ServiceAreasCollection['features'][number];
