"use client";

/**
 * El montaje de un mapa de Leaflet, en un solo lugar.
 *
 * Las tres pantallas que dibujan un mapa —el grafo, los obstáculos y el recorrido—
 * necesitan lo mismo: un `L.Map` sobre un contenedor, los tiles de OSM con la atribución
 * obligatoria ([10 §3](../../docs/10-datos-y-zona-piloto.md)), la vista inicial del piloto
 * y un `LayerGroup` propio donde dibujar. Eso vive acá, y cada pantalla se ocupa de sus
 * capas.
 *
 * **Sin `react-leaflet`.** Su `MapContainer` crea el mapa una vez y lo destruye en el
 * cleanup de su efecto, pero no lo vuelve a crear si React re-monta el componente: como
 * `Map.remove()` vacía los panes de Leaflet, las capas que después se le agregaban
 * reventaban en `getPane(...).appendChild` al volver al grafo desde otra pantalla. Con el
 * ciclo en nuestras manos, cada montaje crea un mapa y lo destruye al desmontarse, y las
 * capas se dibujan por efectos sobre esa instancia ([16 §5.1](../../docs/16-el-portal.md)).
 *
 * Importa Leaflet, así que **nunca** puede evaluarse en el servidor: quien lo usa ya está
 * debajo de un `ssr: false` ([16 §5.2](../../docs/16-el-portal.md)).
 */

import "leaflet/dist/leaflet.css";

import { useEffect, useRef } from "react";
import * as L from "leaflet";
import type { LatLngBoundsLiteral } from "leaflet";

import { PILOT_BOUNDS } from "@/config";

export const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

/**
 * El texto de atribución de OSM, tal cual lo dibuja el control de Leaflet.
 *
 * No es cortesía: los datos son ODbL 1.0 y la atribución es obligatoria
 * ([10 §3](../../docs/10-datos-y-zona-piloto.md)).
 */
export const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** Más lejos que el piloto no aporta y más cerca se pierde el barrio. */
const MIN_ZOOM = 13;
const MAX_ZOOM = 19;

/** La caja del piloto en la forma que espera Leaflet: la vista con la que abre el mapa. */
export const PILOT_VIEW: LatLngBoundsLiteral = [
  [PILOT_BOUNDS.minLat, PILOT_BOUNDS.minLon],
  [PILOT_BOUNDS.maxLat, PILOT_BOUNDS.maxLon],
];

/**
 * Lo que el mapa avisa hacia afuera. Las dos son opcionales: un mapa que no se toca, como
 * el del recorrido sin modo de clic, no necesita ninguna.
 */
type LeafletMapHandlers = {
  /** Un clic en el fondo del mapa. Las capas dibujadas sobre él no lo tapan si se pintan
   * con `bubblingMouseEvents: false`. */
  onClick?: (latlng: L.LatLng) => void;
  /** Un paneo o un zoom terminado, con los límites de la vista nueva. */
  onMoveEnd?: (bounds: L.LatLngBounds) => void;
};

type LeafletMap = {
  /** Va en el `<div>` que contiene el mapa. */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** La instancia, para lo que necesite mirar la vista (`fitBounds`, `getCenter`). */
  mapRef: React.RefObject<L.Map | null>;
  /** Donde van las capas de la pantalla: se vacía y se redibuja con los datos. */
  layersRef: React.RefObject<L.LayerGroup | null>;
};

/**
 * Monta un mapa de Leaflet sobre el contenedor que devuelve, y lo destruye al desmontarse.
 *
 * El mapa y las capas son dueños exclusivos de este hook: los efectos de la pantalla
 * dibujan sobre `layersRef.current`, así que nunca hay una capa hablándole a un mapa que
 * ya no existe.
 */
export function useLeafletMap(handlers: LeafletMapHandlers): LeafletMap {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<L.LayerGroup | null>(null);

  /**
   * Los manejadores, en un ref.
   *
   * El listener vive lo que vive el mapa, así que no puede volver a engancharse en cada
   * render: el ref le deja leer el modo actual sin recrear la instancia ni el listener.
   * Es el patrón que ya usaban los dos mapas que este hook reemplaza.
   */
  const handlersRef = useRef(handlers);

  // Sin lista de dependencias: el ref se sincroniza en cada render, que es lo que hace
  // que el listener vea siempre el último modo.
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) return;

    const map = new L.Map(container, { minZoom: MIN_ZOOM, maxZoom: MAX_ZOOM });
    map.fitBounds(PILOT_VIEW);
    new L.TileLayer(TILE_URL, {
      attribution: OSM_ATTRIBUTION,
      maxZoom: MAX_ZOOM,
    }).addTo(map);

    // El orden de alta es el orden de pintado: todo lo que la pantalla agregue después
    // queda encima de los tiles.
    const layers = new L.LayerGroup().addTo(map);

    map.on("click", (event) => handlersRef.current.onClick?.(event.latlng));
    map.on("moveend", () => handlersRef.current.onMoveEnd?.(map.getBounds()));

    mapRef.current = map;
    layersRef.current = layers;

    return () => {
      // El mapa se destruye con el efecto que lo creó: `remove()` vacía los panes de
      // Leaflet, así que una instancia que sobreviva queda rota para siempre. Primero se
      // vacía lo dibujado, porque soltar las capas después de `remove()` deja manejadores
      // apuntando a un mapa destruido.
      layers.clearLayers();
      map.off();
      map.remove();
      mapRef.current = null;
      layersRef.current = null;
    };
  }, []);

  return { containerRef, mapRef, layersRef };
}
