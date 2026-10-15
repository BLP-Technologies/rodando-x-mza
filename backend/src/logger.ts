import { pino, type Logger } from 'pino';
import { z } from 'zod';

/**
 * Nivel de log válido. `catch('info')` hace que un valor ausente o inválido caiga
 * en 'info', que es seguro (no sube el nivel de detalle).
 */
const levelSchema = z
  .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
  .catch('info');

let instance: Logger | undefined;

/**
 * Logger único de la aplicación (pino). Se crea la primera vez que se usa.
 *
 * Lee el entorno directamente, sin depender de `loadConfig()`: así puede loguear
 * incluso cuando la configuración todavía no se validó o falló. En desarrollo se
 * formatea con pino-pretty; en el resto, emite JSON.
 */
export function getLogger(): Logger {
  if (!instance) {
    instance = pino({
      level: levelSchema.parse(process.env.LOG_LEVEL),
      ...(process.env.NODE_ENV === 'development'
        ? {
            transport: {
              target: 'pino-pretty',
              options: { translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
            },
          }
        : {}),
    });
  }

  return instance;
}
