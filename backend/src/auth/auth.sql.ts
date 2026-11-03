import { sql, type Kysely } from 'kysely';
import type { DB } from '../db/types.js';

/**
 * Las consultas de la autenticación: cuentas en `users` y sesiones en `sessions`.
 *
 * Ninguna devuelve el hash de la contraseña salvo `findUserByEmail`, que lo necesita el
 * servicio para verificar el inicio de sesión. Ver [17](../../../docs/17-autenticacion.md).
 */

/** Una cuenta, sin el hash: lo que el servicio puede devolver al cliente. */
export type UserRow = { id: number; name: string; email: string; isModerator: boolean };

/** Una cuenta con el hash, sólo para verificar la contraseña. */
export type UserWithPasswordRow = UserRow & { passwordHash: string };

/**
 * La cuenta activa con ese email, o `undefined`.
 *
 * Compara `lower(email)` porque es la expresión del índice único `users_email_key`: así
 * la búsqueda usa el índice. Las cuentas dadas de baja no existen para el login.
 */
export async function findUserByEmail(
  db: Kysely<DB>,
  email: string,
): Promise<UserWithPasswordRow | undefined> {
  return db
    .selectFrom('users')
    .select([
      'id',
      'name',
      'email',
      'is_moderator as isModerator',
      'password_hash as passwordHash',
    ])
    .where(sql<string>`lower(email)`, '=', email.toLowerCase())
    .where('deleted_at', 'is', null)
    .executeTakeFirst();
}

/**
 * Crea la cuenta. Si el email ya existe, la base rechaza el insert con la violación de
 * unicidad (`23505`), y el servicio la traduce a `CONFLICT`.
 */
export async function insertUser(
  db: Kysely<DB>,
  user: { name: string; email: string; passwordHash: string },
): Promise<UserRow> {
  return db
    .insertInto('users')
    .values({ name: user.name, email: user.email, password_hash: user.passwordHash })
    .returning(['id', 'name', 'email', 'is_moderator as isModerator'])
    .executeTakeFirstOrThrow();
}

/** Abre una sesión: guarda el hash del token, nunca el token. */
export async function insertSession(
  db: Kysely<DB>,
  session: { userId: number; tokenHash: string; expiresAt: Date },
): Promise<void> {
  await db
    .insertInto('sessions')
    .values({
      user_id: session.userId,
      token_hash: session.tokenHash,
      expires_at: session.expiresAt,
    })
    .execute();
}

/**
 * La cuenta dueña de una sesión vigente, o `undefined`.
 *
 * Vigente es: no venció y la cuenta no está dada de baja. Una sesión vencida queda en la
 * tabla pero ya no autentica.
 */
export async function findUserBySessionToken(
  db: Kysely<DB>,
  tokenHash: string,
): Promise<UserRow | undefined> {
  return db
    .selectFrom('sessions')
    .innerJoin('users', 'users.id', 'sessions.user_id')
    .select([
      'users.id',
      'users.name',
      'users.email',
      'users.is_moderator as isModerator',
    ])
    .where('sessions.token_hash', '=', tokenHash)
    .where('sessions.expires_at', '>', sql<Date>`now()`)
    .where('users.deleted_at', 'is', null)
    .executeTakeFirst();
}

/** Cierra una sesión. Borrar una que no existe no es un error: el resultado es el mismo. */
export async function deleteSession(db: Kysely<DB>, tokenHash: string): Promise<void> {
  await db.deleteFrom('sessions').where('token_hash', '=', tokenHash).execute();
}
