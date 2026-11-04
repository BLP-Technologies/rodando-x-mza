'use client';

/**
 * El mapa de la pantalla de ruta: el borde del área de servicio como contexto y, encima, el
 * recorrido con sus dos puntas.
 *
 * **No dibuja el grafo.** Veredas y cruces son de `/`, con su control de capas, que es de otra
 * tarea ([16 §8.3](../../docs/16-el-portal.md)): acá lo que se pregunta es por dónde se puede
 * caminar entre dos puntos, y mil elementos grises alrededor no ayudan a leerlo.
 *
 * El montaje de Leaflet lo hace `map/use-leaflet-map.ts`, que comparten las tres pantallas con
 * mapa; este archivo se ocupa de lo propio: qué se dibuja y en qué orden.
 *
 * Importa Leaflet, así que **nunca** puede evaluarse en el servidor: el único que lo monta es
 * `routes-screen.tsx`, que ya viene debajo del `ssr: false` de `routes-panel.tsx`.
 */

import 'leaflet/dist/leaflet.css';

import { useEffect } from 'react';
import type { RefObject } from 'react';
import * as L from 'leaflet';

import type { ServiceArea } from '@/api/graph';
import type { RoutePoint, RouteResponse } from '@/api/routes';
import { lineStyle, serviceAreaStyle } from '@/map/feature-style';
import { useLeafletMap } from '@/map/use-leaflet-map';
import {
  DESTINATION_COLOR,
  ORIGIN_COLOR,
  PICKED_POINT_COLOR,
} from './route-labels';

/** Qué punta se está marcando con el próximo clic, o ninguna. */
export type PickingMode = 'origin' | 'destination' | null;

type RoutesMapProps = {
  /** El borde del área activa: el contexto del rechazo por perímetro ([16 §5.7]). */
  serviceAreas: readonly ServiceArea[];
  /** El último recorrido pedido. `found: false` también trae las dos puntas pegadas. */
  route: RouteResponse | null;
  /** Las coordenadas marcadas, que no son los nodos pegados ([13 §4.2]). */
  origin: RoutePoint | null;
  destination: RoutePoint | null;
  picking: PickingMode;
  onPick: (point: RoutePoint) => void;
  /**
   * El centro de la vista actual, escrito por el mapa y leído por el botón "Usar el centro
   * del mapa".
   *
   * Es un ref y no estado por una razón de fondo: un clic en el mapa no se puede hacer con
   * el teclado, así que el camino accesible para elegir un punto es ese botón, y necesita
   * saber qué está mirando el mapa sin que un paneo vuelva a renderizar la pantalla.
   */
  centerRef: RefObject<RoutePoint | null>;
};

/** GeoJSON y la API guardan `[lon, lat]`; Leaflet dibuja `[lat, lon]`. */
function toLatLng([lon, lat]: [number, number]): [number, number] {
  return [lat, lon];
}

function toPoint(latlng: L.LatLng): RoutePoint {
  return { lat: latlng.lat, lon: latlng.lng };
}

/**
 * El nodo al que se pegó una punta, con el color de esa punta.
 *
 * `interactive: false` para que no capture clics: en esta pantalla el mapa no selecciona
 * nada, y un marcador que se come el clic del modo de elegir punto rompe el modo.
 */
function endpointMarker(
  point: { lat: number; lon: number },
  color: string,
): L.CircleMarker {
  return new L.CircleMarker([point.lat, point.lon], {
    radius: 9,
    color: '#ffffff',
    weight: 3,
    fillColor: color,
    fillOpacity: 1,
    interactive: false,
  });
}

/** El punto que se marcó con el clic, tenue y sin relleno, para no confundirlo con el nodo. */
function pickedMarker(point: RoutePoint): L.CircleMarker {
  return new L.CircleMarker([point.lat, point.lon], {
    radius: 8,
    color: PICKED_POINT_COLOR,
    weight: 2,
    dashArray: '3 3',
    fill: false,
    interactive: false,
  });
}

export function RoutesMap({
  serviceAreas,
  route,
  origin,
  destination,
  picking,
  onPick,
  centerRef,
}: RoutesMapProps) {
  const { containerRef, mapRef, layersRef } = useLeafletMap({
    // Sin modo activo el clic no hace nada: no selecciona ni limpia el resultado.
    onClick: (latlng) => {
      if (picking !== null) onPick(toPoint(latlng));
    },
    // El centro queda al día para el botón del panel, que es el camino con teclado.
    onMoveEnd: (bounds) => {
      centerRef.current = toPoint(bounds.getCenter());
    },
  });

  /** El centro inicial, antes de que nadie paneé: el del piloto. */
  useEffect(() => {
    const map = mapRef.current;
    if (map !== null) centerRef.current = toPoint(map.getCenter());
  }, [mapRef, centerRef]);

  /**
   * Lo que se dibuja, en orden de alta, que es el orden de pintado.
   *
   * Se redibuja todo cuando cambia cualquiera de las piezas: acá hay un recorrido de unos
   * pocos tramos y decenas de vértices, no los cientos de elementos del piloto, así que
   * repintar por capa sería código para una diferencia que no se nota.
   */
  useEffect(() => {
    const layers = layersRef.current;
    if (layers === null) return;

    layers.clearLayers();

    // 1. El área de servicio: contexto de dónde termina la zona, debajo de todo y sin
    // capturar clics (`interactive: false` en el estilo, [16 §5.7]).
    for (const area of serviceAreas) {
      const ring = (area.geometry.coordinates[0] ?? []).map(toLatLng);
      layers.addLayer(new L.Polygon(ring, serviceAreaStyle()));
    }

    if (route !== null) {
      // 2. El recorrido: un `Polyline` por tramo y no una línea fusionada, porque cada
      // tramo tiene su nivel cobrado y su elemento, y el color sale de ahí ([13 §7]).
      if (route.found) {
        for (const leg of route.legs) {
          layers.addLayer(
            new L.Polyline(leg.geometry.coordinates.map(toLatLng), lineStyle(leg.level, false)),
          );
        }
      }

      // 3. Las dos puntas pegadas. Se dibujan también cuando no hay recorrido: ahí son el
      // diagnóstico, las dos cayeron en componentes distintos del grafo ([13 §6]).
      layers.addLayer(endpointMarker(route.origin.node, ORIGIN_COLOR));
      layers.addLayer(endpointMarker(route.destination.node, DESTINATION_COLOR));
    }

    // 4. Los puntos marcados, arriba de todo y tenues: muestran cuánto se movió la punta.
    if (origin !== null) layers.addLayer(pickedMarker(origin));
    if (destination !== null) layers.addLayer(pickedMarker(destination));
  }, [serviceAreas, route, origin, destination, layersRef]);

  return <div ref={containerRef} className="h-full w-full" />;
}
