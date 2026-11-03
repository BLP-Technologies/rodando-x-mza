import { z } from 'zod';
import { pointGeometrySchema } from '../graph/graph.schemas.js';
import { obstacleFeatureSchema } from '../obstacles/obstacles.schemas.js';

/**
 * El contrato de `POST /api/reports` y el de la subida de imágenes, en esquemas
 * Zod.
 *
 * Es la única fuente: de acá salen los tipos que usa el backend, el `OpenAPI`
 * ([02 §6](../../../docs/02-stack-y-estructura.md)) y la validación del pedido.
 * La forma de la respuesta está decidida en
 * [17](../../../docs/17-la-api-de-reportes.md), no en este archivo.
 */

/** La severidad que percibió quien reporta: los tres valores del enum de la base. */
export const reportSeveritySchema = z.enum(['MINOR', 'MODERATE', 'CRITICAL']);

export type ReportSeverity = z.infer<typeof reportSeveritySchema>;

/**
 * El estado del reporte dentro del ciclo de moderación (#47).
 *
 * El `POST` siempre lo crea en `PENDING`; el enum completo es el de la columna,
 * porque es lo que una lectura del recurso tiene que poder describir.
 */
export const reportStatusSchema = z
  .enum(['PENDING', 'APPROVED', 'UNDER_REPAIR', 'RESOLVED', 'REJECTED'])
  .meta({
    id: 'ReportStatus',
    description:
      'El estado del reporte dentro del ciclo de moderación. El POST siempre lo crea ' +
      'en PENDING.',
  });

/**
 * Un punto en WGS 84, con el mismo rango que el bbox del grafo.
 *
 * `lon` y `lat` van por nombre, igual que en el pedido de ruteo
 * ([13 §3](../../../docs/13-api-de-ruteo.md)): el par anónimo se confunde.
 */
const reportPointSchema = z.object({
  lon: z.number().min(-180).max(180),
  lat: z.number().min(-90).max(90),
});

/**
 * El pedido de creación de un reporte.
 *
 * `type` es el **código** del catálogo `obstacle_types`, no el `id`: el catálogo
 * vive en la base y lo resuelve el SQL, así que un código inexistente o inactivo
 * se rechaza ahí y no contra una lista copiada en el esquema.
 *
 * `description` tiene tope porque la columna es `varchar(300)`: sin él, un texto
 * largo no es un 400 sino un 500 de Postgres.
 *
 * `image_url` es opcional porque el reporte se puede mandar sin foto, y su tope
 * también es el de la columna. No se verifica que el archivo exista ni que sea
 * de este servidor: la subida es un paso aparte ([17 §4](../../../docs/17-la-api-de-reportes.md)).
 *
 * El cuerpo es estricto: un campo de más es un 400 que lo nombra, en vez de algo
 * que se descarta en silencio.
 */
export const createReportRequestSchema = z
  .strictObject({
    type: z.string(),
    severity: reportSeveritySchema,
    description: z.string().trim().min(1).max(300),
    geom: reportPointSchema,
    image_url: z.url().max(300).optional(),
  })
  .meta({
    id: 'CreateReportRequest',
    description: 'El reporte de un obstáculo, con la severidad que percibió quien lo manda.',
    example: {
      type: 'POTHOLE',
      severity: 'MODERATE',
      description: 'Pozo profundo en la esquina',
      geom: { lon: -68.8444, lat: -32.8897 },
      image_url: 'http://localhost:3001/uploads/2f1c6c1e-0f6c-4a4e-9d3a-0c5b1b2f7a11.jpg',
    },
  });

export type CreateReportRequest = z.infer<typeof createReportRequestSchema>;

/**
 * El reporte recién creado.
 *
 * Cuatro campos y ninguno más: lo que el cliente necesita para confirmar que se
 * guardó y para mostrar el estado con el que nace. `created_at` y el resto son
 * del listado del portal (#65) ([17 §3](../../../docs/17-la-api-de-reportes.md)).
 */
export const reportSchema = z
  .object({
    id: z.number().int(),
    type: z.string(),
    severity: reportSeveritySchema,
    status: reportStatusSchema,
  })
  .meta({ id: 'Report' });

export type Report = z.infer<typeof reportSchema>;

/**
 * La URL de la imagen ya guardada.
 *
 * Es lo único que devuelve la subida: el pedido de reporte sigue recibiendo
 * `image_url`, así que el cliente pega esta URL en el reporte
 * ([17 §4](../../../docs/17-la-api-de-reportes.md)).
 */
export const reportImageSchema = z
  .object({ url: z.string() })
  .meta({ id: 'ReportImage' });

export type ReportImage = z.infer<typeof reportImageSchema>;

/**
 * El pedido de `GET /api/reports` ([17 §7](../../../docs/17-la-api-de-reportes.md)).
 *
 * `status` tiene default `PENDING` porque es la cola de trabajo del moderador: lo que
 * alguien reportó y nadie miró todavía es lo que la pantalla abre sin pedir nada.
 *
 * El objeto es **estricto** a propósito: un parámetro mal escrito (`?staus=PENDING`) es
 * un 400 que lo nombra, no un silencio que devuelve los pendientes como si el filtro se
 * hubiera aplicado. Por eso la ruta valida `req.query` tal cual llega y no un objeto
 * armado con los campos que se esperan.
 */
export const reportsQuerySchema = z.strictObject({
  status: reportStatusSchema.default('PENDING'),
});

/**
 * Un reporte leído, como `Feature` de GeoJSON.
 *
 * La geometría reusa `pointGeometrySchema` del grafo en vez de definir otra copia: sale
 * de `ST_AsGeoJSON`, que devuelve el mismo `[lon, lat]`, y dos esquemas iguales serían
 * dos lugares donde arreglar el mismo borde ([14 §5](../../../docs/14-la-api-del-grafo.md)).
 *
 * Los ocho campos de `properties` no son un reflejo de la tabla
 * ([09 §4.5](../../../docs/09-modelo-de-datos.md)):
 *
 * - `id` es la referencia del reporte, la misma que devuelve el `POST`.
 * - `status` y `severity` viajan como enum y no como `id`, igual que en el pedido.
 * - `type` es el código del catálogo, para el cliente; `type_name` es el nombre en
 *   español, para la persona que modera.
 * - `image_url` es nullable porque la columna lo es: un reporte sin foto es completo.
 * - `obstacle_id` es el obstáculo que creó la aprobación, o `null`. Es lo que permite
 *   mostrar "obstáculo #N" en un reporte aprobado sin una segunda lectura
 *   ([18 §6](../../../docs/18-la-api-de-obstaculos.md)).
 * - `created_at` viaja en ISO para que el cliente no tenga que interpretar la zona
 *   horaria del driver.
 */
export const reportFeatureSchema = z
  .object({
    type: z.literal('Feature'),
    geometry: pointGeometrySchema,
    properties: z.object({
      id: z.number().int(),
      status: reportStatusSchema,
      type: z.string(),
      type_name: z.string(),
      severity: reportSeveritySchema,
      description: z.string(),
      image_url: z.string().nullable(),
      obstacle_id: z.number().int().nullable(),
      created_at: z.string(),
    }),
  })
  .meta({ id: 'ReportFeature' });

export type ReportFeature = z.infer<typeof reportFeatureSchema>;

/**
 * La respuesta de `GET /api/reports`: una `FeatureCollection` como la del grafo, con el
 * mismo aviso de recorte al lado de `type` ([17 §7](../../../docs/17-la-api-de-reportes.md)).
 *
 * `truncated` no es parte de GeoJSON y va en la raíz justamente para que el recorte se
 * vea sin abrir las features.
 */
export const reportsResponseSchema = z
  .object({
    type: z.literal('FeatureCollection'),
    truncated: z.boolean(),
    features: z.array(reportFeatureSchema),
  })
  .meta({ id: 'ReportFeatureCollection' });

export type ReportsResponse = z.infer<typeof reportsResponseSchema>;

/** Los parámetros de `/api/reports/:id`; el `id` llega como texto y se coacciona. */
export const reportParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

/**
 * El cuerpo de `POST /api/reports/:id/approve`.
 *
 * Es la decisión del moderador: qué tipo y qué severidad tiene el obstáculo que se publica.
 * El punto no viaja: sale del reporte, que es el que dijo dónde está
 * ([17 §7](../../../docs/17-la-api-de-reportes.md)).
 *
 * El cuerpo es estricto: `geom` no se acepta acá, porque aprobar no mueve el punto.
 */
export const approveReportRequestSchema = z
  .strictObject({
    type: z.string(),
    severity: reportSeveritySchema,
  })
  .meta({
    id: 'ApproveReportRequest',
    description:
      'La clasificación con la que el moderador publica el obstáculo de un reporte. El ' +
      'punto sale del reporte.',
    example: { type: 'POTHOLE', severity: 'MODERATE' },
  });

export type ApproveReportRequest = z.infer<typeof approveReportRequestSchema>;

/**
 * El reporte después de la moderación: su `id`, el estado nuevo y el obstáculo que nombra.
 *
 * `obstacle_id` es `null` para un reporte rechazado: rechazar no crea nada.
 */
export const reportDecisionSchema = z
  .object({
    id: z.number().int(),
    status: reportStatusSchema,
    obstacle_id: z.number().int().nullable(),
  })
  .meta({ id: 'ReportDecision' });

export type ReportDecision = z.infer<typeof reportDecisionSchema>;

/**
 * La respuesta de una aprobación: el obstáculo creado y el reporte marcado.
 *
 * Los dos viajan porque los dos cambiaron en la misma transacción, y el portal tiene que
 * poder repintar la fila y el mapa sin volver a pedir nada
 * ([18 §6](../../../docs/18-la-api-de-obstaculos.md)).
 */
export const approveReportResponseSchema = z
  .object({
    obstacle: obstacleFeatureSchema,
    report: reportDecisionSchema,
  })
  .meta({ id: 'ApproveReportResponse' });

export type ApproveReportResponse = z.infer<typeof approveReportResponseSchema>;
