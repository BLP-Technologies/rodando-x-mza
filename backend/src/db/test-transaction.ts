import type { Transaction } from 'kysely';
import { getDb } from './index.js';
import type { DB } from './types.js';

/**
 * Señal para que la transacción de una prueba se deshaga: Kysely no tiene un "rollback"
 * explícito, y tirar dentro de `execute` es la forma documentada de pedirlo.
 *
 * Así un test que importa un grafo de mentira no deja filas en la base de desarrollo ni
 * depende de que alguien las limpie después. No se compila a `dist`: sólo lo usan los
 * `*.db.test.ts` (ver `tsconfig.build.json`).
 */
class Rollback extends Error {}

export async function inRolledBackTransaction<T>(
  work: (trx: Transaction<DB>) => Promise<T>,
): Promise<T> {
  let result: T | undefined;

  try {
    await getDb()
      .transaction()
      .execute(async (trx) => {
        result = await work(trx);
        throw new Rollback();
      });
  } catch (error) {
    if (!(error instanceof Rollback)) throw error;
  }

  return result as T;
}
