import { z } from 'zod';

/**
 * El contrato de `POST /api/routes/calculate`, en esquemas Zod.
 *
 * Es la única fuente: de acá salen los tipos que usa el backend, el `OpenAPI`
 * ([02 §6](../../../docs/02-stack-y-estructura.md)) y la validación del pedido. La forma
 * de la respuesta está decidida en
 * [13](../../../docs/13-api-de-ruteo.md), no en este archivo.
 */

/** Un punto en WGS 84. `lat` y `lon` van por nombre: el par anónimo se confunde. */
const coordinateSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});

export const routeRequestSchema = z
  .object({
    origin: coordinateSchema,
    destination: coordinateSchema,
  })
  .meta({
    id: 'RouteRequest',
    description: 'Origen y destino del recorrido, en coordenadas.',
    example: {
      origin: { lat: -32.889727, lon: -68.844499 },
      destination: { lat: -32.89296, lon: -68.842028 },
    },
  });

export type RouteRequest = z.infer<typeof routeRequestSchema>;

/**
 * La geometría de un tramo, como la devuelve `ST_AsGeoJSON`.
 *
 * Sale de la base como texto, así que se valida antes de entrar al tipado: es el borde
 * donde el repositorio pide Zod y no una aserción ([02 §4](../../../docs/02-stack-y-estructura.md)).
 */
export const lineStringSchema = z.object({
  type: z.literal('LineString'),
  coordinates: z.array(z.tuple([z.number(), z.number()])),
});

/** El cordón al que se pegó una punta, y a cuántos metros quedó del punto pedido. */
const endpointSchema = z
  .object({
    node: z.object({
      id: z.number().int(),
      lat: z.number(),
      lon: z.number(),
    }),
    distance_m: z.number(),
  })
  .meta({ id: 'RouteEndpoint' });

/** Un tramo del recorrido: el elemento del grafo, su nivel y su geometría. */
const legSchema = z
  .object({
    element_kind: z.enum(['sidewalk', 'crossing']),
    element_id: z.number().int(),
    level: z.enum(['FULL', 'PARTIAL', 'NONE']).nullable(),
    is_verified: z.boolean(),
    meters: z.number(),
    geometry: lineStringSchema,
  })
  .meta({ id: 'RouteLeg' });

/** Lo que hace falta para mostrar el recorrido sin recorrer los tramos uno por uno. */
const summarySchema = z
  .object({
    meters: z.number(),
    cost: z.number(),
    crossings: z.number().int(),
    unverified_meters: z.number(),
  })
  .meta({ id: 'RouteSummary' });

/**
 * La respuesta es una unión discriminada por `found`: no hay recorrido no es un error,
 * así que las dos formas salen con 200 ([13 §6](../../../docs/13-api-de-ruteo.md)).
 */
export const routeResponseSchema = z
  .discriminatedUnion('found', [
    z.object({
      found: z.literal(true),
      origin: endpointSchema,
      destination: endpointSchema,
      summary: summarySchema,
      legs: z.array(legSchema),
    }),
    z.object({
      found: z.literal(false),
      origin: endpointSchema,
      destination: endpointSchema,
    }),
  ])
  .meta({ id: 'RouteResponse' });

export type RouteResponse = z.infer<typeof routeResponseSchema>;
export type RouteLeg = z.infer<typeof legSchema>;
export type RouteSummary = z.infer<typeof summarySchema>;
