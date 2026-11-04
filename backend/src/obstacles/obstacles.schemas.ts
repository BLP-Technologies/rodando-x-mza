import { z } from "zod";
import { pointGeometrySchema } from "../graph/graph.schemas.js";

/**
 * El contrato de la API de obstáculos, en esquemas Zod.
 *
 * Es la única fuente: de acá salen los tipos que usa el backend, el `OpenAPI`
 * ([02 §6](../../../docs/02-stack-y-estructura.md)) y la validación del pedido. La forma
 * de la respuesta está decidida en [18](../../../docs/18-la-api-de-obstaculos.md), no en
 * este archivo.
 */

/**
 * La severidad que decide el moderador: los tres valores de `obstacle_severity`.
 *
 * Es el mismo enum que el de la severidad de un reporte ([17 §2](../../../docs/17-la-api-de-reportes.md))
 * y se escribe como enum propio por la misma razón que el nivel del grafo se repite en
 * ruteo: cada contrato declara los valores que acepta, y la fuente común es la columna.
 */
export const obstacleSeveritySchema = z.enum(["MINOR", "MODERATE", "CRITICAL"]);

export type ObstacleSeverity = z.infer<typeof obstacleSeveritySchema>;

/**
 * El filtro de la lectura, con `ACTIVE` por defecto.
 *
 * Un obstáculo activo es el que tiene `resolved_at IS NULL`
 * ([09 §4.5 y §4.7](../../../docs/09-modelo-de-datos.md)); `ALL` existe para que el portal
 * pueda mostrar, en la ficha de un elemento, lo que le pasó y no sólo lo que le pasa.
 */
export const obstacleStatusFilterSchema = z.enum(["ACTIVE", "RESOLVED", "ALL"]);

export type ObstacleStatusFilter = z.infer<typeof obstacleStatusFilterSchema>;

/**
 * El pedido de `GET /api/obstacles` ([18 §4](../../../docs/18-la-api-de-obstaculos.md)).
 *
 * Estricto, como la lectura de reportes: un parámetro mal escrito (`?estado=ACTIVE`) es un
 * 400 que lo nombra, no un silencio que devuelve todo como si el filtro se hubiera
 * aplicado. Por eso la ruta valida `req.query` tal cual llega.
 */
export const obstaclesQuerySchema = z.strictObject({
  status: obstacleStatusFilterSchema.default("ACTIVE"),
});

/**
 * El pedido de alta de un obstáculo.
 *
 * No hay `element` en el cuerpo: el vínculo con el elemento del grafo lo decide el
 * servidor pegando el punto al más cercano ([18 §3](../../../docs/18-la-api-de-obstaculos.md)).
 *
 * `type` es el **código** del catálogo `obstacle_types` y no su `id`: el catálogo vive en
 * la base y lo resuelve el SQL, así que un código inexistente, inactivo o `OTHER` se
 * rechaza ahí y no contra una lista copiada en el esquema.
 */
export const createObstacleRequestSchema = z
  .strictObject({
    type: z.string(),
    severity: obstacleSeveritySchema,
    geom: z.object({
      lon: z.number().min(-180).max(180),
      lat: z.number().min(-90).max(90),
    }),
  })
  .meta({
    id: "CreateObstacleRequest",
    description:
      "Un obstáculo publicado por el moderador. Sin `element`: el servidor lo asocia al " +
      "elemento del grafo más cercano al punto.",
    example: {
      type: "POTHOLE",
      severity: "MODERATE",
      geom: { lon: -68.8444, lat: -32.8897 },
    },
  });

export type CreateObstacleRequest = z.infer<typeof createObstacleRequestSchema>;

/** Un tipo del catálogo, tal como lo necesita el formulario del portal. */
const obstacleTypeSchema = z.object({
  code: z.string(),
  name: z.string(),
});

/**
 * La clase del elemento al que quedó pegado un obstáculo.
 *
 * Son los nombres que ya usa una feature del grafo (`sidewalk`, `kerb`, `crossing`), no los
 * de las tablas: el cliente compara un obstáculo con el elemento que ya tiene en la mano
 * ([14 §5](../../../docs/14-la-api-del-grafo.md)).
 */
export const obstacleElementKindSchema = z.enum([
  "sidewalk",
  "kerb",
  "crossing",
]);

export type ObstacleElementKind = z.infer<typeof obstacleElementKindSchema>;

/**
 * Un obstáculo leído, como `Feature` de GeoJSON.
 *
 * La geometría es el **punto que mandó el cliente**, no el del elemento al que se pegó: el
 * pegamento decide el vínculo y no mueve el pin. Los diez campos de `properties` no son un
 * reflejo de la tabla ([09 §4.5](../../../docs/09-modelo-de-datos.md)):
 *
 * - `type` es el código del catálogo, para el cliente; `type_name` es el nombre en español,
 *   para la persona que modera.
 * - `resolved_at` es la fecha de resolución, o `null` si sigue activo. Es el único dato de
 *   estado: no hay un booleano al lado.
 * - `element_kind` y `element_id` traducen las tres columnas del vínculo a un par, para que
 *   el cliente lo compare sin saber cuál de las tres está escrita.
 * - `reports_count` cuenta los reportes que lo apuntan, sin bajas ni rechazados.
 * - `created_at` viaja en ISO para que el cliente no tenga que interpretar la zona horaria
 *   del driver.
 */
export const obstacleFeatureSchema = z
  .object({
    type: z.literal("Feature"),
    geometry: pointGeometrySchema,
    properties: z.object({
      id: z.number().int(),
      type: z.string(),
      type_name: z.string(),
      severity: obstacleSeveritySchema,
      resolved_at: z.string().nullable(),
      element_kind: obstacleElementKindSchema,
      element_id: z.number().int(),
      reports_count: z.number().int(),
      created_at: z.string(),
    }),
  })
  .meta({ id: "ObstacleFeature" });

export type ObstacleFeature = z.infer<typeof obstacleFeatureSchema>;

/**
 * La respuesta de `GET /api/obstacles`: una `FeatureCollection` con el aviso de recorte al
 * lado de `type`, igual que el grafo.
 *
 * `obstacle_types` es hermano de `features` y no una feature más, por el mismo criterio que
 * `service_areas`: no es un obstáculo, no lo recorta el tope y el formulario lo necesita
 * entero. Va en la misma respuesta para que el portal no copie el catálogo en el cliente ni
 * haga un segundo viaje ([18 §4](../../../docs/18-la-api-de-obstaculos.md)).
 */
export const obstaclesResponseSchema = z
  .object({
    type: z.literal("FeatureCollection"),
    truncated: z.boolean(),
    obstacle_types: z.array(obstacleTypeSchema),
    features: z.array(obstacleFeatureSchema),
  })
  .meta({ id: "ObstacleFeatureCollection" });

export type ObstaclesResponse = z.infer<typeof obstaclesResponseSchema>;

/** Los parámetros de `/api/obstacles/:id`; el `id` llega como texto. */
export const obstacleParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});
