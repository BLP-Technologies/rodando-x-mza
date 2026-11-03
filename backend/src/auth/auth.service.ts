import { createHash, randomBytes } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { DB } from '../db/types.js';
import { ERROR_CODES } from '../http/error-codes.js';
import { HttpError } from '../http/errors.js';
import { hashPassword, verifyPassword } from './auth.password.js';
import type { LoginRequest, LoginResponse, RegisterRequest, User } from './auth.schemas.js';
import {
  deleteSession,
  findUserByEmail,
  findUserBySessionToken,
  insertSession,
  insertUser,
  type UserRow,
} from './auth.sql.js';

/**
 * Los casos de uso de la autenticación: registrarse (C001), iniciar sesión (C002), saber
 * quién es el dueño de un token y cerrar la sesión. Ver [17](../../../docs/17-autenticacion.md).
 */

/** Cuánto dura una sesión desde que se inicia: 30 días. */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Bytes aleatorios del token: 32 bytes son 256 bits, imposibles de adivinar. */
const TOKEN_BYTES = 32;

/**
 * El hash con el que se guarda y se busca un token. SHA-256 alcanza (no hace falta
 * scrypt): el token ya es aleatorio y largo, no una contraseña que se pueda adivinar.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Hash de una contraseña que nadie tiene, para cuando el email no existe: verificar
 * igual contra él hace que el login tarde lo mismo, y el tiempo de respuesta no revela
 * qué emails están registrados. Se calcula una sola vez, la primera que se usa.
 */
let dummyHash: Promise<string> | undefined;

function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword(randomBytes(TOKEN_BYTES).toString('base64url'));
  return dummyHash;
}

/** Crea una cuenta. El email ya registrado es un `CONFLICT`. */
export async function register(db: Kysely<DB>, request: RegisterRequest): Promise<User> {
  const passwordHash = await hashPassword(request.password);

  try {
    const row = await insertUser(db, { name: request.name, email: request.email, passwordHash });
    return toUser(row);
  } catch (error) {
    // Se confía en el índice único y no en un SELECT previo: entre el chequeo y el
    // INSERT otro pedido podría registrar el mismo email.
    if (isUniqueViolation(error)) {
      throw new HttpError(409, ERROR_CODES.CONFLICT, 'email already registered');
    }
    throw error;
  }
}

/**
 * Inicia sesión: verifica las credenciales y abre una sesión nueva.
 *
 * Email inexistente y contraseña incorrecta dan el mismo error, a propósito: distinguirlos
 * le diría a cualquiera qué emails tienen cuenta.
 */
export async function login(db: Kysely<DB>, request: LoginRequest): Promise<LoginResponse> {
  const user = await findUserByEmail(db, request.email);
  const valid = await verifyPassword(request.password, user?.passwordHash ?? (await getDummyHash()));

  if (user === undefined || !valid) {
    throw new HttpError(401, ERROR_CODES.UNAUTHENTICATED, 'invalid credentials');
  }

  const token = randomBytes(TOKEN_BYTES).toString('base64url');
  await insertSession(db, {
    userId: user.id,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  });

  return { token, user: toUser(user) };
}

/** El dueño de un token, si la sesión sigue vigente. */
export async function getUserByToken(db: Kysely<DB>, token: string): Promise<User | undefined> {
  const row = await findUserBySessionToken(db, hashToken(token));
  return row === undefined ? undefined : toUser(row);
}

/** Cierra la sesión de ese token. */
export async function logout(db: Kysely<DB>, token: string): Promise<void> {
  await deleteSession(db, hashToken(token));
}

/** La fila tal como la ve el cliente, en `snake_case` y sin el hash. */
function toUser(row: UserRow): User {
  return { id: row.id, name: row.name, email: row.email, is_moderator: row.isModerator };
}

/** `23505` es el código de PostgreSQL para una violación de unicidad. */
function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}
