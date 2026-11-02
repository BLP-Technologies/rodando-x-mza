import express, { type Express } from 'express';
import { cors } from './http/cors.js';
import { errorHandler, notFound } from './http/error-handler.js';
import { apiRouter } from './routes.js';

export interface AppOptions {
  /** Orígenes de navegador permitidos para CORS. Vacío: no se emite ninguno. */
  corsOrigins?: readonly string[];
}

/** Construye la aplicación Express. Separado del arranque para poder testearla. */
export function createApp({ corsOrigins = [] }: AppOptions = {}): Express {
  const app = express();

  app.disable('x-powered-by');
  // Antes del router y de notFound: un preflight OPTIONS no es una ruta de la API
  // y, si cae en notFound, responde 404 y el navegador nunca ve los encabezados.
  app.use(cors(corsOrigins));
  app.use(express.json());
  app.use('/api', apiRouter);
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
