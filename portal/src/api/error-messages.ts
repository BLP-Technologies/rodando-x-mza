/**
 * El mapeo `código de la API → texto en español` del portal.
 *
 * El backend nunca manda texto para la persona, manda códigos
 * ([04](../../docs/04-errores-y-mensajes.md)); traducirlos es trabajo de cada
 * cliente ([15 §6](../../docs/15-integracion-con-el-cliente.md)). Un código que
 * este archivo no conoce cae al mensaje genérico y no rompe nada.
 */

import { ApiError, NETWORK_ERROR } from './client';

const MESSAGES: Record<string, string> = {
  [NETWORK_ERROR]: 'No se pudo conectar con la API. Revisá que el backend esté levantado.',
  VALIDATION_ERROR: 'La API rechazó el área del mapa.',
  NOT_FOUND: 'Ese elemento ya no está en el grafo. Se recargó el mapa.',
  INTERNAL_ERROR: 'La API falló al leer el grafo. Probá de nuevo.',
};

/** Los errores del guardado del nivel, que no son los de la lectura del grafo. */
const SAVE_MESSAGES: Record<string, string> = {
  [NETWORK_ERROR]:
    'No se pudo guardar: no hay conexión con la API. Revisá que el backend esté levantado.',
  VALIDATION_ERROR: 'La API rechazó el nivel. Recargá la página y probá de nuevo.',
  NOT_FOUND: 'Ese elemento ya no está en el grafo. Se recargó el mapa.',
  INTERNAL_ERROR: 'La API falló al guardar. Probá de nuevo.',
};

const GENERIC_MESSAGE = 'No se pudo leer el grafo.';
const GENERIC_SAVE_MESSAGE = 'No se pudo guardar el nivel.';

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
