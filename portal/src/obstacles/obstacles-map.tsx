"use client";

/**
 * El mapa de los obstáculos, sobre Leaflet.
 *
 * Es el mismo montaje a mano que `map/graph-map.tsx`, y por la misma razón: cada montaje
 * crea un mapa nuevo y lo destruye al desmontarse, y las capas se dibujan por efectos sobre
 * esa instancia ([16 §5.1](../../docs/16-el-portal.md)). El montaje en sí —tiles, vista
 * inicial, `LayerGroup`, clic por ref— vive en `map/use-leaflet-map.ts`, que comparten las
 * tres pantallas con mapa.
 *
 * **No dibuja el grafo.** Acá la pregunta es dónde está publicado un obstáculo; las veredas,
 * los cruces y el control de capas son de otra pantalla ([16 §9](../../docs/16-el-portal.md)).
 *
 * Importa Leaflet, así que **nunca** puede evaluarse en el servidor: el único que lo monta es
 * `obstacles-screen.tsx`, que ya viene debajo del `ssr: false` de `obstacles-panel.tsx`.
 */

import 'leaflet/dist/leaflet.css';

import { useEffect } from 'react';
import * as L from 'leaflet';

import type { ObstacleFeature } from '@/api/obstacles';
import { useLeafletMap } from '@/map/use-leaflet-map';
import { RESOLVED_MARKER_COLOR, SEVERITY_MARKER_COLORS } from './obstacle-labels';

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
  /**
   * Lo que hace un clic en el mapa: en modo "elegí el punto" fija el punto, y si no
   * suelta la selección. El hook lo guarda en un ref, así que el listener no se vuelve a
   * enganchar en cada render.
   */
  const { containerRef, layersRef } = useLeafletMap({
    onClick: (latlng) => {
      if (picking) {
        onPickPoint({ lon: latlng.lng, lat: latlng.lat });
        return;
      }

      onSelect(null);
    },
  });

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
  }, [obstacles, selectedId, picking, draftPoint, onSelect, layersRef]);

  return <div ref={containerRef} className="h-full w-full" />;
}
