import express, { type Express } from 'express';
import { errorHandler, notFound } from './http/error-handler.js';
import { apiRouter } from './routes.js';

/** Construye la aplicación Express. Separado del arranque para poder testearla. */
export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json());
  app.use('/api', apiRouter);
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
