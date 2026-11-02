import { Router } from 'express';
import { getDb } from '../db/index.js';
import { ERROR_CODES } from '../http/error-codes.js';
import { validationDetails } from '../http/error-response.js';
import { HttpError } from '../http/errors.js';
import { graphQuerySchema } from './graph.schemas.js';
import { readGraph } from './graph.service.js';

/** Rutas de lectura del grafo, montadas en `/api/graph`. */
export const graphRouter = Router();

/**
 * Devuelve los elementos del grafo que intersecan un bbox, como `FeatureCollection`.
 *
 * Sólo hay un parámetro y un error posible: un `bbox` que no sirve es
 * `VALIDATION_ERROR` con el campo `bbox` ([14 §6](../../../docs/14-la-api-del-grafo.md)).
 * Express 5 reenvía sola la promesa rechazada al manejador de errores.
 */
graphRouter.get('/', async (req, res) => {
  const query = { bbox: req.query.bbox };
  const parsed = graphQuerySchema.safeParse(query);

  if (!parsed.success) {
    throw new HttpError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      'invalid graph bbox',
      validationDetails(parsed.error, query),
    );
  }

  res.json(await readGraph(getDb(), parsed.data.bbox));
});