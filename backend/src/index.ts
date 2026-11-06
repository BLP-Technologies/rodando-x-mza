import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { warnIfCorsAllowlistIsEmpty } from './http/cors.js';
import { getLogger } from './logger.js';

const config = loadConfig();
const logger = getLogger();
const app = createApp({ corsOrigins: config.CORS_ORIGINS });

// `CORS_ORIGINS` vacío no rompe el arranque, pero en desarrollo casi siempre es un `.env`
// que quedó viejo, y el síntoma aparece lejos: en el navegador.
warnIfCorsAllowlistIsEmpty(config.CORS_ORIGINS, config.NODE_ENV, logger);

app.listen(config.PORT, () => {
  logger.info(`API escuchando en http://localhost:${config.PORT}`);
});
