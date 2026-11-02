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

/** La forma de la respuesta de error, para que el `OpenAPI` la documente. */
export const errorResponseSchema = z
  .object({
    error: z.object({
      code: z.string(),
      details: z.array(z.record(z.string(), z.string())).optional(),
    }),
  })
  .meta({ id: 'ErrorResponse' });

/**
 * Traduce los problemas de Zod a los `details` del catálogo de errores
 * ([04 §4](../../../docs/04-errores-y-mensajes.md)).
 *
 * Dos motivos alcanzan para una entrada que son dos puntos: falta un campo, o el valor
 * no sirve. Distinguir "no es un número" de "está fuera de rango" no le cambia nada al
 * cliente, que en los dos casos pide revisar el dato.
 *
 * Si el campo falta se decide mirando el cuerpo, no el error: Zod v4 no dice si el valor
 * estaba ausente o presente pero inválido, y el `details` sí tiene que decirlo.
 */
export function validationDetails(
  error: z.ZodError,
  body: unknown,
): { field: string; code: string }[] {
  return error.issues.map((issue) => ({
    field: issue.path.length === 0 ? 'body' : issue.path.map(String).join('.'),
    code: valueAt(body, issue.path) === undefined ? 'REQUIRED' : 'INVALID',
  }));
}

/** El valor del cuerpo en la ruta que reportó Zod, para saber si falta. */
function valueAt(body: unknown, path: readonly PropertyKey[]): unknown {
  let current = body;

  for (const key of path) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[String(key)];
  }

  return current;
}
