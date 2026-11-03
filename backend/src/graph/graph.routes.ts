import { Router } from 'express';
import { getDb } from '../db/index.js';
import { ERROR_CODES } from '../http/error-codes.js';
import { validationDetails } from '../http/error-response.js';
import { HttpError } from '../http/errors.js';
import {
  graphElementParamsSchema,
  graphQuerySchema,
  updateGraphElementBodySchema,
} from './graph.schemas.js';
import { readGraph, updateGraphElement } from './graph.service.js';

/** Rutas del grafo, montadas en `/api/graph`.
 *
 * Hay una lectura y una escritura, y la escritura es la única del sistema: el nivel de
 * un elemento, desde el portal ([14 §7](../../../docs/14-la-api-del-grafo.md)).
 */
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

/**
 * Cambia el nivel de accesibilidad de un elemento.
 *
 * El pedido se valida en dos pasos, la ruta primero: sin una clase y un id válidos no
 * hay nada que actualizar. El cuerpo exige `level` (un nivel del enum o `null` para
 * "sin dato") y rechaza cualquier campo de más, incluido `is_verified`, que lo decide
 * el servidor ([14 §7](../../../docs/14-la-api-del-grafo.md)).
 */
graphRouter.patch('/elements/:kind/:id', async (req, res) => {
  const params = { kind: req.params.kind, id: req.params.id };
  const parsedParams = graphElementParamsSchema.safeParse(params);

  if (!parsedParams.success) {
    throw new HttpError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      'invalid graph element params',
      validationDetails(parsedParams.error, params),
    );
  }

  const body: unknown = req.body ?? {};
  const parsedBody = updateGraphElementBodySchema.safeParse(body);

  if (!parsedBody.success) {
    throw new HttpError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      'invalid graph element update',
      validationDetails(parsedBody.error, body),
    );
  }

  const { kind, id } = parsedParams.data;
  res.json(await updateGraphElement(getDb(), kind, id, parsedBody.data.level));
});