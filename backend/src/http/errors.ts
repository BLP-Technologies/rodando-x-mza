import type { ErrorCode } from './error-codes.js';

/**
 * Error con status HTTP y código de error de la API.
 *
 * `message` es para desarrolladores (va al log): el texto que ve el usuario lo
 * arma cada cliente a partir de `code`. Ver docs/03-errores-y-mensajes.md.
 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}
