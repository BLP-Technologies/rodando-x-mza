import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Router, static as serveStatic } from 'express';

/**
 * La versión navegable del contrato, en `GET /api/docs`.
 *
 * La página no lleva el contrato adentro: lo pide a `GET /api/openapi.json`, que es el
 * único lugar donde se genera desde los esquemas Zod. La UI se sirve desde el propio
 * backend (`swagger-ui-dist`), así que se lee sin internet y no hay paso de generación.
 *
 * Las rutas de los archivos van absolutas porque la página se pide sin barra final: tanto
 * `GET /api/docs` como `GET /api/docs/` tienen que responder el HTML.
 */
const docsPage = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>API de Rodando x MZA</title>
    <link rel="stylesheet" href="/api/docs/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="/api/docs/swagger-ui-bundle.js"></script>
    <script>
      SwaggerUIBundle({ url: '/api/openapi.json', dom_id: '#swagger-ui' });
    </script>
  </body>
</html>
`;

/** Los archivos de la UI, en `node_modules/swagger-ui-dist`. */
const assetsDirectory = dirname(
  fileURLToPath(import.meta.resolve('swagger-ui-dist/package.json')),
);

export const docsRouter = Router();

docsRouter.get('/', (_req, res) => {
  res.type('html').send(docsPage);
});

// Sirve el bundle y la hoja de estilo de la página, y nada más: `index: false` evita que
// la página de ejemplo del paquete pise al HTML de arriba.
docsRouter.use('/', serveStatic(assetsDirectory, { index: false }));
