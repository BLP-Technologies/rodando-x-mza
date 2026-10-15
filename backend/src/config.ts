import { z } from 'zod';

/**
 * Esquema de las variables de entorno. Falla al arrancar si falta o está mal
 * alguna, en vez de dejar un valor `undefined` circular por el código.
 */
const envSchema = z.object({
  // Obligatorio y sin valor por defecto: un fallback accidental a 'development'
  // habilitaría comportamiento de desarrollo (p. ej. logs verbosos) en producción.
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.url(),
  // LOG_LEVEL no se define acá: lo lee el logger, que debe funcionar incluso
  // cuando esta configuración todavía no se validó (ver src/logger.ts).
});

export type Config = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = envSchema.safeParse(env);

  if (!result.success) {
    const detail = result.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid configuration:\n${detail}`);
  }

  return result.data;
}
