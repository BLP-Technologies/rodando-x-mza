/**
 * El dibujo de cada capa del mapa, en funciones puras.
 *
 * Antes cada pantalla con mapa tenía su propio archivo de dibujo y, con ellos, su propia copia
 * de los detalles de Leaflet: el orden de alta, el `bubblingMouseEvents` que deja pasar el clic
 * al fondo, el `interactive: false` del borde. Con una sola pantalla y un solo `LayerGroup`,
 * esas decisiones viven acá, separadas de quién las decide prender o apagar.
 *
 * **Los colores no se eligen acá.** Salen de `feature-style.ts` (los niveles y el borde del
 * área), de `obstacle-labels.ts` (la severidad) y de `route-labels.ts` (las dos puntas): una
 * capa es un módulo de lectura, no de diseño.
 *
 * Importa Leaflet, así que **nunca** puede evaluarse en el servidor: lo importa `map-screen.tsx`,
 * que ya viene debajo del `ssr: false` de `map-panel.tsx`.
 */

import * as L from 'leaflet';

import type { GraphFeature, GraphLevel, ServiceArea } from '@/api/graph';
import type { ObstacleFeature } from '@/api/obstacles';
import type { ReportFeature } from '@/api/reports';
import type { RoutePoint, RouteResponse } from '@/api/routes';
import { RESOLVED_MARKER_COLOR, SEVERITY_MARKER_COLORS } from '@/obstacles/obstacle-labels';
import { DESTINATION_COLOR, ORIGIN_COLOR, PICKED_POINT_COLOR } from '@/routes/route-labels';
import { lineStyle, pointStyle, serviceAreaStyle } from './feature-style';

/** Un punto en el orden de la API (y no el de Leaflet): el borrador del alta de obstáculos. */
export type MapPoint = { lon: number; lat: number };

/** Lo dibujado de un elemento del grafo, para repintar sólo el que cambia de estado. */
export type DrawnFeature = { path: L.Path; level: GraphLevel };

/** GeoJSON guarda `[lon, lat]`; Leaflet dibuja `[lat, lon]`. */
function toLatLng([lon, lat]: [number, number]): [number, number] {
  return [lat, lon];
}

/** La clave de selección: identifica el elemento sin depender del objeto ni del refetch. */
export function featureKey(feature: GraphFeature): string {
  return `${feature.properties.element_kind}:${feature.properties.element_id}`;
}

/**
 * El borde del área de servicio activa, sin relleno y sin capturar clics.
 *
 * Los huecos de un polígono no se dibujan: el área es un perímetro y no una zona con
 * exclusiones, y el `ST_Buffer` del piloto devuelve un anillo solo.
 */
export function drawServiceAreas(
  layers: L.LayerGroup,
  areas: readonly ServiceArea[],
): void {
  for (const area of areas) {
    const ring = (area.geometry.coordinates[0] ?? []).map(toLatLng);
    layers.addLayer(new L.Polygon(ring, serviceAreaStyle()));
  }
}

type GraphDrawOptions = {
  /** El elemento que ya nace resaltado, para que un redibujado no pierda la selección. */
  selectedId: string | null;
  /**
   * Sólo en la pestaña Grafo: es la única donde un elemento se selecciona. En las otras el
   * clic sobre el grafo no cambia nada, ni siquiera en silencio.
   */
  selectable: boolean;
  onSelect: (id: string) => void;
};

/**
 * Las veredas, los cruces y los cordones, más el tooltip de la calle.
 *
 * Devuelve lo dibujado por elemento: el repintado de la selección toca dos capas y no las
 * 977 del piloto, así que necesita saber cuál es el trazo de cada `id`.
 */
export function drawGraph(
  layers: L.LayerGroup,
  features: readonly GraphFeature[],
  options: GraphDrawOptions,
): Map<string, DrawnFeature> {
  const drawn = new Map<string, DrawnFeature>();

  for (const feature of features) {
    const id = featureKey(feature);
    const level = feature.properties.level;
    const isSelected = id === options.selectedId;

    // Los estilos llevan `bubblingMouseEvents: false`, que es lo que evita que el clic llegue
    // al fondo del mapa.
    const path: L.Path =
      feature.geometry.type === 'LineString'
        ? new L.Polyline(
            feature.geometry.coordinates.map(toLatLng),
            lineStyle(level, isSelected),
          )
        : new L.CircleMarker(
            toLatLng(feature.geometry.coordinates),
            pointStyle(level, isSelected),
          );

    // El tooltip es de la vereda y dice en qué calle está: es la respuesta a "no me acuerdo
    // en qué calle estaba". No captura el clic ni sustituye a la ficha, y los cruces y
    // cordones no tienen calle que mostrar.
    if (
      feature.geometry.type === 'LineString' &&
      feature.properties.element_kind === 'sidewalk' &&
      feature.properties.street_name !== null
    ) {
      path.bindTooltip(feature.properties.street_name, { interactive: false });
    }

    // Seleccionar es de la pestaña Grafo: en las otras el clic sobre el grafo no cambia
    // nada, ni siquiera en silencio.
    if (options.selectable) path.on('click', () => options.onSelect(id));
    layers.addLayer(path);
    drawn.set(id, { path, level });
  }

  return drawn;
}

/**
 * El color de un reporte pendiente.
 *
 * Fijo y fuera de la paleta de niveles (verde, ámbar, rojo y gris) y del azul del área: un
 * reporte no dice todavía qué tan accesible es el lugar, dice que alguien vio algo.
 */
const REPORT_COLOR = '#db2777';

/**
 * Los reportes ciudadanos pendientes: un anillo por punto, sin interacción.
 *
 * El anillo y no un círculo lleno es lo que los distingue de un obstáculo ya publicado en
 * el mismo mapa; y no son clickeables porque el mapa no tiene ninguna acción para ellos.
 */
export function drawReports(
  layers: L.LayerGroup,
  reports: readonly ReportFeature[],
): void {
  for (const report of reports) {
    const [lon, lat] = report.geometry.coordinates;

    layers.addLayer(
      new L.CircleMarker([lat, lon], {
        radius: 6,
        color: REPORT_COLOR,
        weight: 2,
        fill: false,
        interactive: false,
      }),
    );
  }
}

/** El estilo de un obstáculo: el color de su severidad, o el gris de uno ya resuelto. */
function obstacleStyle(
  obstacle: ObstacleFeature,
  isSelected: boolean,
  interactive: boolean,
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
    interactive,
    // Sin esto el clic llegaría también al fondo del mapa, que es el que suelta la
    // selección de la pestaña Grafo.
    bubblingMouseEvents: false,
  };
}

/**
 * El punto del alta en curso, mientras el formulario está abierto.
 *
 * Tenue y sin relleno: es un borrador y no un obstáculo publicado, así que no comparte la
 * paleta de severidades.
 */
function draftMarker(point: MapPoint): L.CircleMarker {
  return new L.CircleMarker([point.lat, point.lon], {
    radius: 9,
    color: '#0369a1',
    fillColor: '#0ea5e9',
    fillOpacity: 0.4,
    dashArray: '4 4',
    weight: 2,
    interactive: false,
  });
}

type ObstaclesDrawOptions = {
  selectedId: number | null;
  /**
   * Sólo cuando la pestaña es Obstáculos y no hay modo de clic activo: en el resto de los
   * casos el clic es del modo o de la selección del grafo, y un marcador que se lo come
   * rompe las dos cosas.
   */
  interactive: boolean;
  onSelect: (id: number) => void;
  /** El borrador del alta en curso, si hay uno. */
  draft: MapPoint | null;
};

/** Los obstáculos publicados, con su color por severidad. */
export function drawObstacles(
  layers: L.LayerGroup,
  obstacles: readonly ObstacleFeature[],
  options: ObstaclesDrawOptions,
): void {
  for (const obstacle of obstacles) {
    const [lon, lat] = obstacle.geometry.coordinates;
    const id = obstacle.properties.id;

    const marker = new L.CircleMarker(
      [lat, lon],
      obstacleStyle(obstacle, id === options.selectedId, options.interactive),
    );

    if (options.interactive) marker.on('click', () => options.onSelect(id));
    layers.addLayer(marker);
  }

  if (options.draft !== null) layers.addLayer(draftMarker(options.draft));
}

/**
 * El nodo al que se pegó una punta, con el color de esa punta.
 *
 * `interactive: false` para que no capture clics: el mapa donde se dibuja también es el que
 * marca puntas, y un marcador que se come el clic rompe el modo de elegir punto.
 */
function endpointMarker(point: { lat: number; lon: number }, color: string): L.CircleMarker {
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

/**
 * El recorrido, sus dos puntas y los puntos marcados.
 *
 * Un `Polyline` por tramo y no una línea fusionada: cada tramo tiene su nivel cobrado y su
 * elemento, y el color sale de ahí. Las puntas se dibujan también cuando no hay recorrido:
 * ahí son el diagnóstico, las dos cayeron en componentes distintos del grafo. Los puntos
 * marcados van arriba de todo y se dibujan apenas existen, aunque todavía no se haya pedido
 * nada: son la confirmación de que el clic registró el lugar.
 */
export function drawRoute(
  layers: L.LayerGroup,
  route: RouteResponse | null,
  origin: RoutePoint | null,
  destination: RoutePoint | null,
): void {
  if (route !== null) {
    if (route.found) {
      for (const leg of route.legs) {
        layers.addLayer(
          new L.Polyline(leg.geometry.coordinates.map(toLatLng), lineStyle(leg.level, false)),
        );
      }
    }

    layers.addLayer(endpointMarker(route.origin.node, ORIGIN_COLOR));
    layers.addLayer(endpointMarker(route.destination.node, DESTINATION_COLOR));
  }

  if (origin !== null) layers.addLayer(pickedMarker(origin));
  if (destination !== null) layers.addLayer(pickedMarker(destination));
}

/**
 * Repinta la selección del grafo: sólo las dos capas que cambian, no las 977.
 *
 * Se llama sólo cuando cambia la selección; cuando cambian los datos, el redibujado crea el
 * elemento seleccionado ya resaltado.
 */
export function repaintSelection(
  drawn: ReadonlyMap<string, DrawnFeature>,
  previousId: string | null,
  selectedId: string | null,
): void {
  const paint = (id: string | null, isSelected: boolean) => {
    if (id === null) return;
    const feature = drawn.get(id);
    if (feature === undefined) return;

    if (feature.path instanceof L.CircleMarker) {
      const style = pointStyle(feature.level, isSelected);
      feature.path.setStyle(style);
      feature.path.setRadius(style.radius ?? 5);
    } else {
      feature.path.setStyle(lineStyle(feature.level, isSelected));
    }
  };

  paint(previousId, false);
  paint(selectedId, true);
}
