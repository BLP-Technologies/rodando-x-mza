import { Router } from 'express';
import { healthRouter } from './http/health.js';
import { openApiDocument } from './openapi.js';
import { routingRouter } from './routing/routing.routes.js';

/** Todas las rutas de la API se montan bajo `/api`. */
export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/routes', routingRouter);

/**
 * El contrato de la API, tal como se genera desde los esquemas Zod.
 *
 * Es lectura: el documento se arma al arrancar, no por pedido.
 */
apiRouter.get('/openapi.json', (_req, res) => {
  res.json(openApiDocument);
});
