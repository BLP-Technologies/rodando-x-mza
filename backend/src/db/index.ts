import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';
import { loadConfig } from '../config.js';
import type { DB } from './types.js';

const { Pool } = pg;

let instance: Kysely<DB> | undefined;

/**
 * Devuelve la conexión a la base, creándola la primera vez.
 *
 * Es lazy a propósito: importar este módulo no exige que las variables de
 * entorno estén definidas, así el arranque y los tests pueden convivir.
 */
export function getDb(): Kysely<DB> {
  instance ??= new Kysely<DB>({
    dialect: new PostgresDialect({
      pool: new Pool({ connectionString: loadConfig().DATABASE_URL }),
    }),
  });

  return instance;
}
