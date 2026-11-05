import type { RequestHandler, Response } from 'express';
import { getDb } from '../db/index.js';
import { ERROR_CODES } from '../http/error-codes.js';
import { HttpError } from '../http/errors.js';
import type { User } from './auth.schemas.js';
import { getUserByToken } from './auth.service.js';

/** Quién hizo el pedido, una vez que `requireAuth` validó su token. */
export type Auth = { user: User; token: string };

// `res.locals` es de Express y no sabe qué guarda cada middleware: se le agrega el campo
// `auth` acá, junto al único código que lo escribe, para leerlo tipado y sin `any`.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- así declara Express sus tipos
  namespace Express {
    interface Locals {
      auth?: Auth;
    }
  }
}

/** `Authorization: Bearer <token>`. El esquema no distingue mayúsculas (RFC 6750). */
const BEARER = /^Bearer\s+(\S+)$/i;

/**
 * Exige una sesión vigente. Sin token, con uno mal formado, vencido o de una cuenta dada
 * de baja, responde `401 UNAUTHENTICATED`; si es válido, deja al usuario en `res.locals`.
 *
 * Un encabezado ausente o mal formado se rechaza sin consultar la base.
 */
export const requireAuth: RequestHandler = async (req, res, next) => {
  const token = BEARER.exec(req.get('authorization') ?? '')?.[1];
  if (token === undefined) {
    throw new HttpError(401, ERROR_CODES.UNAUTHENTICATED, 'missing or malformed bearer token');
  }

  const user = await getUserByToken(getDb(), token);
  if (user === undefined) {
    throw new HttpError(401, ERROR_CODES.UNAUTHENTICATED, 'invalid or expired session');
  }

  res.locals.auth = { user, token };
  next();
};

/**
 * Lo que dejó `requireAuth`. Sólo se usa en rutas montadas detrás de él; si faltara, es
 * un error de armado de la ruta y no un pedido inválido, por eso es un 500.
 */
export function getAuth(res: Response): Auth {
  const { auth } = res.locals;
  if (auth === undefined) {
    throw new HttpError(500, ERROR_CODES.INTERNAL_ERROR, 'route uses getAuth without requireAuth');
  }
  return auth;
}
