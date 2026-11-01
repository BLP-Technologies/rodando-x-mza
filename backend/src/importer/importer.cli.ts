import { resolve } from 'node:path';
import { getDb } from '../db/index.js';
import { getLogger } from '../logger.js';
import { importOsm } from './importer.run.js';

/**
 * `pnpm import:osm [ruta]`: importa el extracto y deja el reporte en la salida.
 *
 * La ruta por defecto es relativa a `backend/`, que es desde donde corre el script; el
 * extracto no se versiona (docs/10 §4), así que si no está el error dice cómo generarlo.
 */
const DEFAULT_EXTRACT = '../data/pilot-zone.osm';

const filePath = resolve(process.argv[2] ?? DEFAULT_EXTRACT);
const logger = getLogger();

const db = getDb();

try {
  const report = await db.transaction().execute((trx) => importOsm(filePath, trx));
  logger.info(report, 'import:osm');
} catch (error) {
  logger.error({ err: error }, 'import:osm falló');
  process.exitCode = 1;
} finally {
  await db.destroy();
}
