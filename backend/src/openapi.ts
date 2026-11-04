import { OpenAPIRegistry, OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { bboxParamSchema, graphResponseSchema, updateGraphElementBodySchema, graphElementSchema, elementKindSchema } from './graph/graph.schemas.js';
import { errorResponseSchema } from './http/error-response.js';
import {
  createObstacleRequestSchema,
  obstacleFeatureSchema,
  obstaclesResponseSchema,
  obstacleStatusFilterSchema,
} from './obstacles/obstacles.schemas.js';
import {
  approveReportRequestSchema,
  approveReportResponseSchema,
  createReportRequestSchema,
  reportDecisionSchema,
  reportImageSchema,
  reportSchema,
  reportsResponseSchema,
  reportStatusSchema,
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
  method: 'get',
  path: '/api/reports',
  summary: 'Leer los reportes de un estado',
  description:
    'Devuelve los reportes ciudadanos de un estado, como una FeatureCollection de ' +
    'GeoJSON, con el punto reportado y ocho propiedades por informe: el código y el ' +
    'nombre del tipo, la severidad, la descripción, la foto si hay y la fecha en ISO. ' +
    'El filtro por estado es del servidor y tiene PENDING por defecto, que es la cola ' +
    'de trabajo del moderador. Los reportes dados de baja no aparecen en ningún ' +
    'estado. Si hay más de 2000, devuelve los más nuevos y lo avisa con ' +
    '`truncated: true`. Ver docs/17-la-api-de-reportes.md §7.',
  request: {
    query: z.object({
      // El default viaja en la descripción y no como `default` del parámetro: el
      // esquema es un `$ref` al enum y el documento no repite su forma.
      status: reportStatusSchema.default('PENDING').meta({
        description:
          'Estado por el que se filtra, con los valores del enum del ciclo de ' +
          'moderación. Si falta, se devuelven los pendientes (`PENDING`).',
      }),
    }),
  },
  responses: {
    200: {
      description:
        'Los reportes del estado pedido, del más nuevo al más antiguo. Una colección ' +
        'vacía es una respuesta válida: no hay reportes en ese estado.',
      content: { 'application/json': { schema: reportsResponseSchema } },
    },
    400: {
      description:
        'El estado no es uno del enum, o la query trae un parámetro que el contrato ' +
        'no tiene.',
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

registry.registerPath({
  method: 'get',
  path: '/api/obstacles',
  summary: 'Leer los obstáculos de un estado',
  description:
    'Devuelve los obstáculos publicados, como una FeatureCollection de GeoJSON, con el ' +
    'punto de cada uno, su tipo y su nombre, la severidad, la fecha de resolución —' +
    '`null` si sigue activo—, el elemento del grafo al que está pegado y cuántos ' +
    'reportes lo apuntan. Al lado de las features viaja `obstacle_types`, el catálogo de ' +
    'tipos activos sin `OTHER`, que es la lista del formulario del portal. El filtro por ' +
    'estado es del servidor y tiene `ACTIVE` por defecto; un obstáculo activo es el que ' +
    'no tiene `resolved_at`. Los dados de baja no aparecen en ningún estado. Si hay más ' +
    'de 2000, devuelve los más nuevos y lo avisa con `truncated: true`. ' +
    'Ver docs/18-la-api-de-obstaculos.md §4.',
  request: {
    query: z.object({
      // El default viaja en la descripción y no como `default` del parámetro: el
      // esquema es un `$ref` al enum y el documento no repite su forma.
      status: obstacleStatusFilterSchema.default('ACTIVE').meta({
        description:
          'Qué obstáculos se devuelven: los activos, los resueltos o todos. Si falta, ' +
          'se devuelven los activos (`ACTIVE`).',
      }),
    }),
  },
  responses: {
    200: {
      description:
        'Los obstáculos del estado pedido, del más nuevo al más antiguo, con el catálogo ' +
        'de tipos activos en `obstacle_types`. Una colección vacía es una respuesta ' +
        'válida: no hay obstáculos en ese estado.',
      content: { 'application/json': { schema: obstaclesResponseSchema } },
    },
    400: {
      description:
        'El estado no es uno del enum, o la query trae un parámetro que el contrato no ' +
        'tiene.',
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
  path: '/api/obstacles',
  summary: 'Crear un obstáculo',
  description:
    'Publica un obstáculo: el código de tipo del catálogo, la severidad y el punto. El ' +
    'cuerpo no trae el elemento del grafo al que se cuelga: lo decide el servidor, ' +
    'pegando el punto al más cercano entre veredas, cruces y cordones. Si no hay ningún ' +
    'elemento cerca responde 400 con el motivo `NO_NEARBY_ELEMENT`, y si el tipo no ' +
    'existe, está inactivo o es `OTHER` responde 400 con el campo `type`. El punto de la ' +
    'respuesta es el que mandó el cliente. El obstáculo nace activo y el ruteo lo cobra ' +
    'en la consulta siguiente. Ver docs/18-la-api-de-obstaculos.md §3.',
  request: {
    body: { content: { 'application/json': { schema: createObstacleRequestSchema } } },
  },
  responses: {
    201: {
      description:
        'El obstáculo creado, con la misma forma que una feature de GET /api/obstacles.',
      content: { 'application/json': { schema: obstacleFeatureSchema } },
    },
    400: {
      description:
        'El cuerpo no cumple el contrato, el código de tipo no sirve como obstáculo o ' +
        'no hay ningún elemento del grafo dentro del radio de pegamento.',
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
  path: '/api/obstacles/{id}/resolve',
  summary: 'Resolver un obstáculo',
  description:
    'Marca el obstáculo como resuelto escribiendo `resolved_at`, y desde la consulta ' +
    'siguiente deja de sumar en el ruteo. No lleva cuerpo y es idempotente: resolver un ' +
    'obstáculo ya resuelto responde 200 con el mismo obstáculo y no cambia la fecha. ' +
    'Responde 404 si el id no existe o está dado de baja. No toca los reportes que lo ' +
    'apuntan. Ver docs/18-la-api-de-obstaculos.md §5.',
  request: {
    params: z.object({ id: z.coerce.number().int().positive() }),
  },
  responses: {
    200: {
      description: 'El obstáculo resuelto, con la misma forma que una feature de la lectura.',
      content: { 'application/json': { schema: obstacleFeatureSchema } },
    },
    400: {
      description: 'El `id` de la ruta no es un entero positivo.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    404: {
      description: 'No hay ningún obstáculo con ese id, o está dado de baja.',
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
  path: '/api/reports/{id}/approve',
  summary: 'Aprobar un reporte',
  description:
    'Publica el obstáculo de un reporte con la clasificación que decide el moderador y ' +
    'marca el reporte como `APPROVED` apuntándolo al obstáculo nuevo. El punto sale del ' +
    'reporte: aprobar no mueve el pin. Todo ocurre en una transacción, en este orden: ' +
    'bloquear el reporte, pegar su punto al elemento del grafo más cercano, insertar el ' +
    'obstáculo y marcar el reporte. Si no hay ningún elemento cerca responde 400 con ' +
    '`NO_NEARBY_ELEMENT` y el reporte sigue `PENDING`. Ver ' +
    'docs/18-la-api-de-obstaculos.md §6.',
  request: {
    params: z.object({ id: z.coerce.number().int().positive() }),
    body: { content: { 'application/json': { schema: approveReportRequestSchema } } },
  },
  responses: {
    201: {
      description:
        'El obstáculo creado y el reporte marcado, que son los dos recursos que cambiaron.',
      content: { 'application/json': { schema: approveReportResponseSchema } },
    },
    400: {
      description:
        'El cuerpo no cumple el contrato, el código de tipo no sirve como obstáculo o no ' +
        'hay ningún elemento del grafo cerca del punto del reporte.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    404: {
      description: 'No hay ningún reporte con ese id, o está dado de baja.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    409: {
      description: 'El reporte ya no está `PENDING`: alguien lo aprobó o lo descartó.',
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
  path: '/api/reports/{id}/reject',
  summary: 'Descartar un reporte',
  description:
    'Marca un reporte como `REJECTED` sin crear nada, en una transacción. No lleva ' +
    'cuerpo. Es la salida para un duplicado o para lo que no corresponde a un obstáculo. ' +
    'La decisión se toma una sola vez: un reporte que ya no está `PENDING` responde 409, y ' +
    'uno inexistente o dado de baja, 404. Ver docs/18-la-api-de-obstaculos.md §6.',
  request: {
    params: z.object({ id: z.coerce.number().int().positive() }),
  },
  responses: {
    200: {
      description: 'El reporte descartado: su id, el estado `REJECTED` y `obstacle_id` nulo.',
      content: { 'application/json': { schema: reportDecisionSchema } },
    },
    400: {
      description: 'El `id` de la ruta no es un entero positivo.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    404: {
      description: 'No hay ningún reporte con ese id, o está dado de baja.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    409: {
      description: 'El reporte ya no está `PENDING`: alguien lo aprobó o lo descartó.',
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
