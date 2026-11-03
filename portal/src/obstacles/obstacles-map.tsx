"use client";

/**
 * El mapa de los obstáculos, sobre Leaflet.
 *
 * Es el mismo montaje a mano que `map/graph-map.tsx`, por la misma razón: cada montaje crea
 * un mapa nuevo y lo destruye al desmontarse, y las capas se dibujan por efectos sobre esa
 * instancia ([16 §5.1](../../docs/16-el-portal.md)). Sin `react-leaflet`, no hay un mapa que
 * sobreviva a su propio `remove()`.
 *
 * **No dibuja el grafo.** Acá la pregunta es dónde está publicado un obstáculo; las veredas,
 * los cruces y el control de capas son de otra pantalla ([16 §9](../../docs/16-el-portal.md)).
 *
 * Importa Leaflet, así que **nunca** puede evaluarse en el servidor: el único que lo monta es
 * `obstacles-screen.tsx`, que ya viene debajo del `ssr: false` de `obstacles-panel.tsx`.
 */

import 'leaflet/dist/leaflet.css';

import { useEffect, useRef } from 'react';
import * as L from 'leaflet';
import type { LatLngBoundsLiteral } from 'leaflet';

import type { ObstacleFeature } from '@/api/obstacles';
import { PILOT_BOUNDS } from '@/config';
import { RESOLVED_MARKER_COLOR, SEVERITY_MARKER_COLORS } from './obstacle-labels';

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

/** La atribución de OSM es obligatoria porque los datos son ODbL 1.0 ([10 §3]). */
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** Más lejos que el piloto no aporta y más cerca se pierde el barrio. */
const MIN_ZOOM = 13;
const MAX_ZOOM = 19;

/** La caja del piloto, en la forma que espera Leaflet. */
const PILOT_VIEW: LatLngBoundsLiteral = [
  [PILOT_BOUNDS.minLat, PILOT_BOUNDS.minLon],
  [PILOT_BOUNDS.maxLat, PILOT_BOUNDS.maxLon],
];

/** Un punto en WGS 84, en el orden que usa la API (y no el de Leaflet). */
export type MapPoint = { lon: number; lat: number };

type ObstaclesMapProps = {
  obstacles: readonly ObstacleFeature[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  /** Modo "elegí el punto": el próximo clic en el fondo del mapa fija el borrador. */
  picking: boolean;
  onPickPoint: (point: MapPoint) => void;
  /** El marcador provisorio de un alta en curso, mientras el formulario está abierto. */
  draftPoint: MapPoint | null;
};

/** GeoJSON y la API guardan `[lon, lat]`; Leaflet dibuja `[lat, lon]`. */
function toLatLng(point: MapPoint): [number, number] {
  return [point.lat, point.lon];
}

/** El estilo de un obstáculo: el color de su severidad, o el gris de un resuelto. */
function obstacleStyle(
  obstacle: ObstacleFeature,
  isSelected: boolean,
  picking: boolean,
): L.CircleMarkerOptions {
  const properties = obstacle.properties;
  const color =
    properties.resolved_at === null
      ? SEVERITY_MARKER_COLORS[properties.severity]
      : RESOLVED_MARKER_COLOR;

  return {
    color,
    fillColor: color,
    fillOpacity: isSelected ? 1 : 0.7,
    weight: isSelected ? 3 : 1,
    radius: isSelected ? 9 : 6,
    // En modo "elegí el punto" el obstáculo publicado no captura el clic: el punto se elige
    // sobre el mapa y no sobre lo que ya está dibujado.
    interactive: !picking,
    // Sin esto el clic llegaría también al fondo del mapa, que es el que suelta la
    // selección.
    bubblingMouseEvents: false,
  };
}

export function ObstaclesMap({
  obstacles,
  selectedId,
  onSelect,
  picking,
  onPickPoint,
  draftPoint,
}: ObstaclesMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const layersRef = useRef<L.LayerGroup | null>(null);

  /**
   * Lo que hace un clic en el mapa, en un ref.
   *
   * El listener vive lo que vive el mapa, así que no puede volver a engancharse en cada
   * render: el ref le deja leer el modo actual sin recrear la instancia.
   */
  const handleClickRef = useRef<(latlng: L.LatLng) => void>(() => {});

  useEffect(() => {
    handleClickRef.current = (latlng) => {
      if (picking) {
        onPickPoint({ lon: latlng.lng, lat: latlng.lat });
        return;
      }

      onSelect(null);
    };
  }, [picking, onPickPoint, onSelect]);

  /** El mapa: se crea al montar y se destruye al desmontar. */
  useEffect(() => {
    const container = containerRef.current;
    if (container === null) return;

    const map = new L.Map(container, { minZoom: MIN_ZOOM, maxZoom: MAX_ZOOM });
    map.fitBounds(PILOT_VIEW);
    new L.TileLayer(TILE_URL, {
      attribution: OSM_ATTRIBUTION,
      maxZoom: MAX_ZOOM,
    }).addTo(map);

    const layers = new L.LayerGroup().addTo(map);
    map.on('click', (event) => handleClickRef.current(event.latlng));

    layersRef.current = layers;

    return () => {
      // Primero se vacía lo dibujado: soltar las capas después de `remove()` deja
      // manejadores apuntando a un mapa destruido.
      layers.clearLayers();
      map.off();
      map.remove();
      layersRef.current = null;
    };
  }, []);

  /**
   * Los marcadores, redibujados cuando cambian los datos o la selección.
   *
   * Se redibuja todo en vez de repintar las dos capas que cambian, como hace el mapa del
   * grafo: acá lo que hay son decenas de obstáculos y no los cientos de elementos del piloto,
   * así que la diferencia no se nota y el código es la mitad.
   */
  useEffect(() => {
    const layers = layersRef.current;
    if (layers === null) return;

    layers.clearLayers();

    for (const obstacle of obstacles) {
      const [lon, lat] = obstacle.geometry.coordinates;
      const id = obstacle.properties.id;

      layers.addLayer(
        new L.CircleMarker([lat, lon], obstacleStyle(obstacle, id === selectedId, picking)).on(
          'click',
          () => onSelect(id),
        ),
      );
    }

    if (draftPoint !== null) {
      layers.addLayer(
        new L.CircleMarker(toLatLng(draftPoint), {
          radius: 9,
          color: '#0369a1',
          fillColor: '#0ea5e9',
          fillOpacity: 0.4,
          dashArray: '4 4',
          weight: 2,
          interactive: false,
        }),
      );
    }
  }, [obstacles, selectedId, picking, draftPoint, onSelect]);

  return <div ref={containerRef} className="h-full w-full" />;
}
