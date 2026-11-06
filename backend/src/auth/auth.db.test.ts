import { sql } from 'kysely';
import { describe, expect, it } from 'vitest';
import { inRolledBackTransaction } from '../db/test-transaction.js';
import { HttpError } from '../http/errors.js';
import { getUserByToken, hashToken, login, logout, register } from './auth.service.js';
import { insertSession } from './auth.sql.js';

const ANA = { name: 'Ana', email: 'ana@example.com', password: 'una-clave-larga' };

/** El status y el código de un `HttpError`, para comparar el error esperado. */
async function errorOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof HttpError) return `${error.status} ${error.code}`;
    throw error;
  }
  throw new Error('expected the call to fail');
}

/**
 * Los casos de uso contra la base. Cada uno corre en una transacción que se deshace, así
 * no deja cuentas ni sesiones en la base de desarrollo.
 */
describe.skipIf(!process.env.DATABASE_URL)('autenticación contra la base', () => {
  it('crea la cuenta como moderadora, que es la decisión del MVP', async () => {
    // Si se revierte esa decisión (auth.sql.ts), este test es el que avisa.
    const user = await inRolledBackTransaction((trx) => register(trx, ANA));

    expect(user.is_moderator).toBe(true);
  });

  it('guarda un hash y no la contraseña', async () => {
    const stored = await inRolledBackTransaction(async (trx) => {
      const user = await register(trx, ANA);
      const row = await trx
        .selectFrom('users')
        .select('password_hash')
        .where('id', '=', user.id)
        .executeTakeFirstOrThrow();
      return row.password_hash;
    });

    expect(stored).not.toContain(ANA.password);
    expect(stored.startsWith('scrypt$')).toBe(true);
  });

  it('rechaza un email ya registrado, sin importar mayúsculas', async () => {
    // El conflicto aborta la transacción: por eso es lo último que pasa en este test.
    const result = await inRolledBackTransaction(async (trx) => {
      await register(trx, ANA);
      return errorOf(register(trx, { ...ANA, email: 'ANA@example.com' }));
    });

    expect(result).toBe('409 CONFLICT');
  });

  it('da el mismo error para una clave incorrecta y para un email que no existe', async () => {
    const outcome = await inRolledBackTransaction(async (trx) => {
      await register(trx, ANA);
      return {
        wrongPassword: await errorOf(
          login(trx, { email: ANA.email, password: 'otra-clave-larga' }),
        ),
        unknownEmail: await errorOf(
          login(trx, { email: 'nadie@example.com', password: ANA.password }),
        ),
      };
    });

    expect(outcome.wrongPassword).toBe('401 UNAUTHENTICATED');
    expect(outcome.unknownEmail).toBe('401 UNAUTHENTICATED');
  });

  it('abre una sesión que guarda el hash del token y no el token', async () => {
    const outcome = await inRolledBackTransaction(async (trx) => {
      const user = await register(trx, ANA);
      const { token } = await login(trx, { email: ANA.email, password: ANA.password });
      const session = await trx
        .selectFrom('sessions')
        .select('token_hash')
        .where('user_id', '=', user.id)
        .executeTakeFirstOrThrow();
      return { token, tokenHash: session.token_hash, me: await getUserByToken(trx, token) };
    });

    expect(outcome.tokenHash).not.toBe(outcome.token);
    expect(outcome.tokenHash).toBe(hashToken(outcome.token));
    expect(outcome.me?.email).toBe(ANA.email);
  });

  it('después de cerrar sesión el token deja de servir', async () => {
    const me = await inRolledBackTransaction(async (trx) => {
      await register(trx, ANA);
      const { token } = await login(trx, { email: ANA.email, password: ANA.password });
      await logout(trx, token);
      return getUserByToken(trx, token);
    });

    expect(me).toBeUndefined();
  });

  it('una sesión vencida no autentica', async () => {
    const me = await inRolledBackTransaction(async (trx) => {
      const user = await register(trx, ANA);
      await insertSession(trx, {
        userId: user.id,
        tokenHash: hashToken('vencido'),
        expiresAt: new Date(Date.now() - 1000),
      });
      return getUserByToken(trx, 'vencido');
    });

    expect(me).toBeUndefined();
  });

  it('una cuenta dada de baja no autentica ni inicia sesión', async () => {
    const outcome = await inRolledBackTransaction(async (trx) => {
      const user = await register(trx, ANA);
      const { token } = await login(trx, { email: ANA.email, password: ANA.password });
      await sql`UPDATE users SET deleted_at = now() WHERE id = ${user.id}`.execute(trx);
      return {
        me: await getUserByToken(trx, token),
        login: await errorOf(login(trx, { email: ANA.email, password: ANA.password })),
      };
    });

    expect(outcome.me).toBeUndefined();
    expect(outcome.login).toBe('401 UNAUTHENTICATED');
  });
});
