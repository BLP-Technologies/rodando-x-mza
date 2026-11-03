import { getDb } from '../db/index.js';
import { getLogger } from '../logger.js';
import { seedReports } from './reports.seed.js';

/**
 * `pnpm seed:reports`: carga diez reportes de prueba para el portal.
 *
 * Es desarrollo, no producción: escribe en la base que diga `DATABASE_URL` y **agrega**
 * cada vez que se corre. Para volver a cero, `DELETE FROM reports`.
 */
const db = getDb();
const logger = getLogger();

try {
  const outcome = await db.transaction().execute((trx) => seedReports(trx));
  logger.info(outcome, 'seed:reports');
} catch (error) {
  logger.error({ err: error }, 'seed:reports falló');
  process.exitCode = 1;
} finally {
  await db.destroy();
}
