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
function localProjection(points: readonly OsmNode[]): (point: OsmNode) => LocalPoint {
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
function closestApproach(
  first: readonly LocalPoint[],
  second: readonly LocalPoint[],
): { distance: number; directionFirst: LocalPoint; directionSecond: LocalPoint } | undefined {
  let closest: { distance: number; directionFirst: LocalPoint; directionSecond: LocalPoint } | undefined;

  for (const left of segmentsOf(first)) {
    for (const right of segmentsOf(second)) {
      const distance = Math.min(
        pointToSegment(left.a, right),
        pointToSegment(left.b, right),
        pointToSegment(right.a, left),
        pointToSegment(right.b, left),
      );

      if (closest === undefined || distance < closest.distance) {
        closest = {
          distance,
          directionFirst: directionOf(left),
          directionSecond: directionOf(right),
        };
      }
    }
  }

  return closest;
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
export type Boulevard = {
  name: string;
  /** Las dos calzadas, en el orden en que se encontraron. */
  wayIds: readonly [number, number];
  /** Distancia mínima entre los dos ejes, en metros. */
  distanceM: number;
};

export type BoulevardDetection = {
  /** Vías que quedan fuera de la grilla porque son un boulevard (las deriva #34). */
  excludedWayIds: ReadonlySet<number>;
  boulevards: readonly Boulevard[];
};

/**
 * Detecta los boulevards: dos calzadas con el mismo `name`, en sentidos opuestos y a
 * menos de 25 m (docs/11 §3.6).
 *
 * Es una detección, no una certeza: dos calzadas en el mismo sentido no se detectan y
 * se derivan cuatro veredas sin mediana, que es lo que el reporte de la corrida deja a
 * la vista. Las vías detectadas se excluyen de la grilla porque el boulevard se deriva
 * entero en #34, donde está la mediana.
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

  const boulevards: Boulevard[] = [];
  const excludedWayIds = new Set<number>();

  for (const [name, group] of byName) {
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

        // Y en sentidos opuestos: el sentido de circulación es la dirección dibujada
        // afectada por `oneway`.
        if (dot * first.sense * second.sense >= 0) continue;

        boulevards.push({
          name,
          wayIds: [first.way.id, second.way.id],
          distanceM: Math.round(approach.distance * 10) / 10,
        });
        excludedWayIds.add(first.way.id);
        excludedWayIds.add(second.way.id);
      }
    });
  }

  return { excludedWayIds, boulevards };
}
