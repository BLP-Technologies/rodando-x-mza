/**
 * Las etiquetas y los colores de la pantalla de ruta, en español y en un solo lugar.
 *
 * El nivel de un tramo no se traduce acá: los cuatro nombres —y sus colores— son los del
 * mapa y viven en `map/feature-style.ts`, porque el detalle del recorrido muestra el nivel de
 * cada tramo con el mismo criterio que una vereda del grafo
 * ([16 §5.3](../../docs/16-el-portal.md)). Duplicarlos sería tener dos verdades sobre qué
 * significa `PARTIAL`.
 *
 * La geometría del recorrido tiene su propio estilo y vive con los demás del mapa: es una
 * sola línea y no una por tramo.
 */

import type { RouteLeg } from '@/api/routes';

/**
 * El nombre de cada clase de elemento de un tramo.
 *
 * Son dos y no las tres del grafo: un recorrido pasa por veredas y cruces, nunca por un
 * cordón, que es un vértice y no un tramo ([13 §7](../../docs/13-api-de-ruteo.md)). No se
 * importa el mapa de la pantalla de obstáculos a propósito: una pantalla no depende de otra,
 * y las dos palabras son el costo de mantenerlas separadas.
 */
export const LEG_KIND_LABELS: Record<RouteLeg['element_kind'], string> = {
  sidewalk: 'Vereda',
  crossing: 'Cruce',
};

/**
 * Los colores de las dos puntas del recorrido.
 *
 * Fuera de la paleta de niveles y del azul del área (§5.3, §5.7): marcan dónde empieza y
 * termina el recorrido, no qué tan accesible es. Son los mismos del panel, para que la punta
 * de la lista y la del mapa se lean como la misma cosa.
 */
export const ORIGIN_COLOR = '#0f766e';
export const DESTINATION_COLOR = '#7e22ce';

/**
 * El punto que se marcó con el clic, tenue y sin relleno.
 *
 * Existe para que se vea la diferencia con el nodo pegado: el recorrido no nace donde está
 * el pin sino en el cordón más cercano ([13 §4.2](../../docs/13-api-de-ruteo.md)).
 */
export const PICKED_POINT_COLOR = '#334155';

/** Los metros con un decimal, que es la precisión con la que viaja el dato. */
const METERS = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 });

export function formatMeters(value: number): string {
  return `${METERS.format(value)} m`;
}

/**
 * Si el tramo se apoya en algo que alguien miró.
 *
 * `is_verified` es el dato y no una impresión: hoy el grafo entero está sin relevar, así que
 * el aviso se enciende solo ([13 §7](../../docs/13-api-de-ruteo.md)).
 */
export function verificationLabel(isVerified: boolean): string {
  return isVerified ? 'Verificado' : 'Sin relevar';
}
