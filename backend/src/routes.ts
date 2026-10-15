import { Router } from 'express';
import { healthRouter } from './http/health.js';

/** Todas las rutas de la API se montan bajo `/api`. */
export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
