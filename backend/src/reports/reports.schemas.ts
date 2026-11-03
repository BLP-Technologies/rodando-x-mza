import { z } from 'zod';

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
export const reportStatusSchema = z.enum([
  'PENDING',
  'APPROVED',
  'UNDER_REPAIR',
  'RESOLVED',
  'REJECTED',
]);

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
