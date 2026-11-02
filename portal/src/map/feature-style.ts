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
    opacity: isSelected ? 1 : 0.8,
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
    fillOpacity: isSelected ? 1 : 0.8,
    weight: isSelected ? 3 : 1,
    radius: isSelected ? 9 : 5,
    bubblingMouseEvents: false,
  };
}
