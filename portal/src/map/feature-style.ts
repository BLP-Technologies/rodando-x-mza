/**
 * El estilo del mapa por nivel de accesibilidad.
 *
 * Cuatro colores y no tres: `null` (nadie lo relevó) es el caso más común del
 * grafo importado y **no** es lo mismo que `NONE` (se relevó y no es
 * accesible). Gris contra rojo los distingue de un vistazo
 * ([09 §4.1](../../docs/09-modelo-de-datos.md)).
 */

import type { CircleMarkerOptions, PathOptions } from "leaflet";
import type { GraphLevel } from "@/api/graph";

/** Nivel más el caso "sin relevar", que es un `null` en el dato. */
export type LevelKey = "FULL" | "PARTIAL" | "NONE" | "UNKNOWN";

const COLORS: Record<LevelKey, string> = {
  FULL: "#15803d",
  PARTIAL: "#b45309",
  NONE: "#b91c1c",
  UNKNOWN: "#475569",
};

/** El texto de cada nivel, para el panel de propiedades. */
const LABELS: Record<LevelKey, string> = {
  FULL: "Accesible",
  PARTIAL: "Accesible con dificultad",
  NONE: "No accesible",
  UNKNOWN: "Sin relevar",
};

/** `null` es "sin relevar", no un cuarto valor del enum. */
export function levelKey(level: GraphLevel): LevelKey {
  return level ?? "UNKNOWN";
}

export function levelLabel(level: GraphLevel): string {
  return LABELS[levelKey(level)];
}

/**
 * El estilo de una vereda o un cruce. El seleccionado engrosa el trazo y sube
 * la opacidad: alcanza para encontrarlo sin tapar el resto del grafo.
 *
 * `bubblingMouseEvents: false` evita que el clic llegue también al fondo del
 * mapa, que es el que suelta la selección.
 */
export function lineStyle(level: GraphLevel, isSelected: boolean): PathOptions {
  return {
    color: COLORS[levelKey(level)],
    weight: isSelected ? 9 : 5,
    opacity: isSelected ? 1 : 0.7,
    bubblingMouseEvents: false,
  };
}

/** El de un cordón, que es un punto chico: el radio hace de grosor. */
export function pointStyle(
  level: GraphLevel,
  isSelected: boolean,
): CircleMarkerOptions {
  return {
    color: COLORS[levelKey(level)],
    fillColor: COLORS[levelKey(level)],
    fillOpacity: isSelected ? 1 : 0.7,
    weight: isSelected ? 3 : 1,
    radius: isSelected ? 9 : 5,
    bubblingMouseEvents: false,
  };
}

/**
 * El borde del área de servicio activa: una línea de guiones, sin relleno.
 *
 * El azul es el quinto color, fuera de la paleta de niveles (verde, ámbar, rojo
 * y gris), para que el borde no se lea como un dato de accesibilidad: es el
 * límite de la zona, no el estado de un elemento ([16 §5.7](../../docs/16-el-portal.md)).
 *
 * `interactive: false` es lo que hace que **no capture clics**: Leaflet le pone
 * `pointer-events: none` a la capa, así el clic sigue llegando a la vereda de
 * abajo o al fondo del mapa, que suelta la selección.
 */
export function serviceAreaStyle(): PathOptions {
  return {
    color: "#1d4ed8",
    weight: 4,
    dashArray: "6 8",
    fill: false,
    opacity: 0.8,
    interactive: false,
    bubblingMouseEvents: false,
  };
}

/** El color del recorrido dibujado, y el único: la geometría no va por nivel. */
const ROUTE_COLOR = "#2563eb";

/**
 * El recorrido en el mapa: azul y más grueso que una arista del grafo.
 *
 * **Un solo color y no el del nivel de cada tramo.** El nivel ya está en el grafo —que se
 * prende y se apaga como capa— y en el detalle del panel; pintar cada tramo con el suyo ponía
 * dos paletas sobre el mismo mapa y no decía nada que las otras dos no digan. Lo que hay que
 * poder seguir con la vista es el camino, de punta a punta.
 *
 * Azul y más grueso que una vereda o un cruce (5 px): se lee por encima de lo que lo rodea sin
 * dejar de ser una línea. `interactive: false` porque el recorrido es la respuesta y no un
 * objeto que se clickea, así el clic del mapa le pasa por debajo en vez de comérselo.
 */
export function routeLineStyle(): PathOptions {
  return {
    color: ROUTE_COLOR,
    weight: 8,
    opacity: 0.9,
    lineCap: "round",
    lineJoin: "round",
    interactive: false,
  };
}
