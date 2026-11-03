"use client";

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

import "leaflet/dist/leaflet.css";

import { useEffect, useMemo, useRef, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { LatLngBounds, LatLngBoundsLiteral } from "leaflet";
import {
  CircleMarker,
  MapContainer,
  Polygon,
  Polyline,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";

import { describeApiError } from "@/api/error-messages";
import {
  graphQueryKey,
  readGraph,
  roundBBox,
  type GraphFeature,
  type ServiceArea,
} from "@/api/graph";
import { PILOT_BOUNDS, type BBox } from "@/config";
import { FeatureDetails } from "./feature-details";
import { lineStyle, pointStyle, serviceAreaStyle } from "./feature-style";

/** Cuánto se espera después de un paneo antes de pedir el área nueva. */
const DEBOUNCE_MS = 300;

/** Las veredas y los cruces son líneas; los cordones, puntos. */
type LineFeature = Extract<GraphFeature, { geometry: { type: "LineString" } }>;
type PointFeature = Extract<GraphFeature, { geometry: { type: "Point" } }>;

function isLineFeature(feature: GraphFeature): feature is LineFeature {
  return feature.geometry.type === "LineString";
}

function isPointFeature(feature: GraphFeature): feature is PointFeature {
  return feature.geometry.type === "Point";
}

/** La clave de selección: identifica el elemento sin depender del objeto. */
function featureId(feature: GraphFeature): string {
  return `${feature.properties.element_kind}:${feature.properties.element_id}`;
}

/** GeoJSON guarda `[lon, lat]`; Leaflet dibuja `[lat, lon]`. */
function toLatLng([lon, lat]: [number, number]): [number, number] {
  return [lat, lon];
}

/**
 * El anillo exterior de un área, en `[lat, lon]`.
 *
 * Los huecos de un polígono no se dibujan: el área es un perímetro y no una
 * zona con exclusiones, y `ST_Buffer` del piloto devuelve un anillo solo.
 */
function areaRing(area: ServiceArea): [number, number][] {
  const ring = area.geometry.coordinates[0] ?? [];
  return ring.map(toLatLng);
}

/** La caja que contiene todas las features, o `null` si no hay ninguna. */
function boundsOf(
  features: readonly GraphFeature[],
): LatLngBoundsLiteral | null {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;

  for (const feature of features) {
    const coordinates =
      feature.geometry.type === "Point"
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

const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

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
/**
 * Acomoda la vista al grafo de la primera respuesta. Después manda el usuario: si
 * el mapa se reencuadrara en cada paneo, no se podría panear.
 *
 * Una sola vez por montaje: el `ref` lo garantiza aunque el componente se
 * re-renderice con cada refetch o cambio de bbox.
 */
function FitBounds({
  bounds,
  suppressMoveEndRef,
}: {
  bounds: LatLngBoundsLiteral | null;
  suppressMoveEndRef: React.RefObject<boolean>;
}) {
  const map = useMap();
  const applied = useRef(false);

  useEffect(() => {
    if (applied.current || !bounds) return;
    applied.current = true;

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

  // El área que se está mirando: cambiarla cambia la clave de la query y es el
  // único disparador de un pedido nuevo.
  const [bbox, setBbox] = useState<BBox>(PILOT_BOUNDS);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, error, isPending, refetch } = useQuery({
    queryKey: graphQueryKey(bbox),
    queryFn: () => readGraph(bbox),
    // Sin esto cada paneo vacía el mapa mientras llega la respuesta nueva.
    placeholderData: keepPreviousData,
    // Un reintento y no tres: el default espera ~7 s antes de mostrar el error, y
    // con la API caída el mapa se queda en "Cargando el grafo…" todo ese rato. Un
    // reintento cubre el corte momentáneo sin dejar al moderador mirando una
    // pantalla muerta.
    retry: 1,
  });

  const features = data?.features ?? [];
  const truncated = data?.truncated ?? false;
  const serviceAreas = data?.service_areas.features ?? [];

  /** Los nombres de las áreas activas, para la leyenda del mapa. */
  const areaNames = serviceAreas.map((area) => area.properties.name).join(", ");

  const selected =
    features.find((feature) => featureId(feature) === selectedId) ?? null;

  /** La caja de la primera respuesta, para el encuadre inicial. */
  const firstBounds = useMemo(
    () => (data === undefined ? null : boundsOf(data.features)),
    [data],
  );

  /** Paneo o zoom terminado: cambiar el área, con espera. */
  const onMoveEnd = (bounds: LatLngBounds) => {
    if (suppressMoveEnd.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      setBbox(
        roundBBox({
          minLon: bounds.getWest(),
          minLat: bounds.getSouth(),
          maxLon: bounds.getEast(),
          maxLat: bounds.getNorth(),
        }),
      );
    }, DEBOUNCE_MS);
  };

  // No dejar un pedido agendado cuando el mapa se desmonta.
  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

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
        >
          <TileLayer
            url={TILE_URL}
            attribution={OSM_ATTRIBUTION}
            maxZoom={19}
          />

          <FitBounds
            bounds={firstBounds}
            suppressMoveEndRef={suppressMoveEnd}
          />
          <MapEvents
            onMoveEnd={onMoveEnd}
            onMapClick={() => setSelectedId(null)}
          />

          {/* Los polígonos van antes del grafo: en Leaflet el orden de montaje es
              el orden de pintado, así el área queda por debajo de las líneas. */}
          {serviceAreas.map((area) => (
            <Polygon
              key={area.properties.id}
              positions={areaRing(area)}
              pathOptions={serviceAreaStyle()}
            />
          ))}

          {lines.map((feature) => (
            <Polyline
              key={featureId(feature)}
              positions={feature.geometry.coordinates.map(toLatLng)}
              pathOptions={lineStyle(
                feature.properties.level,
                featureId(feature) === selectedId,
              )}
              eventHandlers={{ click: () => setSelectedId(featureId(feature)) }}
            />
          ))}

          {points.map((feature) => (
            <CircleMarker
              key={featureId(feature)}
              center={toLatLng(feature.geometry.coordinates)}
              pathOptions={pointStyle(
                feature.properties.level,
                featureId(feature) === selectedId,
              )}
              eventHandlers={{ click: () => setSelectedId(featureId(feature)) }}
            />
          ))}
        </MapContainer>

        {serviceAreas.length > 0 && (
          <p className="pointer-events-none absolute left-12 top-3 z-[1100] flex items-center gap-2 rounded bg-white/95 px-3 py-1.5 text-sm text-slate-700 shadow">
            <span className="w-4 shrink-0 border-t-2 border-dashed border-blue-700" />
            <span>Zona: {areaNames}</span>
          </p>
        )}

        {isPending && (
          <p className="absolute left-1/2 top-3 z-[1100] -translate-x-1/2 rounded bg-white/95 px-3 py-1.5 text-sm text-slate-600 shadow">
            Cargando el grafo…
          </p>
        )}

        {error !== null && (
          <div
            role="alert"
            className="absolute left-1/2 top-3 z-[1100] flex max-w-md -translate-x-1/2 items-center gap-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 shadow"
          >
            <span>{describeApiError(error)}</span>
            <button
              type="button"
              onClick={() => void refetch()}
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
            El área tiene más de 2000 elementos y la API devolvió sólo los
            primeros. Acercate para verlos todos.
          </p>
        )}
      </div>

      <aside className="w-80 shrink-0 overflow-y-auto border-l border-slate-200 bg-white p-4">
        <FeatureDetails
          feature={selected}
          onClear={() => setSelectedId(null)}
        />
      </aside>
    </div>
  );
}
