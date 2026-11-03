import { Router } from 'express';
import { getDb } from '../db/index.js';
import { ERROR_CODES } from '../http/error-codes.js';
import { validationDetails } from '../http/error-response.js';
import { HttpError } from '../http/errors.js';
import { routeRequestSchema } from './routing.schemas.js';
import { calculateRoute } from './routing.service.js';

/** Rutas de ruteo: el caso de uso C003, montado en `/api/routes`. */
export const routingRouter = Router();

/**
 * Calcula un recorrido accesible entre dos coordenadas.
 *
 * Valida la forma del pedido acá y delega el resto en el servicio; todo lo que puede
 * salir mal ya tiene su código de error ([13 §8](../../../docs/13-api-de-ruteo.md)).
 * Express 5 reenvía sola la promesa rechazada al manejador de errores.
 */
routingRouter.post('/calculate', async (req, res) => {
  const body: unknown = req.body ?? {};
  const parsed = routeRequestSchema.safeParse(body);

  if (!parsed.success) {
    throw new HttpError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      'invalid route request',
      validationDetails(parsed.error, body),
    );
  }

  res.json(await calculateRoute(getDb(), parsed.data));
});
