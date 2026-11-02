'use client';

/**
 * El mapa del grafo peatonal, sobre Leaflet.
 *
 * Es el módulo que toca `window`: Leaflet lo lee al importarse, así que este
 * archivo **nunca** puede evaluarse en el servidor. El que lo monta es
 * `map-panel.tsx`, con `next/dynamic` y `ssr: false` (ver el comentario de ahí y
 * [16 §5](../../docs/16-el-portal.md)).
 *
 * Los datos se piden desde el navegador: el build del portal corre en CI, donde
 * no hay backend, así que nada de lo que se dibuja acá puede depender de un
 * `fetch` de prerender.
 */

import 'leaflet/dist/leaflet.css';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { LatLngBounds, LatLngBoundsLiteral } from 'leaflet';
import {
  CircleMarker,
  MapContainer,
  Polyline,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet';

import { describeApiError } from '@/api/error-messages';
import { readGraph, type GraphFeature } from '@/api/graph';
import { PILOT_BOUNDS, type BBox } from '@/config';
import { FeatureDetails } from './feature-details';
import { lineStyle, pointStyle } from './feature-style';

/** Cuánto se espera después de un paneo antes de pedir el área nueva. */
const DEBOUNCE_MS = 300;

/** Las veredas y los cruces son líneas; los cordones, puntos. */
type LineFeature = Extract<GraphFeature, { geometry: { type: 'LineString' } }>;
type PointFeature = Extract<GraphFeature, { geometry: { type: 'Point' } }>;

function isLineFeature(feature: GraphFeature): feature is LineFeature {
  return feature.geometry.type === 'LineString';
}

function isPointFeature(feature: GraphFeature): feature is PointFeature {
  return feature.geometry.type === 'Point';
}

/** La clave de selección: identifica el elemento sin depender del objeto. */
function featureId(feature: GraphFeature): string {
  return `${feature.properties.element_kind}:${feature.properties.element_id}`;
}

/** GeoJSON guarda `[lon, lat]`; Leaflet dibuja `[lat, lon]`. */
function toLatLng([lon, lat]: [number, number]): [number, number] {
  return [lat, lon];
}

/** La caja que contiene todas las features, o `null` si no hay ninguna. */
function boundsOf(features: readonly GraphFeature[]): LatLngBoundsLiteral | null {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;

  for (const feature of features) {
    const coordinates =
      feature.geometry.type === 'Point'
        ? [feature.geometry.coordinates]
        : feature.geometry.coordinates;

    for (const [lon, lat] of coordinates) {
      minLon = Math.min(minLon, lon);
      minLat = Math.min(minLat, lat);
      maxLon = Math.max(maxLon, lon);
      maxLat = Math.max(maxLat, lat);
    }
  }

  if (minLon === Infinity) return null;

  return [
    [minLat, minLon],
    [maxLat, maxLon],
  ];
}

/** La caja del piloto, en la forma que espera Leaflet. */
const PILOT_VIEW: LatLngBoundsLiteral = [
  [PILOT_BOUNDS.minLat, PILOT_BOUNDS.minLon],
  [PILOT_BOUNDS.maxLat, PILOT_BOUNDS.maxLon],
];

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

/**
 * El texto de atribución de OSM. Leaflet lo dibuja en su control de atribución
 * a partir del `attribution` de la capa de tiles: es obligatorio porque los
 * datos son ODbL 1.0 ([10 §3](../../docs/10-datos-y-zona-piloto.md)).
 */
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/**
 * Los eventos del mapa que importan, con el `map` de react-leaflet en la mano.
 *
 * Tiene que ser un hijo de `MapContainer`: el mapa existe recién cuando el
 * contenedor lo crea, así que un `ref` en el padre todavía está vacío en el
 * primer efecto y sus listeners no se engancharían nunca.
 */
function MapEvents({
  onMoveEnd,
  onMapClick,
}: {
  onMoveEnd: (bounds: LatLngBounds) => void;
  onMapClick: () => void;
}) {
  const map = useMap();

  useMapEvents({
    moveend: () => onMoveEnd(map.getBounds()),
    click: () => onMapClick(),
  });

  return null;
}

/**
 * Acomoda la vista al grafo de la primera respuesta. Después manda el usuario:
 * si el mapa se reencuadrara en cada paneo, no se podría panear.
 */
function FitBounds({
  bounds,
  suppressMoveEndRef,
}: {
  bounds: LatLngBoundsLiteral | null;
  suppressMoveEndRef: React.RefObject<boolean>;
}) {
  const map = useMap();

  useEffect(() => {
    if (!bounds) return;

    // `animate: false` dispara `moveend` de forma sincrónica, así que la
    // bandera lo tapa y no pedimos dos veces el mismo grafo.
    suppressMoveEndRef.current = true;
    map.fitBounds(bounds, { padding: [24, 24], animate: false });
    suppressMoveEndRef.current = false;
  }, [map, bounds, suppressMoveEndRef]);

  return null;
}

export default function GraphMap() {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressMoveEnd = useRef(false);
  const lastRequest = useRef(0);
  const lastBBox = useRef<BBox>(PILOT_BOUNDS);

  const [features, setFeatures] = useState<GraphFeature[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [initialBounds, setInitialBounds] = useState<LatLngBoundsLiteral | null>(null);
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = features.find((feature) => featureId(feature) === selectedId) ?? null;

  const load = useCallback(async (bbox: BBox) => {
    const request = lastRequest.current + 1;
    lastRequest.current = request;
    lastBBox.current = bbox;

    try {
      const collection = await readGraph(bbox);

      // Una respuesta vieja que llega después de una nueva se descarta.
      if (request !== lastRequest.current) return;

      setFeatures(collection.features);
      setTruncated(collection.truncated);
      setErrorMessage(null);
      setInitialBounds((current) => current ?? boundsOf(collection.features));
    } catch (error) {
      if (request !== lastRequest.current) return;
      setErrorMessage(describeApiError(error));
    } finally {
      if (request === lastRequest.current) setIsFirstLoad(false);
    }
  }, []);

  /** Paneo o zoom terminado: pedir la caja de la vista, con espera. */
  const onMoveEnd = useCallback(
    (bounds: LatLngBounds) => {
      if (suppressMoveEnd.current) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);

      debounceRef.current = setTimeout(() => {
        void load({
          minLon: bounds.getWest(),
          minLat: bounds.getSouth(),
          maxLon: bounds.getEast(),
          maxLat: bounds.getNorth(),
        });
      }, DEBOUNCE_MS);
    },
    [load],
  );

  // No dejar un pedido agendado cuando el mapa se desmonta.
  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const lines = features.filter(isLineFeature);
  const points = features.filter(isPointFeature);

  return (
    <div className="flex h-full min-h-0">
      <div className="relative min-w-0 flex-1">
        <MapContainer
          bounds={PILOT_VIEW}
          minZoom={13}
          maxZoom={19}
          className="h-full w-full"
          // Primera carga: cuando Leaflet ya tiene la vista del piloto, que es
          // la caja inicial. Va acá y no en un `useEffect` para no encadenar
          // renders (`react-hooks/set-state-in-effect`).
          whenReady={() => void load(PILOT_BOUNDS)}
        >
          <TileLayer url={TILE_URL} attribution={OSM_ATTRIBUTION} maxZoom={19} />

          <FitBounds bounds={initialBounds} suppressMoveEndRef={suppressMoveEnd} />
          <MapEvents onMoveEnd={onMoveEnd} onMapClick={() => setSelectedId(null)} />

          {lines.map((feature) => (
            <Polyline
              key={featureId(feature)}
              positions={feature.geometry.coordinates.map(toLatLng)}
              pathOptions={lineStyle(feature.properties.level, featureId(feature) === selectedId)}
              eventHandlers={{ click: () => setSelectedId(featureId(feature)) }}
            />
          ))}

          {points.map((feature) => (
            <CircleMarker
              key={featureId(feature)}
              center={toLatLng(feature.geometry.coordinates)}
              pathOptions={pointStyle(feature.properties.level, featureId(feature) === selectedId)}
              eventHandlers={{ click: () => setSelectedId(featureId(feature)) }}
            />
          ))}
        </MapContainer>

        {isFirstLoad && (
          <p className="absolute left-1/2 top-3 z-[1100] -translate-x-1/2 rounded bg-white/95 px-3 py-1.5 text-sm text-slate-600 shadow">
            Cargando el grafo…
          </p>
        )}

        {errorMessage !== null && (
          <div
            role="alert"
            className="absolute left-1/2 top-3 z-[1100] flex max-w-md -translate-x-1/2 items-center gap-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 shadow"
          >
            <span>{errorMessage}</span>
            <button
              type="button"
              onClick={() => void load(lastBBox.current)}
              className="shrink-0 rounded border border-red-400 px-2 py-1 text-xs hover:bg-red-100"
            >
              Reintentar
            </button>
          </div>
        )}

        {truncated && (
          <p
            role="status"
            className="absolute bottom-6 left-3 z-[1100] max-w-sm rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 shadow"
          >
            El área tiene más de 2000 elementos y la API devolvió sólo los primeros.
            Acercate para verlos todos.
          </p>
        )}
      </div>

      <aside className="w-80 shrink-0 overflow-y-auto border-l border-slate-200 bg-white p-4">
        <FeatureDetails feature={selected} onClear={() => setSelectedId(null)} />
      </aside>
    </div>
  );
}
