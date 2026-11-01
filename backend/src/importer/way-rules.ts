import type { OsmNode, OsmWay } from './osm.reader.js';

/**
 * Reglas que salen de los tags de la vía: a qué distancia se corre su vereda
 * (docs/11 §3.4) y cuándo dos calzadas son un boulevard (docs/11 §3.6).
 */

/** Offset desde el eje, por clase de vía (docs/11 §3.4). */
const OFFSET_BY_CLASS: ReadonlyMap<string, number> = new Map([
  ['primary', 10],
  ['secondary', 8.5],
  ['tertiary', 7.5],
  ['residential', 6.5],
  ['unclassified', 6.5],
  ['living_street', 6.5],
  // La calle peatonal se camina en todo el ancho: su línea va sobre el eje (docs/11 §3.5).
  ['pedestrian', 0],
]);

const LANE_WIDTH_M = 3;
const CURB_M = 1.5;

/**
 * A qué distancia del eje corre la vereda de esta vía.
 *
 * `lanes` gana sobre la clase: `lanes × 3 m / 2 + 1,5 m`, que es media calzada más el
 * cordón. Sin `lanes` manda la tabla por clase. Una clase sin offset es un error del
 * llamador, no un dato que falte: `selectGridWays` sólo deja pasar las que están acá.
 */
export function sidewalkOffset(way: OsmWay): number {
  const lanes = Number(way.tags.get('lanes') ?? '');
  if (Number.isInteger(lanes) && lanes > 0) {
    return (lanes * LANE_WIDTH_M) / 2 + CURB_M;
  }

  const highwayClass = way.tags.get('highway') ?? '';
  const offset = OFFSET_BY_CLASS.get(highwayClass);
  if (offset === undefined) {
    throw new Error(
      `No sidewalk offset for highway=${highwayClass} (way ${way.id}): that class should not reach the derivation`,
    );
  }

  return offset;
}

/** Metros por grado. La Tierra es una esfera acá: alcanza para comparar distancias. */
const METERS_PER_DEGREE = 111_320;

/** Un punto en un plano local en metros, con el este y el norte como ejes. */
type LocalPoint = { east: number; north: number };

/**
 * Proyección local equirectangular, la misma que usa `buildJunctions`.
 *
 * A 33° de latitud el error es de una parte en mil, y estas distancias se comparan
 * contra umbrales de metros: no hace falta un sistema de referencia de verdad.
 */
function localProjection(
  points: readonly { lon: number; lat: number }[],
): (point: { lon: number; lat: number }) => LocalPoint {
  const meanLat = points.reduce((sum, point) => sum + point.lat, 0) / Math.max(points.length, 1);
  const lonScale = Math.cos((meanLat * Math.PI) / 180);

  return (point) => ({
    east: point.lon * METERS_PER_DEGREE * lonScale,
    north: point.lat * METERS_PER_DEGREE,
  });
}

/** Un segmento del plano local. */
type LocalSegment = { a: LocalPoint; b: LocalPoint };

function segmentsOf(points: readonly LocalPoint[]): LocalSegment[] {
  const segments: LocalSegment[] = [];

  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1];
    const b = points[index];
    if (a !== undefined && b !== undefined) segments.push({ a, b });
  }

  return segments;
}

/** Distancia y parámetro del pie de la perpendicular de `point` sobre el segmento. */
function pointToSegment(point: LocalPoint, segment: LocalSegment): number {
  const { a, b } = segment;
  const east = b.east - a.east;
  const north = b.north - a.north;
  const lengthSquared = east * east + north * north;

  const t =
    lengthSquared === 0
      ? 0
      : Math.max(
          0,
          Math.min(
            1,
            ((point.east - a.east) * east + (point.north - a.north) * north) / lengthSquared,
          ),
        );

  return Math.hypot(point.east - (a.east + t * east), point.north - (a.north + t * north));
}

/** Dirección unitaria del segmento, en el orden en que viene dibujado. */
function directionOf(segment: LocalSegment): LocalPoint {
  const east = segment.b.east - segment.a.east;
  const north = segment.b.north - segment.a.north;
  const length = Math.hypot(east, north);

  return length === 0 ? { east: 0, north: 0 } : { east: east / length, north: north / length };
}

/**
 * El punto donde dos líneas se acercan más, con la dirección de cada una ahí.
 *
 * La dirección es la del segmento más cercano y no la del eje entero: una calzada
 * curva no tiene una sola dirección, y lo que interesa es con qué sentido se tocan.
 */
type ClosestApproach = {
  distance: number;
  directionFirst: LocalPoint;
  directionSecond: LocalPoint;
  pointFirst: LocalPoint;
  pointSecond: LocalPoint;
};

function closestApproach(
  first: readonly LocalPoint[],
  second: readonly LocalPoint[],
): ClosestApproach | undefined {
  let closest: ClosestApproach | undefined;

  for (const left of segmentsOf(first)) {
    for (const right of segmentsOf(second)) {
      const candidates: { distance: number; pointFirst: LocalPoint; pointSecond: LocalPoint }[] = [];

      for (const point of [left.a, left.b]) {
        candidates.push({
          distance: pointToSegment(point, right),
          pointFirst: point,
          pointSecond: footOnSegment(point, right),
        });
      }
      for (const point of [right.a, right.b]) {
        candidates.push({
          distance: pointToSegment(point, left),
          pointFirst: footOnSegment(point, left),
          pointSecond: point,
        });
      }

      for (const candidate of candidates) {
        if (closest === undefined || candidate.distance < closest.distance) {
          closest = {
            ...candidate,
            directionFirst: directionOf(left),
            directionSecond: directionOf(right),
          };
        }
      }
    }
  }

  return closest;
}

/** El pie de la perpendicular de `point` sobre el segmento, recortado a sus extremos. */
function footOnSegment(point: LocalPoint, segment: LocalSegment): LocalPoint {
  const east = segment.b.east - segment.a.east;
  const north = segment.b.north - segment.a.north;
  const lengthSquared = east * east + north * north;
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(
          0,
          Math.min(
            1,
            ((point.east - segment.a.east) * east + (point.north - segment.a.north) * north) /
              lengthSquared,
          ),
        );

  return { east: segment.a.east + t * east, north: segment.a.north + t * north };
}

/**
 * Sentido del tránsito respecto del orden de los nodos de la vía.
 *
 * `0` es "no es mano única", y esas vías no pueden ser una calzada de boulevard.
 * `-1` es `oneway=-1`, que circula al revés de cómo está dibujada.
 */
function onewaySense(way: OsmWay): 0 | 1 | -1 {
  const oneway = way.tags.get('oneway');

  if (oneway === 'yes' || oneway === 'true' || oneway === '1') return 1;
  if (oneway === '-1' || oneway === 'reverse') return -1;
  return 0;
}

/** Dos calzadas de la misma vía se buscan por debajo de esta distancia (docs/11 §3.6). */
const BOULEVARD_MAX_DISTANCE_M = 25;

/**
 * Y por encima de ésta: dos líneas superpuestas son la misma calzada dibujada dos veces
 * (por ejemplo, una vía duplicada en sentidos opuestos), no un boulevard.
 */
const BOULEVARD_MIN_DISTANCE_M = 2;

/** Por debajo de este coseno, las dos calzadas no corren paralelas y no son un boulevard. */
const PARALLEL_MIN_DOT = Math.SQRT1_2;

/** Dos calzadas en sentidos opuestos de la misma vía (docs/11 §3.6). */
export type BoulevardPair = {
  name: string;
  /** Las dos calzadas, en el orden en que se encontraron. */
  wayIds: readonly [number, number];
  /** Distancia mínima entre los dos ejes, en metros. */
  distanceM: number;
};

/**
 * Un boulevard entero: la secuencia de pares que corre a lo largo de una calle.
 *
 * Un par de `way` no es una avenida. Una avenida se dibuja en varias `way`, así que el
 * boulevard es la **cadena** de pares y la mediana corre toda la cadena: la unidad de
 * derivación es el grupo y no el par (docs/11 §3.6).
 */
export type BoulevardGroup = {
  name: string;
  /** Todas las calzadas del boulevard. */
  wayIds: readonly number[];
  /** Las dos cadenas, separadas por el lado de la avenida en que corre cada una. */
  sides: readonly [readonly number[], readonly number[]];
  /** Distancia mínima y máxima entre las dos cadenas, en metros. */
  distanceRangeM: { min: number; max: number };
};

export type BoulevardDetection = {
  pairs: readonly BoulevardPair[];
  groups: readonly BoulevardGroup[];
  /** Las calzadas de boulevard detectadas: se derivan, no quedan fuera de la grilla. */
  boulevardWayIds: ReadonlySet<number>;
  /**
   * Pares con el mismo `name`, paralelos y a menos de 25 m pero en el **mismo** sentido:
   * pueden ser un boulevard que el criterio de sentido opuesto no ve. Se reportan en vez
   * de dejar cuatro veredas sin mediana sin decir nada (docs/11 §3.6).
   */
  sameSensePairs: readonly BoulevardPair[];
};

/** De qué lado de la dirección de la primera línea cae la segunda: +1 izquierda, −1 derecha. */
function sideOfApproach(approach: ClosestApproach): 1 | -1 {
  const east = approach.pointSecond.east - approach.pointFirst.east;
  const north = approach.pointSecond.north - approach.pointFirst.north;
  const cross = approach.directionFirst.east * north - approach.directionFirst.north * east;

  return cross >= 0 ? 1 : -1;
}

/**
 * Detecta los boulevards y los agrupa en avenidas completas (docs/11 §3.6).
 *
 * El criterio del par es el del documento: mismo `name`, paralelas, en sentidos opuestos
 * y a menos de 25 m. Y un par nunca es una avenida entera: una avenida son varias `way`,
 * así que los pares se encadenan en grupos y la mediana se deriva una vez por grupo.
 *
 * Es una detección, no una certeza: dos calzadas en el mismo sentido no se detectan y se
 * reportan como posible boulevard no detectado.
 */
export function detectBoulevards(
  ways: readonly OsmWay[],
  nodes: ReadonlyMap<number, OsmNode>,
): BoulevardDetection {
  const candidates: { way: OsmWay; name: string; sense: 1 | -1; points: OsmNode[] }[] = [];

  for (const way of ways) {
    const name = way.tags.get('name');
    const sense = onewaySense(way);
    if (name === undefined || sense === 0) continue;

    const points = way.nodeIds
      .map((nodeId) => nodes.get(nodeId))
      .filter((node): node is OsmNode => node !== undefined);
    if (points.length < 2) continue;

    candidates.push({ way, name, sense, points });
  }

  const project = localProjection(candidates.flatMap((candidate) => candidate.points));
  const local = candidates.map((candidate) => ({
    ...candidate,
    local: candidate.points.map(project),
  }));

  const byName = new Map<string, typeof local>();
  for (const candidate of local) {
    const group = byName.get(candidate.name) ?? [];
    group.push(candidate);
    byName.set(candidate.name, group);
  }

  const pairs: BoulevardPair[] = [];
  const sameSensePairs: BoulevardPair[] = [];

  type Edge = { other: number; distanceM: number };
  const edgesByName = new Map<string, Map<number, Edge[]>>();

  for (const [name, group] of byName) {
    const edges = new Map<number, Edge[]>();

    group.forEach((first, index) => {
      for (const second of group.slice(index + 1)) {
        const approach = closestApproach(first.local, second.local);
        if (approach === undefined) continue;

        if (approach.distance > BOULEVARD_MAX_DISTANCE_M) continue;
        if (approach.distance < BOULEVARD_MIN_DISTANCE_M) continue;

        const dot =
          approach.directionFirst.east * approach.directionSecond.east +
          approach.directionFirst.north * approach.directionSecond.north;

        // Tienen que correr paralelas: dos calles con el mismo nombre que se cruzan no
        // son un boulevard.
        if (Math.abs(dot) < PARALLEL_MIN_DOT) continue;

        const distanceM = Math.round(approach.distance * 10) / 10;
        const pair = { name, wayIds: [first.way.id, second.way.id] as const, distanceM };

        // En sentidos opuestos es boulevard; en el mismo sentido es un candidato que el
        // criterio no puede confirmar y que el reporte tiene que mostrar.
        if (dot * first.sense * second.sense >= 0) {
          sameSensePairs.push(pair);
          continue;
        }

        pairs.push(pair);
        for (const [wayId, other] of [
          [first.way.id, second.way.id],
          [second.way.id, first.way.id],
        ] as const) {
          const list = edges.get(wayId) ?? [];
          list.push({ other, distanceM });
          edges.set(wayId, list);
        }
      }
    });

    edgesByName.set(name, edges);
  }

  const groups: BoulevardGroup[] = [];

  for (const [name, edges] of edgesByName) {
    if (edges.size === 0) continue;

    // Dos calzadas de una avenida están en lados opuestos, así que cada par es una
    // arista entre lados distintos: los lados son las dos mitades de un coloreo bipartito
    // del grafo de pares. Un ciclo impar significa que la detección se contradice y no se
    // deriva el grupo.
    const label = new Map<number, 0 | 1>();
    const distances: number[] = [];
    let consistent = true;

    for (const start of edges.keys()) {
      if (label.has(start)) continue;
      label.set(start, 0);
      const queue = [start];

      while (queue.length > 0) {
        const current = queue.shift();
        if (current === undefined) continue;
        const currentLabel = label.get(current) ?? 0;

        for (const edge of edges.get(current) ?? []) {
          distances.push(edge.distanceM);
          const wanted = currentLabel === 0 ? 1 : 0;
          const existing = label.get(edge.other);

          if (existing === undefined) {
            label.set(edge.other, wanted);
            queue.push(edge.other);
          } else if (existing !== wanted) {
            consistent = false;
          }
        }
      }
    }

    if (!consistent) continue;

    const sideZero = [...label].filter(([, value]) => value === 0).map(([wayId]) => wayId);
    const sideOne = [...label].filter(([, value]) => value === 1).map(([wayId]) => wayId);
    if (sideZero.length === 0 || sideOne.length === 0) continue;

    groups.push({
      name,
      wayIds: [...label.keys()],
      sides: [sideZero, sideOne],
      distanceRangeM: {
        min: Math.min(...distances),
        max: Math.max(...distances),
      },
    });
  }

  return {
    pairs,
    groups,
    boulevardWayIds: new Set(groups.flatMap((group) => group.wayIds)),
    sameSensePairs,
  };
}

/**
 * De qué lado de la línea `from` corre la línea `to`: +1 izquierda, −1 derecha, en el
 * sentido en que está dibujada `from` (docs/11 §3.6).
 *
 * Es lo que decide cuál de las dos veredas de una calzada de boulevard es la exterior: la
 * que mira al otro lado de la avenida es la interior, y ésa la ocupa la mediana.
 */
export function sideOfLine(
  from: readonly { lon: number; lat: number }[],
  to: readonly { lon: number; lat: number }[],
): 1 | -1 {
  const project = localProjection([...from, ...to]);
  const approach = closestApproach(from.map(project), to.map(project));

  return approach === undefined ? 1 : sideOfApproach(approach);
}

/** Distancia mínima de un punto a una polilínea, en metros. */
export function distanceToLine(
  point: { lon: number; lat: number },
  line: readonly { lon: number; lat: number }[],
): number {
  const project = localProjection([...line, point]);
  const target = project(point);

  return Math.min(
    ...segmentsOf(line.map(project)).map((segment) => pointToSegment(target, segment)),
  );
}

/** Distancia mínima entre dos polilíneas, en metros. */
export function distanceBetweenLines(
  first: readonly { lon: number; lat: number }[],
  second: readonly { lon: number; lat: number }[],
): number {
  const project = localProjection([...first, ...second]);
  const approach = closestApproach(first.map(project), second.map(project));

  return approach?.distance ?? Number.POSITIVE_INFINITY;
}
