import { Router } from 'express';
import { getDb } from '../db/index.js';
import { ERROR_CODES } from '../http/error-codes.js';
import { validationDetails } from '../http/error-response.js';
import { HttpError } from '../http/errors.js';
import {
  createObstacleRequestSchema,
  obstacleParamsSchema,
  obstaclesQuerySchema,
} from './obstacles.schemas.js';
import { createObstacle, readObstacles, resolveObstacle } from './obstacles.service.js';

/** Rutas de obstáculos, montadas en `/api/obstacles`.
 *
 * Son las dos escrituras de C012 y C013 —crear y resolver— y la lectura que el portal usa
 * para dibujarlos.
 */
export const obstaclesRouter = Router();

/**
 * Devuelve los obstáculos de un estado, como `FeatureCollection`, con el catálogo de tipos
 * al lado.
 *
 * El estado va en la consulta y no se descarta en el cliente, con `ACTIVE` por defecto: el
 * mapa abre mostrando lo que está en la calle y el histórico se pide aparte
 * ([18 §4](../../../docs/18-la-api-de-obstaculos.md)). Un valor fuera del enum o un
 * parámetro de más son `VALIDATION_ERROR` con el campo nombrado.
 */
obstaclesRouter.get('/', async (req, res) => {
  // Se valida `req.query` tal cual llega, no un objeto armado con los campos que se
  // esperan: si se copiara `{ status: req.query.status }`, un parámetro de más se perdería
  // en el camino y el `strictObject` no tendría qué rechazar.
  const query: unknown = req.query;
  const parsed = obstaclesQuerySchema.safeParse(query);

  if (!parsed.success) {
    throw new HttpError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      'invalid obstacles query',
      validationDetails(parsed.error, query),
    );
  }

  res.json(await readObstacles(getDb(), parsed.data.status));
});

/**
 * Crea un obstáculo y devuelve cómo quedó.
 *
 * Valida la forma del pedido acá y delega el resto en el servicio: el elemento al que se
 * cuelga lo decide el pegamento y el código de tipo lo resuelve el SQL contra el catálogo
 * ([18 §3](../../../docs/18-la-api-de-obstaculos.md)). Responde **201** porque crea un
 * recurso, con la misma forma que una feature de la lectura.
 */
obstaclesRouter.post('/', async (req, res) => {
  const body: unknown = req.body ?? {};
  const parsed = createObstacleRequestSchema.safeParse(body);

  if (!parsed.success) {
    throw new HttpError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      'invalid obstacle request',
      validationDetails(parsed.error, body),
    );
  }

  const { type, severity, geom } = parsed.data;
  const obstacle = await createObstacle(getDb(), {
    type,
    severity,
    lon: geom.lon,
    lat: geom.lat,
  });

  res.status(201).json(obstacle);
});

/**
 * Resuelve un obstáculo: escribe `resolved_at` y deja de contar en el ruteo.
 *
 * No lleva cuerpo. Es idempotente, así que repetirlo responde `200` con el mismo obstáculo;
 * `404` si el id no existe o está dado de baja ([18 §5](../../../docs/18-la-api-de-obstaculos.md)).
 */
obstaclesRouter.post('/:id/resolve', async (req, res) => {
  const params = { id: req.params.id };
  const parsed = obstacleParamsSchema.safeParse(params);

  if (!parsed.success) {
    throw new HttpError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      'invalid obstacle id',
      validationDetails(parsed.error, params),
    );
  }

  res.json(await resolveObstacle(getDb(), parsed.data.id));
});
