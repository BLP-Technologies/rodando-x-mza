import express, { static as serveStatic, type Express, type RequestHandler } from 'express';
import type { Logger } from 'pino';
import { loadConfig } from './config.js';
import { cors } from './http/cors.js';
import { errorHandler, notFound } from './http/error-handler.js';
import { createRequestLogger } from './http/request-logger.js';
import { apiRouter } from './routes.js';

/** Cuánto puede cachear el navegador una imagen. Los nombres son únicos y no se
 * sobreescriben, así que un año es seguro. */
const UPLOAD_MAX_AGE = '365d';

export interface AppOptions {
  /** Orígenes de navegador permitidos para CORS. Vacío: no se emite ninguno. */
  corsOrigins?: readonly string[];
  /** Logger a usar. En tests se inyecta uno que captura la salida. */
  logger?: Logger;
}

/** Construye la aplicación Express. Separado del arranque para poder testearla. */
export function createApp({ corsOrigins = [], logger }: AppOptions = {}): Express {
  const app = express();

  app.disable('x-powered-by');
  // Detrás de Traefik: sin esto, `req.ip` es la IP del proxy y no la del cliente.
  app.set('trust proxy', 1);
  // Primero de todo: también registra los 404 y los errores del resto de la cadena.
  app.use(createRequestLogger({ logger }));
  // Antes del router y de notFound: un preflight OPTIONS no es una ruta de la API
  // y, si cae en notFound, responde 404 y el navegador nunca ve los encabezados.
  app.use(cors(corsOrigins));
  app.use(express.json());
  app.use('/api', apiRouter);
  // Fuera de `/api`: son archivos, no un recurso de la API, y así el día que los
  // sirva el proxy o un CDN el cliente no cambia de URL
  // ([17 §4](../../docs/17-la-api-de-reportes.md)).
  app.use('/uploads', lazyUploads());
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

/**
 * El `express.static` de las imágenes, construido en la primera request.
 *
 * No se arma al construir la app porque eso exigiría `loadConfig()` en el
 * arranque, y `createApp()` se usa en tests que no definen variables de entorno
 * (la conexión a la base es lazy por el mismo motivo, ver `db/index.ts`). La
 * primera request a `/uploads` ya es un servidor en marcha, donde configurar es
 * válido.
 */
function lazyUploads(): RequestHandler {
  let serve: RequestHandler | undefined;

  return (req, res, next) => {
    serve ??= serveStatic(loadConfig().UPLOAD_DIR, {
      index: false,
      dotfiles: 'ignore',
      maxAge: UPLOAD_MAX_AGE,
    });

    serve(req, res, next);
  };
}
