import type { RequestHandler } from 'express';

/** Métodos que la API acepta hoy; uno nuevo se agrega acá. */
const ALLOWED_METHODS = 'GET, POST, PATCH, OPTIONS';

/** Encabezados que el cliente puede mandar en un pedido simple o JSON.
 *
 * `Authorization` va incluido porque el token de `POST /api/auth/login` viaja ahí
 * ([20 §5](../../../docs/20-autenticacion.md)): sin él, el preflight de un navegador
 * bloquea cualquier pedido autenticado antes de que salga. */
const ALLOWED_HEADERS = 'Content-Type, Authorization';

/** Cuánto puede cachear el navegador el resultado del preflight, en segundos. */
export const PREFLIGHT_MAX_AGE_SECONDS = 600;

/**
 * Normaliza un origen para compararlo: sin espacios, en minúsculas y sin barra
 * final. Esquema y host no distinguen mayúsculas, y el encabezado `Origin` nunca
 * lleva barra final: `http://localhost:3000/` y `http://localhost:3000` son el
 * mismo origen.
 */
function normalizeOrigin(origin: string): string {
  return origin.trim().toLowerCase().replace(/\/+$/, '');
}

/**
 * CORS para clientes que corren en un navegador, con allowlist explícita (ver
 * docs/15-integracion-con-el-cliente.md §3 y §8).
 *
 * Reglas:
 *
 * - Solo se emiten encabezados para un `Origin` de la allowlist, y se responde
 *   con ese origen exacto: nunca `*`.
 * - Un origen fuera de la allowlist no recibe encabezados y el pedido sigue su
 *   curso normal. No se responde 403: el navegador ya bloquea la respuesta, y un
 *   403 convertiría un problema de política en un error de la API.
 * - No se emite `Access-Control-Allow-Credentials`: el token viaja en `Authorization`
 *   y no en una cookie, así que no hace falta ([20 §5](../../../docs/20-autenticacion.md)).
 * - `OPTIONS` con origen permitido es un preflight: responde `204` sin cuerpo.
 *   Por eso este middleware se monta antes del router y de `notFound`.
 * - `Vary: Origin` va siempre, incluso sin `Origin`: la respuesta depende de ese
 *   encabezado y una caché intermedia no puede servirla a otro origen.
 */
export function cors(allowedOrigins: readonly string[]): RequestHandler {
  const allowed = new Set(allowedOrigins.map(normalizeOrigin));

  return (req, res, next) => {
    res.vary('Origin');

    const origin = req.get('origin');
    if (origin === undefined || !allowed.has(normalizeOrigin(origin))) {
      next();
      return;
    }

    // El valor se repite tal como llegó: así el navegador lo compara con el suyo.
    res.setHeader('Access-Control-Allow-Origin', origin);

    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS);
      res.setHeader('Access-Control-Allow-Headers', ALLOWED_HEADERS);
      res.setHeader('Access-Control-Max-Age', String(PREFLIGHT_MAX_AGE_SECONDS));
      res.status(204).end();
      return;
    }

    next();
  };
}
