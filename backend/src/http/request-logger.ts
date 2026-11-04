import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Logger } from 'pino';
import { pinoHttp } from 'pino-http';
import { getLogger } from '../logger.js';

/** Rutas que no se loguean: monitoreo y archivos estáticos. */
const IGNORED_PREFIXES = ['/api/health', '/uploads'];

function shouldIgnore(url: string | undefined): boolean {
  if (!url) return false;

  return IGNORED_PREFIXES.some(
    (prefix) => url === prefix || url.startsWith(`${prefix}/`) || url.startsWith(`${prefix}?`),
  );
}

export interface RequestLoggerOptions {
  logger?: Logger | undefined;
  /** En tests se apaga para no llenar la salida; `req.log` sigue disponible. */
  autoLogging?: boolean | undefined;
}

/**
 * Loguea cada request HTTP con pino: método, URL, status, duración e IP.
 *
 * Agrega un id de correlación en `req.id` y en el encabezado `x-request-id`, y deja
 * un `req.log` hijo del logger para que los errores salgan con el mismo id.
 *
 * No se loguean los cuerpos: los reportes traen descripción e imagen, y no hace
 * falta ese detalle para diagnosticar. Los encabezados de autenticación y cookies
 * se redactan.
 */
export function createRequestLogger({
  logger = getLogger(),
  autoLogging = process.env.NODE_ENV !== 'test',
}: RequestLoggerOptions = {}) {
  return pinoHttp<IncomingMessage, ServerResponse>({
    logger,
    genReqId: (_req: IncomingMessage, res: ServerResponse) => {
      const id = randomUUID();
      res.setHeader('x-request-id', id);
      return id;
    },
    redact: {
      paths: ['req.headers.authorization', 'req.headers.cookie'],
      censor: '[redacted]',
    },
    autoLogging: autoLogging
      ? { ignore: (req: IncomingMessage) => shouldIgnore(req.url) }
      : false,
    customProps: (req: IncomingMessage) => {
      // Express resuelve `req.ip` con `trust proxy`; el serializador de pino solo
      // trae `remoteAddress`, que detrás de Traefik es la IP del proxy.
      const expressReq = req as IncomingMessage & { ip?: string };

      return expressReq.ip === undefined ? {} : { ip: expressReq.ip };
    },
    customLogLevel: (_req: IncomingMessage, res: ServerResponse, err?: Error) => {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';

      return 'info';
    },
  });
}
