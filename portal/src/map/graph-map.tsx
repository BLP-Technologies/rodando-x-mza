"use client";

/**
 * El mapa del grafo peatonal, sobre Leaflet.
 *
 * Es el módulo que toca `window`: Leaflet lo lee al importarse, así que este
 * archivo **nunca** puede evaluarse en el servidor. El que lo monta es
 * `map-panel.tsx`, con `next/dynamic` y `ssr: false` (ver el comentario de ahí y
 * [16 §5](../../docs/16-el-portal.md)).
 *
 * **El mapa y las capas se manejan a mano, sin `react-leaflet`.** Su `MapContainer`
 * crea el mapa una vez y lo destruye en el cleanup de su efecto, pero no lo vuelve a
 * crear si React re-monta el mismo componente: como `Map.remove()` vacía `_panes`, las
 * capas que después se le agregaban reventaban en `getPane(...).appendChild` al volver
 * al grafo desde otra pantalla. Con el ciclo en nuestras manos, cada montaje crea un
 * mapa nuevo y lo destruye al desmontarse, y las capas se dibujan por efectos sobre ese
 * mapa: no hay instancia que sobreviva a su propio `remove()`.
 *
 * Los datos se piden desde el navegador: el build del portal corre en CI, donde
 * no hay backend, así que nada de lo que se dibuja acá puede depender de un
 * `fetch` de prerender.
 *
 * **El montaje de Leaflet no vive acá**: crear el mapa, los tiles, la vista inicial y el
 * `LayerGroup` lo hace `use-leaflet-map.ts`, que es el que comparten las tres pantallas
 * con mapa ([16 §5.1](../../docs/16-el-portal.md)). Este archivo se queda con lo propio del
 * grafo: pedir el área, dibujar los elementos, encuadrar con la primera respuesta y
 * repintar la selección.
 */

import "leaflet/dist/leaflet.css";

import { useEffect, useMemo, useRef, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import * as L from "leaflet";
import type { LatLngBoundsLiteral } from "leaflet";

import { describeApiError } from "@/api/error-messages";
import {
  graphQueryKey,
  readGraph,
  roundBBox,
  type GraphFeature,
  type GraphLevel,
  type ServiceArea,
} from "@/api/graph";
import { PILOT_BOUNDS, type BBox } from "@/config";
import { FeatureDetails } from "./feature-details";
import { lineStyle, pointStyle, serviceAreaStyle } from "./feature-style";
import { useLeafletMap } from "./use-leaflet-map";

/** Cuánto se espera después de un paneo antes de pedir el área nueva. */
const DEBOUNCE_MS = 300;

/** Las veredas y los cruces son líneas; los cordones, puntos. */
type LineFeature = Extract<GraphFeature, { geometry: { type: "LineString" } }>;

function isLineFeature(feature: GraphFeature): feature is LineFeature {
  return feature.geometry.type === "LineString";
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

/**
 * Acomoda la vista al grafo de la primera respuesta. Después manda el usuario: si
 * el mapa se reencuadrara en cada paneo, no se podría panear.
 */
export default function GraphMap() {
  /** La capa y el nivel de cada elemento, para repintar sólo el que cambia de estado. */
  const drawnRef = useRef(new Map<string, { path: L.Path; level: GraphLevel }>());
  const previousSelectedRef = useRef<string | null>(null);
  const appliedBoundsRef = useRef(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressMoveEnd = useRef(false);

  // El área que se está mirando: cambiarla cambia la clave de la query y es el
  // único disparador de un pedido nuevo.
  const [bbox, setBbox] = useState<BBox>(PILOT_BOUNDS);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  /**
   * El mapa lo monta el hook compartido; acá sólo se le dice qué hacer con el clic y con
   * el final de un paneo.
   */
  const { containerRef, mapRef, layersRef } = useLeafletMap({
    // Un clic en el fondo del mapa suelta la selección.
    onClick: () => setSelectedId(null),
    // Paneo o zoom terminado: cambiar el área, con espera. `fitBounds` del encuadre
    // inicial dispara este mismo evento, y la bandera lo tapa.
    onMoveEnd: (bounds) => {
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
    },
  });

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

  const features = useMemo(() => data?.features ?? [], [data]);
  const truncated = data?.truncated ?? false;
  const serviceAreas = useMemo(
    () => data?.service_areas.features ?? [],
    [data],
  );

  /** Los nombres de las áreas activas, para la leyenda del mapa. */
  const areaNames = serviceAreas.map((area) => area.properties.name).join(", ");

  const selected =
    features.find((feature) => featureId(feature) === selectedId) ?? null;

  /** La caja de la primera respuesta, para el encuadre inicial. */
  const firstBounds = useMemo(
    () => (data === undefined ? null : boundsOf(data.features)),
    [data],
  );

  /** El grafo y las áreas, redibujados cuando cambian los datos. */
  useEffect(() => {
    const layers = layersRef.current;
    if (layers === null) return;

    layers.clearLayers();
    drawnRef.current.clear();

    // Las áreas van primero: el orden de alta es el orden de pintado, así que el
    // grafo queda encima del borde de la zona.
    for (const area of serviceAreas) {
      layers.addLayer(new L.Polygon(areaRing(area), serviceAreaStyle()));
    }

    for (const feature of features) {
      const id = featureId(feature);
      const level = feature.properties.level;
      const path: L.Path = isLineFeature(feature)
        ? new L.Polyline(feature.geometry.coordinates.map(toLatLng), lineStyle(level, false))
        : new L.CircleMarker(
            toLatLng(feature.geometry.coordinates),
            pointStyle(level, false),
          );

      // `bubblingMouseEvents: false` en el estilo evita que el clic llegue al fondo
      // del mapa, que es el que suelta la selección.
      path.on("click", () => setSelectedId(id));
      layers.addLayer(path);
      drawnRef.current.set(id, { path, level });
    }
  }, [features, serviceAreas, layersRef]);

  /** El repintado de la selección: sólo las dos capas que cambian, no las 977. */
  useEffect(() => {
    const paint = (id: string | null, isSelected: boolean) => {
      if (id === null) return;
      const drawn = drawnRef.current.get(id);
      if (drawn === undefined) return;

      if (drawn.path instanceof L.CircleMarker) {
        const style = pointStyle(drawn.level, isSelected);
        drawn.path.setStyle(style);
        drawn.path.setRadius(style.radius ?? 5);
      } else {
        drawn.path.setStyle(lineStyle(drawn.level, isSelected));
      }
    };

    paint(previousSelectedRef.current, false);
    paint(selectedId, true);
    previousSelectedRef.current = selectedId;
  }, [selectedId]);

  /** El encuadre inicial, una sola vez por montaje y cuando llega la primera respuesta. */
  useEffect(() => {
    const map = mapRef.current;
    if (map === null || appliedBoundsRef.current || firstBounds === null) return;
    appliedBoundsRef.current = true;

    // `animate: false` dispara `moveend` de forma sincrónica, así que la bandera lo
    // tapa y no pedimos dos veces el mismo grafo.
    suppressMoveEnd.current = true;
    map.fitBounds(firstBounds, { padding: [24, 24], animate: false });
    suppressMoveEnd.current = false;
  }, [firstBounds, mapRef]);

  // No dejar un pedido agendado cuando el mapa se desmonta.
  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  return (
    <div className="flex h-full min-h-0">
      <div className="relative min-w-0 flex-1">
        <div ref={containerRef} className="h-full w-full" />

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
