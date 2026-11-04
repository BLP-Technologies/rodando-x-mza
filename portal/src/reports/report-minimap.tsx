'use client';

/**
 * El minimapa del reporte: un mapa chico y quieto con el punto reportado.
 *
 * Importa Leaflet, así que **nunca** puede evaluarse en el servidor: el único que lo
 * monta es `reports-screen.tsx`, que ya viene debajo del `ssr: false` de
 * `reports-panel.tsx` ([16 §5.2](../../docs/16-el-portal.md)).
 *
 * **No dibuja el grafo ni el área de servicio**: acá la única pregunta es dónde está el
 * punto que alguien reportó ([17 §7](../../docs/17-la-api-de-reportes.md)).
 *
 * El mapa se crea a mano, por el mismo motivo que el del grafo
 * ([16 §5.1](../../docs/16-el-portal.md)): cada montaje —y cada reporte distinto— arma
 * un mapa nuevo y lo destruye al desmontarse.
 */

import 'leaflet/dist/leaflet.css';

import { useEffect, useRef } from 'react';
import * as L from 'leaflet';

import type { ReportFeature } from '@/api/reports';

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

/** La atribución de OSM es obligatoria porque los datos son ODbL 1.0 ([10 §3]). */
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** Bien cerca: el detalle es "este punto", no la zona. */
const ZOOM = 17;

export function ReportMinimap({ report }: { report: ReportFeature }) {
  const containerRef = useRef<HTMLDivElement>(null);
  // GeoJSON guarda `[lon, lat]`; Leaflet dibuja `[lat, lon]`.
  const [lon, lat] = report.geometry.coordinates;

  // Las coordenadas en las dependencias: cambiar de reporte arma el mapa de nuevo, que
  // es lo que mueve la vista sin efectos de más.
  useEffect(() => {
    const container = containerRef.current;
    if (container === null) return;

    const map = new L.Map(container, {
      zoomControl: false,
      scrollWheelZoom: false,
      attributionControl: true,
    });
    map.setView([lat, lon], ZOOM);
    new L.TileLayer(TILE_URL, { attribution: OSM_ATTRIBUTION, maxZoom: 19 }).addTo(map);
    new L.CircleMarker([lat, lon], {
      radius: 8,
      color: '#b91c1c',
      fillColor: '#ef4444',
      fillOpacity: 0.6,
    }).addTo(map);

    return () => {
      map.remove();
    };
  }, [lat, lon]);

  return (
    <div
      ref={containerRef}
      className="h-56 w-full overflow-hidden rounded border border-slate-200"
    />
  );
}

