import { z } from 'zod';

/**
 * El contrato de `GET /api/graph`, en esquemas Zod.
 *
 * Es la única fuente: de acá salen los tipos que usa el backend, el `OpenAPI`
 * ([02 §6](../../../docs/02-stack-y-estructura.md)) y la validación del pedido. La forma
 * de la respuesta está decidida en [14](../../../docs/14-la-api-del-grafo.md), no en este
 * archivo.
 */

/** Las cuatro esquinas del bbox, ya en números y en el orden en que viajan en la URL. */
export type BBox = { minLon: number; minLat: number; maxLon: number; maxLat: number };

/**
 * Lee `minLon,minLat,maxLon,maxLat`.
 *
 * Devuelve `null` si no sirve por cualquiera de los motivos: no son cuatro números,
 * alguna coordenada está fuera de rango, o las esquinas están invertidas. Todos terminan
 * en el mismo `INVALID` porque para el cliente son el mismo problema: el `bbox` que
 * mandó no sirve ([14 §6](../../../docs/14-la-api-del-grafo.md)).
 */
function parseBbox(raw: string): BBox | null {
  const parts = raw.split(',').map((part) => part.trim());

  // `Number('')` es 0, así que una parte vacía pasaría el filtro de abajo sin este chequeo.
  if (
    parts.length !== 4 ||
    parts.some((part) => part === '' || !Number.isFinite(Number(part)))
  ) {
    return null;
  }

  const [minLon, minLat, maxLon, maxLat] = parts.map(Number);
  if (
    minLon === undefined ||
    minLat === undefined ||
    maxLon === undefined ||
    maxLat === undefined
  ) {
    return null;
  }

  if (minLon < -180 || maxLon > 180 || minLat < -90 || maxLat > 90) return null;

  // Un bbox de área cero no devuelve nada y es casi siempre un error de quien lo arma.
  if (minLon >= maxLon || minLat >= maxLat) return null;

  return { minLon, minLat, maxLon, maxLat };
}

/**
 * El parámetro tal como viaja en la URL. Es lo que se publica en el `OpenAPI`; el pedido
 * validado, con las cuatro esquinas ya separadas, es `graphQuerySchema`.
 */
export const bboxParamSchema = z.string().meta({
  id: 'GraphBBox',
  description:
    'Área a leer, como `minLon,minLat,maxLon,maxLat` en WGS 84: oeste,sur,este,norte. ' +
    'Las esquinas invertidas, un valor fuera de rango o una cantidad de números distinta ' +
    'de cuatro se rechazan con 400.',
  example: '-68.8472,-32.8937,-68.8420,-32.8897',
});

/** El pedido de `GET /api/graph`, validado y convertido a las cuatro esquinas. */
export const graphQuerySchema = z.object({
  bbox: bboxParamSchema.transform((raw, ctx) => {
    const bbox = parseBbox(raw);

    if (bbox === null) {
      ctx.addIssue({
        code: 'custom',
        message: 'bbox must be four comma-separated coordinates, in range and coherent',
      });
      return z.NEVER;
    }

    return bbox;
  }),
});

/**
 * La geometría de un elemento del grafo, como la devuelve `ST_AsGeoJSON`.
 *
 * Sale de la base como texto, así que se valida antes de entrar al tipado: es el borde
 * donde el repositorio pide Zod y no una aserción ([02 §4](../../../docs/02-stack-y-estructura.md)).
 * El orden de las coordenadas es `[lon, lat]`, el de GeoJSON y el inverso al del pedido
 * de [13 §3](../../../docs/13-api-de-ruteo.md).
 */
export const pointGeometrySchema = z.object({
  type: z.literal('Point'),
  coordinates: z.tuple([z.number(), z.number()]),
});

export const lineStringGeometrySchema = z.object({
  type: z.literal('LineString'),
  coordinates: z.array(z.tuple([z.number(), z.number()])),
});

/**
 * La geometría de un área de servicio: un polígono, también en orden `[lon, lat]`.
 *
 * Existe aparte de la línea porque el área es una sola pieza y su tipo no se negocia al
 * dibujar ([14 §5.2](../../../docs/14-la-api-del-grafo.md)).
 */
export const polygonGeometrySchema = z.object({
  type: z.literal('Polygon'),
  coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))),
});

/**
 * Un área de servicio activa, con el `id` como clave estable y el nombre que la operación
 * ya usa ([09 §4.8](../../../docs/09-modelo-de-datos.md)).
 *
 * El `id` viaja acá y no es sólo interno: es lo que el mapa usa para identificar el
 * área entre dos respuestas, y es el hueco que cerraba la lectura.
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
 * `GraphElement`: el cliente necesita el tipo del conjunto y el de la feature sin
 * traducir entre dos formas del mismo dato.
 */
export const serviceAreasCollectionSchema = z
  .object({
    type: z.literal('FeatureCollection'),
    features: z.array(serviceAreaFeatureSchema),
  })
  .meta({ id: 'ServiceAreaCollection' });

/** El nivel de accesibilidad de un elemento; `null` es "nadie lo relevó" ([09 §4.1]). */
export const graphLevelSchema = z.enum(['FULL', 'PARTIAL', 'NONE']).nullable();

/** Una vereda: la única clase que tiene nombre de calle. */
const sidewalkFeatureSchema = z.object({
  type: z.literal('Feature'),
  geometry: lineStringGeometrySchema,
  properties: z.object({
    element_kind: z.literal('sidewalk'),
    element_id: z.number().int(),
    level: graphLevelSchema,
    is_verified: z.boolean(),
    street_name: z.string().nullable(),
  }),
});

/** Un cruce peatonal: una línea sobre la calzada. */
const crossingFeatureSchema = z.object({
  type: z.literal('Feature'),
  geometry: lineStringGeometrySchema,
  properties: z.object({
    element_kind: z.literal('crossing'),
    element_id: z.number().int(),
    level: graphLevelSchema,
    is_verified: z.boolean(),
  }),
});

/** Un cordón: un punto, el vértice donde se juntan las aristas. */
const kerbFeatureSchema = z.object({
  type: z.literal('Feature'),
  geometry: pointGeometrySchema,
  properties: z.object({
    element_kind: z.literal('kerb'),
    element_id: z.number().int(),
    level: graphLevelSchema,
    is_verified: z.boolean(),
  }),
});

/**
 * Un elemento del grafo. La clase decide la geometría y, en la vereda, el nombre de calle:
 * no hay un `street_name` que en los cruces diga `null` por no aplicarse.
 *
 * Tiene nombre propio en OpenAPI (`GraphElement`) porque es a la vez una feature de la
 * `FeatureCollection` y la respuesta del `PATCH` de un elemento ([14 §7]): un solo
 * componente para las dos caras evita que el cliente traduzca entre dos formas del
 * mismo dato.
 */
export const graphElementSchema = z
  .union([sidewalkFeatureSchema, crossingFeatureSchema, kerbFeatureSchema])
  .meta({ id: 'GraphElement' });

/**
 * La respuesta: una `FeatureCollection` de GeoJSON, con un aviso propio si se recortó.
 *
 * `truncated` no es parte de GeoJSON y va al lado de `type` justamente para que el
 * recorte se vea sin abrir las features ([14 §5](../../../docs/14-la-api-del-grafo.md)).
 *
 * `service_areas` es hermano de `type` y no una feature más porque un área de servicio
 * no es un elemento del grafo: no la recorta el tope, no la filtra el bbox y el dibujo la
 * trata distinto ([14 §5.2](../../../docs/14-la-api-del-grafo.md)).
 */
export const graphResponseSchema = z
  .object({
    type: z.literal('FeatureCollection'),
    truncated: z.boolean(),
    service_areas: serviceAreasCollectionSchema,
    features: z.array(graphElementSchema),
  })
  .meta({ id: 'GraphFeatureCollection' });

export type GraphElement = z.infer<typeof graphElementSchema>;
export type GraphFeature = GraphElement;
export type GraphResponse = z.infer<typeof graphResponseSchema>;
export type ServiceAreaFeature = GraphResponse['service_areas']['features'][number];

/**
 * La clase de un elemento del grafo, tal como viaja en la ruta del `PATCH`.
 *
 * Es un enum cerrado y no un texto libre: una clase desconocida es un pedido que la API
 * no ofrece, no un recurso que falta ([14 §6]).
 */
export const elementKindSchema = z.enum(['sidewalk', 'crossing', 'kerb']).meta({
  id: 'GraphElementKind',
});

export type ElementKind = z.infer<typeof elementKindSchema>;

/** Los parámetros de `/api/graph/elements/:kind/:id`; el `id` llega como texto. */
export const graphElementParamsSchema = z.object({
  kind: elementKindSchema,
  id: z.coerce.number().int().positive(),
});

/**
 * El cuerpo del `PATCH` de un elemento ([14 §7]).
 *
 * `level` es **obligatorio y nullable**: el cuerpo tiene un solo campo, así que no hay
 * forma de distinguir "no lo mandé" de "lo mando en `null`" — y esa distinción es
 * justamente la que no puede quedar librada a una omisión, porque `null` borra el nivel
 * y desmarca la verificación. Omitirlo es un error, no un "no toques nada".
 *
 * Es estricto a propósito: `is_verified` no se manda, lo pone el servidor en la misma
 * escritura. Aceptarlo y descartarlo dejaría creyendo al cliente que puede decidirlo.
 */
export const updateGraphElementBodySchema = z
  .strictObject({ level: graphLevelSchema })
  .meta({ id: 'UpdateGraphElementRequest' });
