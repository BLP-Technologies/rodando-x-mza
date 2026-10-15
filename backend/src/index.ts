import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { getLogger } from './logger.js';

const config = loadConfig();
const logger = getLogger();
const app = createApp();

app.listen(config.PORT, () => {
  logger.info(`API escuchando en http://localhost:${config.PORT}`);
});
