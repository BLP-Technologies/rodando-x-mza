import { z } from 'zod';

/**
 * Un origen CORS: esquema, host y puerto, sin ruta. Se normaliza a minúsculas y
 * sin barra final para compararlo contra el encabezado `Origin`, que nunca lleva
 * barra final: `http://localhost:3000/` y `http://localhost:3000` son el mismo
 * origen. Una entrada con ruta o query no matchea nunca y sería un error
 * silencioso, así que se rechaza al arrancar.
 */
const corsOriginSchema = z
  .url({ protocol: /^https?$/, error: 'Invalid origin' })
  .refine(
    (value) => {
      const url = new URL(value);
      return (url.pathname === '' || url.pathname === '/') && url.search === '' && url.hash === '';
    },
    'Invalid origin: expected scheme://host[:port], without path, query or hash',
  )
  .transform((value) => value.toLowerCase().replace(/\/+$/, ''));

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
  // Allowlist de orígenes para CORS, separada por comas. Vacía por defecto: sin
  // orígenes permitidos no se emite ningún encabezado CORS (ver src/http/cors.ts).
  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((raw) =>
      raw
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin !== ''),
    )
    .pipe(z.array(corsOriginSchema)),
  // LOG_LEVEL no se define acá: lo lee el logger, que debe funcionar incluso
  // cuando esta configuración todavía no se validó (ver src/logger.ts).

  // Dónde se guardan los bytes de las imágenes de los reportes. La ruta es
  // relativa al proceso: el backend se arranca desde `backend/`, así que el
  // default termina siendo `backend/uploads/`.
  UPLOAD_DIR: z.string().default('uploads'),
  // La URL pública de esos archivos, sin barra final para no armar `//`. Es la
  // que se guarda en `reports.image_url`, así que un cambio de dominio deja
  // URLs viejas: se cambia junto con lo que sirve `/uploads`
  // (docs/17 §4).
  UPLOAD_BASE_URL: z
    .url()
    .default('http://localhost:3001/uploads')
    .transform((value) => value.replace(/\/+$/, '')),
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
