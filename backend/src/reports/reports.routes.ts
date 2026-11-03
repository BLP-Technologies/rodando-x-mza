import { Router } from 'express';
import { getDb } from '../db/index.js';
import { ERROR_CODES } from '../http/error-codes.js';
import { validationDetails } from '../http/error-response.js';
import { HttpError } from '../http/errors.js';
import { reportsImagesRouter } from './reports.images.routes.js';
import { createReportRequestSchema, reportsQuerySchema } from './reports.schemas.js';
import { createReport, readReports } from './reports.service.js';

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

reportsRouter.use('/images', reportsImagesRouter);
