import { Router } from 'express';
import { getDb } from '../db/index.js';
import { ERROR_CODES } from '../http/error-codes.js';
import { validationDetails } from '../http/error-response.js';
import { HttpError } from '../http/errors.js';
import { reportsImagesRouter } from './reports.images.routes.js';
import {
  approveReportRequestSchema,
  createReportRequestSchema,
  reportParamsSchema,
  reportsQuerySchema,
} from './reports.schemas.js';
import {
  approveReport,
  createReport,
  readReports,
  rejectReport,
} from './reports.service.js';

/** Rutas de reportes ciudadanos, montadas en `/api/reports`.
 *
 * La subida de la imagen vive en un router hermano, montado acá abajo: es el
 * mismo recurso —una imagen de un reporte— pero otro transporte (multipart) y otro
 * destino (el disco, no la base), y mezclarla con el `POST` de reportes haría que
 * el archivo del contrato cargara con multer ([17 §4](../../../docs/17-la-api-de-reportes.md)).
 */
export const reportsRouter = Router();

/**
 * Guarda un reporte de obstáculo y devuelve cómo nació.
 *
 * Valida la forma del pedido acá y delega el resto en el servicio; el código de
 * tipo lo resuelve el SQL contra el catálogo ([17 §5](../../../docs/17-la-api-de-reportes.md)).
 * Responde **201** porque crea un recurso, con lo justo para confirmarlo: la lectura
 * completa es el `GET` de §7.
 */
reportsRouter.post('/', async (req, res) => {
  const body: unknown = req.body ?? {};
  const parsed = createReportRequestSchema.safeParse(body);

  if (!parsed.success) {
    throw new HttpError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      'invalid report request',
      validationDetails(parsed.error, body),
    );
  }

  res.status(201).json(await createReport(getDb(), parsed.data));
});

/**
 * Devuelve los reportes de un estado, como `FeatureCollection`.
 *
 * Un solo parámetro: `status`, con `PENDING` por defecto
 * ([17 §7](../../../docs/17-la-api-de-reportes.md)). Un valor fuera del enum o un
 * parámetro que el contrato no tiene son `VALIDATION_ERROR` con el campo nombrado.
 */
reportsRouter.get('/', async (req, res) => {
  // Se valida `req.query` tal cual llega, no un objeto armado con los campos que se
  // esperan: si se copiara `{ status: req.query.status }`, un parámetro de más se
  // perdería en el camino y el `strictObject` no tendría qué rechazar.
  const query: unknown = req.query;
  const parsed = reportsQuerySchema.safeParse(query);

  if (!parsed.success) {
    throw new HttpError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      'invalid reports query',
      validationDetails(parsed.error, query),
    );
  }

  res.json(await readReports(getDb(), parsed.data.status));
});

/**
 * Aprueba un reporte: crea el obstáculo y marca el reporte en una transacción.
 *
 * El cuerpo trae la clasificación del moderador —tipo y severidad— y el punto sale del
 * reporte ([18 §6](../../../docs/18-la-api-de-obstaculos.md)). Responde **201** porque crea
 * un obstáculo, y con los dos recursos que cambiaron.
 *
 * Los tres rechazos esperables: `400` si el cuerpo no cumple el contrato o si no hay un
 * elemento del grafo cerca del punto; `404` si el reporte no existe o está dado de baja; y
 * `409` si ya no está pendiente.
 */
reportsRouter.post('/:id/approve', async (req, res) => {
  const id = parseReportId(req.params.id);

  const body: unknown = req.body ?? {};
  const parsed = approveReportRequestSchema.safeParse(body);

  if (!parsed.success) {
    throw new HttpError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      'invalid report approval',
      validationDetails(parsed.error, body),
    );
  }

  res.status(201).json(
    // La transacción es de la ruta: el servicio escribe las tres cosas en orden y quien abre
    // la transacción es quien puede deshacerla ([18 §6](../../../docs/18-la-api-de-obstaculos.md)).
    await getDb()
      .transaction()
      .execute((trx) => approveReport(trx, id, parsed.data)),
  );
});

/**
 * Descarta un reporte sin crear obstáculo.
 *
 * No lleva cuerpo ni devuelve más que la fila del reporte
 * ([18 §6](../../../docs/18-la-api-de-obstaculos.md)). Los mismos `404` y `409` que la
 * aprobación: la decisión se toma una sola vez.
 */
reportsRouter.post('/:id/reject', async (req, res) => {
  const id = parseReportId(req.params.id);

  res.json(await getDb().transaction().execute((trx) => rejectReport(trx, id)));
});

/**
 * El `id` de la ruta, ya validado.
 *
 * Un id que no es un entero positivo es `VALIDATION_ERROR` con el campo nombrado: es un
 * pedido que la API no ofrece, no un reporte que falta.
 */
function parseReportId(raw: string | undefined): number {
  const params = { id: raw };
  const parsed = reportParamsSchema.safeParse(params);

  if (!parsed.success) {
    throw new HttpError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      'invalid report id',
      validationDetails(parsed.error, params),
    );
  }

  return parsed.data.id;
}

reportsRouter.use('/images', reportsImagesRouter);
