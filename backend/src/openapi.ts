import { OpenAPIRegistry, OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { bboxParamSchema, graphResponseSchema, updateGraphElementBodySchema, graphElementSchema, elementKindSchema } from './graph/graph.schemas.js';
import { errorResponseSchema } from './http/error-response.js';
import {
  createReportRequestSchema,
  reportImageSchema,
  reportSchema,
} from './reports/reports.schemas.js';
import { routeRequestSchema, routeResponseSchema } from './routing/routing.schemas.js';

/**
 * El documento `OpenAPI`, generado desde los esquemas Zod.
 *
 * El contrato se escribe una sola vez, en Zod, y de ahí salen el tipado del backend y el
 * documento que consumen los clientes ([02 §6](../docs/02-stack-y-estructura.md)). Se
 * genera al importar este módulo: es una constante, no un cálculo por pedido.
 */
const registry = new OpenAPIRegistry();

registry.registerPath({
  method: 'get',
  path: '/api/graph',
  summary: 'Leer el grafo de un área',
  description:
    'Devuelve las veredas, los cruces y los cordones que intersecan el bbox, como una ' +
    'FeatureCollection de GeoJSON, más las áreas de servicio activas en `service_areas`. ' +
    'Sólo lee: no escribe ni cachea nada. Si el área tiene más de 2000 elementos, ' +
    'devuelve las primeras y lo avisa con `truncated: true`; el tope no alcanza a las ' +
    'áreas, que no se filtran por bbox. Ver docs/14-la-api-del-grafo.md.',
  request: {
    query: z.object({ bbox: bboxParamSchema }),
  },
  responses: {
    200: {
      description:
        'Los elementos del área y las áreas de servicio activas. Una colección de ' +
        'elementos vacía es una respuesta válida: esa zona no tiene grafo. También lo es ' +
        'una base sin área activa: `service_areas.features` llega vacío y el grafo se ' +
        'devuelve igual.',
      content: { 'application/json': { schema: graphResponseSchema } },
    },
    400: {
      description:
        'El `bbox` no cumple el contrato: falta, no son cuatro números, está fuera de ' +
        'rango o tiene las esquinas invertidas.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    500: {
      description: 'Error no esperado.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: 'patch',
  path: '/api/graph/elements/{kind}/{id}',
  summary: 'Cambiar el nivel de accesibilidad de un elemento',
  description:
    'Escribe `accessibility_level` de una vereda, un cruce o un cordón, y devuelve el ' +
    'elemento como quedó, con la misma forma que una feature de GET /api/graph. ' +
    '`is_verified` no se manda: queda en true si hay nivel y en false si se vuelve a ' +
    '"sin dato" (`level: null`). El costo del ruteo no se recalcula: se deriva de la ' +
    'vista, así que cambia en la próxima consulta. Ver docs/14-la-api-del-grafo.md §7.',
  request: {
    params: z.object({ kind: elementKindSchema, id: z.coerce.number().int().positive() }),
    body: {
      content: { 'application/json': { schema: updateGraphElementBodySchema } },
    },
  },
  responses: {
    200: {
      description: 'El elemento con el nivel ya escrito.',
      content: { 'application/json': { schema: graphElementSchema } },
    },
    400: {
      description:
        'La clase o el `id` de la ruta no cumplen el contrato, o el cuerpo no trae ' +
        '`level`, lo trae fuera del enum o con un campo de más.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    404: {
      description: 'No hay ningún elemento de esa clase con ese id.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    500: {
      description: 'Error no esperado.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/routes/calculate',
  summary: 'Calcular un recorrido accesible',
  description:
    'Recibe el origen y el destino en coordenadas y devuelve el recorrido que no pasa ' +
    'por ningún tramo marcado como no accesible. Las dos puntas se validan contra el ' +
    'perímetro de búsqueda y se pegan al cordón más cercano. Cuando no hay recorrido ' +
    'responde 200 con `found: false`, que no es un error. Ver docs/13-api-de-ruteo.md.',
  request: {
    body: {
      content: { 'application/json': { schema: routeRequestSchema } },
    },
  },
  responses: {
    200: {
      description:
        'El recorrido, o la respuesta sin recorrido cuando las dos puntas no están ' +
        'conectadas por veredas accesibles.',
      content: { 'application/json': { schema: routeResponseSchema } },
    },
    400: {
      description:
        'El pedido no cumple el contrato, o una punta está fuera del perímetro de búsqueda.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    500: {
      description: 'Error no esperado.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/reports',
  summary: 'Reportar un obstáculo',
  description:
    'Guarda la percepción de quien reporta: el código de tipo del catálogo, la ' +
    'severidad, una descripción y el punto. El `type` es el **código** del ' +
    'catálogo `obstacle_types` (`POTHOLE`, `OTHER`, …), no su id; `OTHER` se ' +
    'acepta como cualquier otro. El punto no se valida contra las áreas de ' +
    'servicio: un reporte fuera del piloto se guarda igual. El reporte es ' +
    'anónimo mientras no haya autenticación, y nace en `PENDING`: las ' +
    'transiciones de estado son de la moderación. La imagen se sube antes con ' +
    'POST /api/reports/images y viaja en `image_url`. Ver docs/17-la-api-de-reportes.md.',
  request: {
    body: {
      content: { 'application/json': { schema: createReportRequestSchema } },
    },
  },
  responses: {
    201: {
      description:
        'El reporte guardado: su id, el tipo y la severidad que se pidieron, y el ' +
        'estado con el que nace (`PENDING`).',
      content: { 'application/json': { schema: reportSchema } },
    },
    400: {
      description:
        'El cuerpo no cumple el contrato, o el código de tipo no existe entre los ' +
        'activos.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    500: {
      description: 'Error no esperado.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/reports/images',
  summary: 'Subir la imagen de un reporte',
  description:
    'Recibe una imagen en multipart (`file`) y devuelve su URL, que después va en ' +
    '`image_url` al crear el reporte. Se aceptan PNG, JPEG y WebP de hasta 5 MB; ' +
    'SVG no, porque puede llevar script y se sirve desde el mismo dominio. Es un ' +
    'paso aparte del reporte para que el contrato del reporte siga siendo JSON y ' +
    'una imagen sin reporte sea un archivo huérfano. Ver docs/17-la-api-de-reportes.md §4.',
  request: {
    body: {
      content: {
        'multipart/form-data': {
          schema: {
            type: 'object',
            required: ['file'],
            properties: { file: { type: 'string', format: 'binary' } },
          },
        },
      },
    },
  },
  responses: {
    201: {
      description: 'La imagen guardada, con la URL que se usa en el reporte.',
      content: { 'application/json': { schema: reportImageSchema } },
    },
    400: {
      description:
        'No vino el archivo, o el archivo no es PNG, JPEG o WebP, o pesa más de 5 MB.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    500: {
      description: 'Error no esperado.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
});

export const openApiDocument = new OpenApiGeneratorV31(registry.definitions).generateDocument({
  openapi: '3.1.0',
  info: {
    title: 'Rodando x MZA',
    version: '0.0.0',
    description: 'API REST del grafo peatonal accesible del microcentro de Mendoza.',
  },
});
