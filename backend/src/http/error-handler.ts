import type { ErrorRequestHandler, RequestHandler } from 'express';
import { getLogger } from '../logger.js';
import { ERROR_CODES } from './error-codes.js';
import { HttpError } from './errors.js';

/** Última ruta: cualquier request no atendida devuelve 404. */
export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ error: { code: ERROR_CODES.NOT_FOUND } });
};

/**
 * Traduce cualquier error a la respuesta de error de la API (ver docs/03).
 *
 * Express 5 reenvía automáticamente las promesas rechazadas de los handlers
 * async hacia acá.
 *
 * Regla dura: nunca se expone texto interno al cliente. Los errores esperados
 * (status < 500) devuelven su `code` y `details`; cualquier otra cosa —incluido un
 * `HttpError` con status ≥ 500— se generaliza a `INTERNAL_ERROR` sin detalles, y
 * el error completo va al log.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  // `req.log` lo agrega pino-http y arrastra el id de la request; sin él, queda el
  // logger global para los errores que ocurren fuera de una request.
  const log = req.log ?? getLogger();

  if (err instanceof HttpError && err.status < 500) {
    log.warn({ err }, err.message);
    res.status(err.status).json({
      error: {
        code: err.code,
        ...(err.details === undefined ? {} : { details: err.details }),
      },
    });
    return;
  }

  log.error({ err }, 'Unhandled error');
  res.status(500).json({ error: { code: ERROR_CODES.INTERNAL_ERROR } });
};
