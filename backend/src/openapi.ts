import { OpenAPIRegistry, OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import {
  errorResponseSchema,
  routeRequestSchema,
  routeResponseSchema,
} from './routing/routing.schemas.js';

/**
 * El documento `OpenAPI`, generado desde los esquemas Zod.
 *
 * El contrato se escribe una sola vez, en Zod, y de ahí salen el tipado del backend y el
 * documento que consumen los clientes ([02 §6](../docs/02-stack-y-estructura.md)). Se
 * genera al importar este módulo: es una constante, no un cálculo por pedido.
 */
const registry = new OpenAPIRegistry();

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

export const openApiDocument = new OpenApiGeneratorV31(registry.definitions).generateDocument({
  openapi: '3.1.0',
  info: {
    title: 'Rodando x MZA',
    version: '0.0.0',
    description: 'API REST del grafo peatonal accesible del microcentro de Mendoza.',
  },
});
