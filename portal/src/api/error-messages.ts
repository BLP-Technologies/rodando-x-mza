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
 * puede nombrar su objeto es el guardado del nivel, que ocurre en un solo lugar.
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
