/**
 * El cliente HTTP del portal: un `fetch` con la URL base de configuración y el
 * error de la API traducido a un tipo.
 *
 * Es chico a propósito. No arma rutas ni conoce el dominio: eso lo hace el
 * módulo de cada funcionalidad (`graph.ts`), tipado contra el contrato generado.
 * Ver [15 §3 y §6](../../docs/15-integracion-con-el-cliente.md).
 */

import { API_URL } from '@/config';
import type { components } from './schema';

/** El sobre de error de la API ([04](../../docs/04-errores-y-mensajes.md)). */
type ErrorResponse = components['schemas']['ErrorResponse'];

/**
 * Un pedido que falló. `code` es el código de la API tal cual llegó; los
 * mensajes en español los pone `error-messages.ts`.
 */
export class ApiError extends Error {
  readonly code: string;
  readonly details: ErrorResponse['error']['details'];

  constructor(code: string, details?: ErrorResponse['error']['details']) {
    super(code);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
  }
}

/** El pedido ni siquiera llegó: API caída, DNS o CORS. */
export const NETWORK_ERROR = 'NETWORK_ERROR';

/** La API respondió error, pero sin el sobre del contrato. */
export const UNKNOWN_ERROR = 'UNKNOWN_ERROR';

/** Extrae el sobre de error de una respuesta sin confiar en su forma. */
async function errorFromResponse(response: Response): Promise<ApiError> {
  const body = (await response.json().catch(() => null)) as Partial<ErrorResponse> | null;
  const error = body?.error;

  // Un código desconocido no rompe nada: se propaga y el mapeo de mensajes cae
  // al genérico ([15 §6]).
  if (typeof error?.code === 'string') {
    return new ApiError(error.code, error.details);
  }

  return new ApiError(UNKNOWN_ERROR);
}

/** `GET` a la API, con el cuerpo ya parseado como `T`. */
export async function apiGet<T>(path: string): Promise<T> {
  let response: Response;

  try {
    response = await fetch(new URL(path, API_URL), {
      headers: { accept: 'application/json' },
    });
  } catch {
    // `fetch` sólo rechaza cuando no hubo respuesta.
    throw new ApiError(NETWORK_ERROR);
  }

  if (!response.ok) {
    throw await errorFromResponse(response);
  }

  return (await response.json()) as T;
}

/**
 * El `PATCH` de un recurso, con el cuerpo ya parseado como `T`.
 *
 * Mismo contrato de error que `apiGet`: un `texto` que no es JSON del catálogo cae en
 * `UNKNOWN_ERROR` y no rompe el render (15 §6).
 */
export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  let response: Response;

  try {
    response = await fetch(new URL(path, API_URL), {
      method: 'PATCH',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError(NETWORK_ERROR);
  }

  if (!response.ok) {
    throw await errorFromResponse(response);
  }

  return (await response.json()) as T;
}
