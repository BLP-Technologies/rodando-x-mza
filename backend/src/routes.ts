import { Router } from 'express';
import { authRouter } from './auth/auth.routes.js';
import { graphRouter } from './graph/graph.routes.js';
import { docsRouter } from './http/docs.js';
import { healthRouter } from './http/health.js';
import { obstaclesRouter } from './obstacles/obstacles.routes.js';
import { openApiDocument } from './openapi.js';
import { reportsRouter } from './reports/reports.routes.js';
import { routingRouter } from './routing/routing.routes.js';
import { placesRouter } from './places/places.routes.js';

/** Todas las rutas de la API se montan bajo `/api`. */
export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/graph', graphRouter);
apiRouter.use('/routes', routingRouter);
apiRouter.use('/places', placesRouter);
apiRouter.use('/reports', reportsRouter);
apiRouter.use('/obstacles', obstaclesRouter);
apiRouter.use('/docs', docsRouter);

/**
 * El contrato de la API, tal como se genera desde los esquemas Zod.
 *
 * Es lectura: el documento se arma al arrancar, no por pedido. La versión navegable lo
 * lee de acá: es la única copia (ver `http/docs.ts`).
 */
apiRouter.get('/openapi.json', (_req, res) => {
  res.json(openApiDocument);
});
