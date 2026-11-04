"use client";

/**
 * La pantalla del mapa: una sola instancia de Leaflet para las tres herramientas.
 *
 * Grafo, ruta y obstáculos se preguntan sobre el mismo mapa y casi siempre sobre el mismo
 * lugar, así que son tres pestañas y no tres pantallas. Con una instancia sola, cambiar de
 * herramienta no rearma el mapa, no vuelve a bajar los tiles y no pide de nuevo el grafo del
 * área que ya estaba en pantalla; y el estado que no es del mapa —la selección, el filtro de
 * obstáculos, el borrador del alta, las dos puntas del recorrido— no se pierde, porque vive
 * acá arriba y no adentro de cada pestaña.
 *
 * Lo que este archivo decide es *qué* se pide y *cuándo*; el dibujo está en `layer-draw.ts`,
 * el panel de capas en `layer-panel.tsx` y los asides en `obstacles/` y `routes/`.
 *
 * Importa Leaflet, así que **nunca** puede evaluarse en el servidor: lo monta `map-panel.tsx`
 * con `next/dynamic` y `ssr: false`. Y los datos se piden desde el navegador: el build corre
 * en CI, donde no hay backend.
 */

import "leaflet/dist/leaflet.css";

import { useEffect, useMemo, useRef, useState } from "react";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import type { LatLngBoundsLiteral } from "leaflet";

import { describeApiError, describeRouteError } from "@/api/error-messages";
import {
  graphQueryKey,
  readGraph,
  roundBBox,
  type GraphFeature,
} from "@/api/graph";
import {
  obstacleQueryKey,
  readObstacles,
  type ObstacleFeature,
  type ObstacleStatusFilter,
} from "@/api/obstacles";
import { readReports, reportQueryKey } from "@/api/reports";
import { calculateRoute, type RoutePoint, type RouteRequest } from "@/api/routes";
import { PILOT_BOUNDS, type BBox } from "@/config";
import { ObstaclesTools } from "@/obstacles/obstacles-tools";
import { RoutesTools, type PickingMode, type RouteEnd } from "@/routes/routes-tools";
import { FeatureDetails } from "./feature-details";
import {
  drawGraph,
  drawObstacles,
  drawReports,
  drawRoute,
  drawServiceAreas,
  featureKey,
  repaintSelection,
  type DrawnFeature,
  type MapPoint,
} from "./layer-draw";
import { LAYER_DEFAULTS, type LayerId } from "./layer-config";
import { LayerPanel } from "./layer-panel";
import { useLeafletMap } from "./use-leaflet-map";

/** Cuánto se espera después de un paneo antes de pedir el área nueva. */
const DEBOUNCE_MS = 300;

/** Las tres herramientas del mapa, en el orden del tablist. */
type Tab = "grafo" | "ruta" | "obstaculos";

const TABS: readonly { id: Tab; label: string }[] = [
  { id: "grafo", label: "Grafo" },
  { id: "ruta", label: "Ruta" },
  { id: "obstaculos", label: "Obstáculos" },
];

/**
 * Qué hace el próximo clic en el mapa.
 *
 * Es un modo explícito y no una deducción de la pestaña: con un modo activo el clic fija ese
 * punto y sale del modo; sin modo, el clic del fondo selecciona o suelta, según la pestaña.
 */
type ClickMode = "origin" | "destination" | "obstacle" | null;

/** El panel que cada pestaña controla: hay uno solo, y cambia de contenido. */
const TOOLS_PANEL_ID = "map-tools-panel";

const TAB_ACTIVE_CLASS = "rounded bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-900";
const TAB_IDLE_CLASS =
  "rounded px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900";

/** La caja que contiene todas las features, o `null` si no hay ninguna. */
function boundsOf(features: readonly GraphFeature[]): LatLngBoundsLiteral | null {
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
 * El aviso de recorte: uno solo, y dice qué lectura se recortó.
 *
 * Son tres lecturas distintas y cualquiera puede venir recortada; tres carteles apilados
 * sobre el mismo mapa no se leerían, y uno que diga "se recortó" sin decir qué, tampoco.
 */
function truncationMessage(parts: readonly string[]): string | null {
  if (parts.length === 0) return null;

  const list =
    parts.length === 1
      ? parts[0]
      : `${parts.slice(0, -1).join(", ")} y ${parts[parts.length - 1]}`;

  return `La API devolvió una parte: hay más de 2000 ${list}. Acercate o achicá el área para verlos todos.`;
}

export default function MapScreen() {
  const [tab, setTab] = useState<Tab>("grafo");
  const [layersOpen, setLayersOpen] = useState(true);
  const [layers, setLayers] = useState<Record<LayerId, boolean>>(LAYER_DEFAULTS);

  // El grafo: el área que se está mirando y el elemento elegido.
  const [bbox, setBbox] = useState<BBox>(PILOT_BOUNDS);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Los obstáculos: el filtro es del servidor, la selección y el alta son del cliente.
  const [obstacleStatus, setObstacleStatus] = useState<ObstacleStatusFilter>("ACTIVE");
  const [obstacleSelectedId, setObstacleSelectedId] = useState<number | null>(null);
  const [obstaclePicking, setObstaclePicking] = useState(false);
  const [draftPoint, setDraftPoint] = useState<MapPoint | null>(null);

  // El recorrido: las dos puntas marcadas y el modo de clic de cada una.
  const [routeOrigin, setRouteOrigin] = useState<RoutePoint | null>(null);
  const [routeDestination, setRouteDestination] = useState<RoutePoint | null>(null);
  const [routePicking, setRoutePicking] = useState<PickingMode>(null);

  /** El centro de la vista, para el botón "Usar el centro": un paneo no re-renderiza. */
  const centerRef = useRef<RoutePoint | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressMoveEnd = useRef(false);
  const appliedBoundsRef = useRef(false);

  /** Lo dibujado del grafo por elemento, para repintar sólo lo que cambia de selección. */
  const drawnRef = useRef<ReadonlyMap<string, DrawnFeature>>(new Map());
  const previousSelectedRef = useRef<string | null>(null);
  const selectedIdRef = useRef<string | null>(selectedId);

  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({
    grafo: null,
    ruta: null,
    obstaculos: null,
  });

  const graphQuery = useQuery({
    queryKey: graphQueryKey(bbox),
    queryFn: () => readGraph(bbox),
    // Sin esto cada paneo vacía el mapa mientras llega la respuesta nueva.
    placeholderData: keepPreviousData,
    // Un reintento y no tres: el default espera ~7 s antes de mostrar el error, y con la API
    // caída el mapa se queda en "Cargando el grafo…" todo ese rato.
    retry: 1,
  });

  const obstaclesQuery = useQuery({
    queryKey: obstacleQueryKey(obstacleStatus),
    queryFn: () => readObstacles(obstacleStatus),
    // La capa es la que decide si se piden: apagada, los obstáculos no cuestan una lectura.
    enabled: layers.obstaculos,
    placeholderData: keepPreviousData,
    retry: 1,
  });

  const reportsQuery = useQuery({
    queryKey: reportQueryKey("PENDING"),
    // Sólo los pendientes: el parámetro es obligatorio y es de un estado por vez, y lo que
    // pide moderación es justamente lo que todavía nadie miró.
    queryFn: () => readReports("PENDING"),
    enabled: layers.reportes,
    retry: 1,
  });

  const calculate = useMutation({
    mutationFn: (request: RouteRequest) => calculateRoute(request),
  });

  const features = useMemo(() => graphQuery.data?.features ?? [], [graphQuery.data]);
  const serviceAreas = useMemo(
    () => graphQuery.data?.service_areas.features ?? [],
    [graphQuery.data],
  );
  // En `useMemo` y no en una constante: son dependencias del efecto de dibujo y una lista
  // nueva en cada render lo dispararía siempre.
  const obstacles = useMemo(
    (): readonly ObstacleFeature[] => obstaclesQuery.data?.features ?? [],
    [obstaclesQuery.data],
  );
  const pendingReports = useMemo(
    () => reportsQuery.data?.features ?? [],
    [reportsQuery.data],
  );

  const areaNames = serviceAreas.map((area) => area.properties.name).join(", ");

  const selected = features.find((feature) => featureKey(feature) === selectedId) ?? null;
  const selectedObstacle =
    obstacles.find((obstacle) => obstacle.properties.id === obstacleSelectedId) ?? null;

  /** La caja de la primera respuesta, para el encuadre inicial. */
  const firstBounds = useMemo(
    () => (graphQuery.data === undefined ? null : boundsOf(graphQuery.data.features)),
    [graphQuery.data],
  );

  const truncation = truncationMessage([
    ...(graphQuery.data?.truncated === true ? ["elementos del grafo"] : []),
    ...(obstaclesQuery.data?.truncated === true ? ["obstáculos"] : []),
    ...(reportsQuery.data?.truncated === true ? ["reportes"] : []),
  ]);

  /** El modo de clic vigente. Los dos no pueden coexistir: cambiar de pestaña los cancela. */
  const clickMode: ClickMode = routePicking ?? (obstaclePicking ? "obstacle" : null);

  /**
   * Los obstáculos sólo capturan clics en su pestaña y sin modo activo: en el resto de los
   * casos el clic es del modo o de la selección del grafo, y un marcador se lo comería.
   */
  const obstaclesInteractive = tab === "obstaculos" && clickMode === null;

  const setRoutePoint = (end: RouteEnd, point: RoutePoint | null) => {
    if (end === "origin") setRouteOrigin(point);
    else setRouteDestination(point);
  };

  /** Marca la punta con el centro de la vista: es el camino que no necesita el mouse. */
  const useCenter = (end: RouteEnd) => {
    if (centerRef.current !== null) setRoutePoint(end, centerRef.current);
  };

  /**
   * Cambiar de pestaña no desmonta nada: se llevan el modo de clic y nada más.
   *
   * La pestaña Obstáculos se lee con su capa prendida, así que entrar a ella la prende: la
   * casilla del panel la muestra marcada y fija mientras dure.
   */
  const changeTab = (next: Tab) => {
    setTab(next);
    setRoutePicking(null);
    setObstaclePicking(false);
    if (next === "obstaculos") {
      setLayers((current) => (current.obstaculos ? current : { ...current, obstaculos: true }));
    }
  };

  const moveTab = (event: React.KeyboardEvent<HTMLButtonElement>, id: Tab) => {
    const index = TABS.findIndex((candidate) => candidate.id === id);
    let next: Tab | null = null;

    if (event.key === "ArrowLeft") next = TABS[(index - 1 + TABS.length) % TABS.length].id;
    else if (event.key === "ArrowRight") next = TABS[(index + 1) % TABS.length].id;
    else if (event.key === "Home") next = TABS[0].id;
    else if (event.key === "End") next = TABS[TABS.length - 1].id;
    else return;

    event.preventDefault();
    changeTab(next);
    tabRefs.current[next]?.focus();
  };

  /**
   * Prender o apagar una capa. Apagar la del grafo o la de obstáculos suelta lo que esa capa
   * contenía: el aside no puede seguir mostrando algo que ya no está en el mapa.
   */
  const changeLayer = (id: LayerId, value: boolean) => {
    setLayers((current) => ({ ...current, [id]: value }));
    if (value) return;

    if (id === "grafo") setSelectedId(null);
    if (id === "obstaculos") setObstacleSelectedId(null);
  };

  const startCreatingObstacle = () => {
    setObstacleSelectedId(null);
    setDraftPoint(null);
    setObstaclePicking(true);
  };

  const cancelCreatingObstacle = () => {
    setObstaclePicking(false);
    setDraftPoint(null);
  };

  const finishCreatingObstacle = (obstacle: ObstacleFeature) => {
    setObstaclePicking(false);
    setDraftPoint(null);
    // El obstáculo nace activo: si se estaba mirando otro estado, el filtro vuelve a donde
    // está lo que se acaba de publicar.
    if (obstacleStatus !== "ACTIVE") setObstacleStatus("ACTIVE");
    setObstacleSelectedId(obstacle.properties.id);
  };

  const requestRoute = () => {
    if (routeOrigin === null || routeDestination === null) return;
    calculate.mutate({ origin: routeOrigin, destination: routeDestination });
  };

  /**
   * El mapa lo monta el hook compartido; acá se le dice qué hacer con el clic y con el final de
   * un paneo. Es el único `onClick`: la regla del clic está en un solo lugar.
   */
  const { containerRef, mapRef, layersRef } = useLeafletMap({
    onClick: (latlng) => {
      const point: RoutePoint = { lat: latlng.lat, lon: latlng.lng };

      // Con un modo activo, el clic fija ese punto y sale del modo.
      if (clickMode === "obstacle") {
        setDraftPoint(point);
        setObstaclePicking(false);
        return;
      }
      if (clickMode !== null) {
        setRoutePoint(clickMode, point);
        setRoutePicking(null);
        return;
      }

      // Sin modo, el fondo del mapa sólo suelta la selección en la pestaña Grafo: en las otras
      // pestañas el clic no tiene por qué tocar una selección ajena.
      if (tab === "grafo") setSelectedId(null);
    },
    onMoveEnd: (bounds) => {
      // El centro queda al día sin re-renderizar: lo lee el botón, no la pantalla.
      const center = bounds.getCenter();
      centerRef.current = { lat: center.lat, lon: center.lng };

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

  // La selección vigente para el dibujado. Va en un efecto declarado antes del dibujo para
  // que, cuando los dos corren en el mismo commit, el segundo ya la vea al día.
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  /**
   * El dibujado, en orden fijo de pintado: zona, grafo, reportes, obstáculos y ruta.
   *
   * Un solo `LayerGroup` y un solo efecto de dibujo: cada cambio limpia y vuelve a dibujar lo
   * que corresponde, así que ninguna capa depende de que otra se haya montado antes. El
   * elemento seleccionado nace ya resaltado —el redibujado no pierde la selección— y lo único
   * que queda fuera es el cambio de selección, que repinta dos capas y no el grafo entero.
   */
  useEffect(() => {
    const group = layersRef.current;
    if (group === null) return;

    group.clearLayers();

    if (layers.zona) drawServiceAreas(group, serviceAreas);

    drawnRef.current = layers.grafo
      ? drawGraph(group, features, {
          selectedId: selectedIdRef.current,
          selectable: tab === "grafo",
          onSelect: setSelectedId,
        })
      : new Map();

    if (layers.reportes) drawReports(group, pendingReports);

    if (layers.obstaculos) {
      drawObstacles(group, obstacles, {
        selectedId: obstacleSelectedId,
        interactive: obstaclesInteractive,
        onSelect: setObstacleSelectedId,
        draft: draftPoint,
      });
    }

    if (layers.ruta) drawRoute(group, calculate.data ?? null, routeOrigin, routeDestination);
  }, [
    layers,
    layersRef,
    tab,
    serviceAreas,
    features,
    pendingReports,
    obstacles,
    obstacleSelectedId,
    obstaclesInteractive,
    draftPoint,
    calculate.data,
    routeOrigin,
    routeDestination,
  ]);

  /** El repintado de la selección: sólo las dos capas que cambian, no las 977. */
  useEffect(() => {
    repaintSelection(drawnRef.current, previousSelectedRef.current, selectedId);
    previousSelectedRef.current = selectedId;
  }, [selectedId]);

  /** El centro inicial, antes de que nadie paneé: el del piloto. */
  useEffect(() => {
    const map = mapRef.current;
    if (map === null || centerRef.current !== null) return;

    const center = map.getCenter();
    centerRef.current = { lat: center.lat, lon: center.lng };
  }, [mapRef]);

  /**
   * El encuadre inicial, una sola vez y con la primera respuesta del grafo.
   *
   * Después manda el usuario: si el mapa se reencuadrara en cada paneo, no se podría panear.
   */
  useEffect(() => {
    const map = mapRef.current;
    if (map === null || appliedBoundsRef.current || firstBounds === null) return;
    appliedBoundsRef.current = true;

    // `animate: false` dispara `moveend` de forma sincrónica, así que la bandera lo tapa y no
    // pedimos dos veces el mismo grafo.
    suppressMoveEnd.current = true;
    map.fitBounds(firstBounds, { padding: [24, 24], animate: false });
    suppressMoveEnd.current = false;
  }, [firstBounds, mapRef]);

  // No dejar un pedido agendado cuando la pantalla se va.
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

        {/* El panel va antes que los carteles a propósito: un error nunca puede quedar tapado
            por una capa que se abrió arriba suyo. */}
        <LayerPanel
          open={layersOpen}
          onToggle={() => setLayersOpen((current) => !current)}
          layers={layers}
          onChange={changeLayer}
          failed={{ reportes: reportsQuery.isError, obstaculos: obstaclesQuery.isError }}
          areaNames={areaNames}
          obstaclesLocked={tab === "obstaculos"}
        />

        {clickMode !== null && (
          <p
            role="status"
            className="absolute left-1/2 top-3 z-[1100] max-w-sm -translate-x-1/2 rounded bg-white/95 px-3 py-1.5 text-sm text-slate-700 shadow"
          >
            {clickMode === "obstacle"
              ? "Hacé clic en el mapa para marcar el punto del obstáculo."
              : `Hacé clic en el mapa para marcar el ${clickMode === "origin" ? "origen" : "destino"}.`}
          </p>
        )}

        {graphQuery.isPending && (
          <p className="absolute left-1/2 top-3 z-[1100] -translate-x-1/2 rounded bg-white/95 px-3 py-1.5 text-sm text-slate-600 shadow">
            Cargando el grafo…
          </p>
        )}

        {graphQuery.error !== null && (
          <div
            role="alert"
            className="absolute left-1/2 top-3 z-[1100] flex max-w-md -translate-x-1/2 items-center gap-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 shadow"
          >
            <span>{describeApiError(graphQuery.error)}</span>
            <button
              type="button"
              onClick={() => void graphQuery.refetch()}
              className="shrink-0 rounded border border-red-400 px-2 py-1 text-xs hover:bg-red-100"
            >
              Reintentar
            </button>
          </div>
        )}

        {truncation !== null && (
          <p
            role="status"
            className="absolute bottom-6 left-3 z-[1100] max-w-sm rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 shadow"
          >
            {truncation}
          </p>
        )}
      </div>

      <aside className="flex w-80 shrink-0 flex-col border-l border-slate-200 bg-white">
        {/* Las pestañas van arriba del aside y no sobre el mapa: ahí no tapan la atribución de
            OSM y el tablist queda junto a lo que controla. */}
        <div
          role="tablist"
          aria-label="Herramientas del mapa"
          className="flex shrink-0 gap-1 border-b border-slate-200 p-2"
        >
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              ref={(element) => {
                tabRefs.current[id] = element;
              }}
              type="button"
              role="tab"
              id={`tab-${id}`}
              aria-selected={tab === id}
              // Un solo panel cambia de contenido: las tres pestañas controlan el mismo.
              aria-controls={TOOLS_PANEL_ID}
              // Roving tabindex: el tablist es una sola parada de tabulación.
              tabIndex={tab === id ? 0 : -1}
              onClick={() => changeTab(id)}
              onKeyDown={(event) => moveTab(event, id)}
              className={tab === id ? TAB_ACTIVE_CLASS : TAB_IDLE_CLASS}
            >
              {label}
            </button>
          ))}
        </div>

        <div
          id={TOOLS_PANEL_ID}
          role="tabpanel"
          aria-labelledby={`tab-${tab}`}
          className="min-h-0 flex-1 overflow-y-auto"
        >
          {tab === "grafo" && (
            <div className="p-4">
              <FeatureDetails feature={selected} onClear={() => setSelectedId(null)} />
            </div>
          )}

          {tab === "ruta" && (
            <RoutesTools
              origin={routeOrigin}
              destination={routeDestination}
              picking={routePicking}
              route={calculate.data ?? null}
              isCalculating={calculate.isPending}
              error={calculate.error === null ? null : describeRouteError(calculate.error)}
              onPick={setRoutePicking}
              onSetPoint={setRoutePoint}
              onUseCenter={useCenter}
              onCalculate={requestRoute}
            />
          )}

          {tab === "obstaculos" && (
            <ObstaclesTools
              obstacles={obstacles}
              types={obstaclesQuery.data?.obstacle_types ?? []}
              status={obstacleStatus}
              isPending={obstaclesQuery.isPending}
              selected={selectedObstacle}
              draftPoint={draftPoint}
              isCreating={obstaclePicking || draftPoint !== null}
              onStatusChange={(next) => {
                setObstacleStatus(next);
                // La selección es de otra lista: el detalle no puede seguir mostrando un
                // obstáculo que ya no está en el mapa.
                setObstacleSelectedId(null);
              }}
              onStartCreating={startCreatingObstacle}
              onCancelCreating={cancelCreatingObstacle}
              onCreated={finishCreatingObstacle}
            />
          )}
        </div>
      </aside>
    </div>
  );
}
