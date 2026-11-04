/**
 * El mapeo `código de la API → texto en español` del portal.
 *
 * El backend nunca manda texto para la persona, manda códigos
 * ([04](../../docs/04-errores-y-mensajes.md)); traducirlos es trabajo de cada
 * cliente ([15 §6](../../docs/15-integracion-con-el-cliente.md)). Un código que
 * este archivo no conoce cae al mensaje genérico y no rompe nada.
 *
 * Los textos de lectura **no nombran una pantalla**: el mismo `INTERNAL_ERROR`
 * llega leyendo el grafo y leyendo los reportes, y decir "el grafo" en la lista de
 * reportes sería mentir sobre lo que falló (mismo código, mismo mensaje). Lo que sí
 * puede nombrar su objeto es la escritura del nivel y el pedido de recorrido, que
 * ocurren en un solo lugar.
 */

import { ApiError, NETWORK_ERROR } from './client';

const MESSAGES: Record<string, string> = {
  [NETWORK_ERROR]: 'No se pudo conectar con la API. Revisá que el backend esté levantado.',
  VALIDATION_ERROR: 'La API rechazó el pedido.',
  NOT_FOUND: 'Ese dato ya no está disponible.',
  INTERNAL_ERROR: 'La API falló al leer los datos. Probá de nuevo.',
};

/** Los errores del guardado del nivel, que no son los de la lectura del grafo. */
const SAVE_MESSAGES: Record<string, string> = {
  [NETWORK_ERROR]:
    'No se pudo guardar: no hay conexión con la API. Revisá que el backend esté levantado.',
  VALIDATION_ERROR: 'La API rechazó el nivel. Recargá la página y probá de nuevo.',
  NOT_FOUND: 'Ese elemento ya no está en el grafo. Se recargó el mapa.',
  INTERNAL_ERROR: 'La API falló al guardar. Probá de nuevo.',
};

const GENERIC_MESSAGE = 'No se pudieron leer los datos.';
const GENERIC_SAVE_MESSAGE = 'No se pudo guardar el nivel.';
const GENERIC_OBSTACLE_MESSAGE = 'No se pudo guardar el obstáculo.';

/**
 * Los errores de escritura de obstáculos: crear, resolver, aprobar y descartar.
 *
 * Van aparte de los del nivel porque el objeto es otro: decir "el nivel" al publicar un
 * obstáculo sería mentir sobre lo que falló.
 */
const OBSTACLE_MESSAGES: Record<string, string> = {
  [NETWORK_ERROR]:
    'No se pudo guardar: no hay conexión con la API. Revisá que el backend esté levantado.',
  VALIDATION_ERROR: 'La API rechazó el pedido. Revisá los datos y probá de nuevo.',
  NOT_FOUND: 'Ese obstáculo o ese reporte ya no está. Se recargó la pantalla.',
  CONFLICT: 'Ese reporte ya fue moderado. Se recargó la lista.',
  INTERNAL_ERROR: 'La API falló al guardar. Probá de nuevo.',
};

/**
 * Los motivos de dominio de `VALIDATION_ERROR`, que el código genérico no alcanza a explicar.
 *
 * `NO_NEARBY_ELEMENT` es del alta de obstáculos: el punto no tiene ningún elemento del grafo
 * dentro del radio de pegamento, y la acción de la persona es elegir otro punto
 * ([18 §3](../../docs/18-la-api-de-obstaculos.md), [04 §4](../../docs/04-errores-y-mensajes.md)).
 */
const DETAIL_MESSAGES: Record<string, string> = {
  NO_NEARBY_ELEMENT:
    'No hay ninguna vereda, cruce ni cordón cerca del punto. Elegí un punto sobre el recorrido peatonal.',
};

/**
 * El primer motivo de dominio conocido del `details`, o `null`.
 *
 * El `code` del sobre dice que la entrada no cumple el contrato; recién el motivo dice qué
 * hacer al respecto, y es lo único que cambia el mensaje.
 */
function detailMessage(error: ApiError): string | null {
  for (const detail of error.details ?? []) {
    const message = DETAIL_MESSAGES[detail.code];
    if (message !== undefined) return message;
  }

  return null;
}

/** El texto que ve la persona para un error de la API. */
export function describeApiError(error: unknown): string {
  if (!(error instanceof ApiError)) return GENERIC_MESSAGE;

  return MESSAGES[error.code] ?? GENERIC_MESSAGE;
}

/** El mismo mapeo, para el guardado del nivel: el mismo código significa otra cosa. */
export function describeSaveError(error: unknown): string {
  if (!(error instanceof ApiError)) return GENERIC_SAVE_MESSAGE;

  return SAVE_MESSAGES[error.code] ?? GENERIC_SAVE_MESSAGE;
}

/**
 * El texto de una escritura de obstáculos, con el motivo de dominio cuando lo hay.
 *
 * Es la que usa la pantalla de obstáculos y la moderación de reportes: el motivo del
 * `details` gana sobre el mensaje del código porque es el que dice qué hacer.
 */
export function describeObstacleError(error: unknown): string {
  if (!(error instanceof ApiError)) return GENERIC_OBSTACLE_MESSAGE;

  return detailMessage(error) ?? OBSTACLE_MESSAGES[error.code] ?? GENERIC_OBSTACLE_MESSAGE;
}

/**
 * Los errores del pedido de recorrido.
 *
 * Van aparte porque el motivo de dominio no alcanza con el código: `OUTSIDE_SERVICE_AREA`
 * dice **qué punta** quedó fuera, y la acción de la persona es marcar otra punta, no
 * corregir un dato ([13 §8](../../docs/13-api-de-ruteo.md#8-cómo-se-rechaza)).
 */
const ROUTE_MESSAGES: Record<string, string> = {
  [NETWORK_ERROR]:
    'No se pudo pedir el recorrido: no hay conexión con la API. Revisá que el backend esté levantado.',
  VALIDATION_ERROR: 'La API rechazó el pedido. Revisá las puntas y probá de nuevo.',
  INTERNAL_ERROR: 'La API falló al calcular el recorrido. Probá de nuevo.',
};

const GENERIC_ROUTE_MESSAGE = 'No se pudo calcular el recorrido.';

/**
 * El texto de una punta fuera del perímetro, según cuál sea.
 *
 * Los `details` de la API traen `{ field, code }`, con `field` como ruta del campo
 * (`origin`, `destination`, `origin.lat`): por eso se compara por prefijo y no por igualdad.
 * Si la punta no se reconoce, devuelve `null` y gana el mensaje del código, que es un texto
 * correcto y no inventa una localización.
 */
function outsideServiceAreaMessage(error: ApiError): string | null {
  let origin = false;
  let destination = false;

  for (const detail of error.details ?? []) {
    if (detail.code !== 'OUTSIDE_SERVICE_AREA') continue;
    if (detail.field.startsWith('origin')) origin = true;
    if (detail.field.startsWith('destination')) destination = true;
  }

  if (origin && destination) {
    return 'El origen y el destino están fuera de la zona de servicio. Marcá los dos puntos dentro del borde azul.';
  }
  if (origin) {
    return 'El origen está fuera de la zona de servicio. Marcá un punto dentro del borde azul.';
  }
  if (destination) {
    return 'El destino está fuera de la zona de servicio. Marcá un punto dentro del borde azul.';
  }

  return null;
}

/**
 * El texto de un pedido de recorrido que la API rechazó.
 *
 * `found: false` **nunca** pasa por acá: no tiene recorrido pero no es un error
 * ([13 §6](../../docs/13-api-de-ruteo.md#6-cuando-no-hay-recorrido)).
 */
export function describeRouteError(error: unknown): string {
  if (!(error instanceof ApiError)) return GENERIC_ROUTE_MESSAGE;

  return outsideServiceAreaMessage(error) ?? ROUTE_MESSAGES[error.code] ?? GENERIC_ROUTE_MESSAGE;
}
