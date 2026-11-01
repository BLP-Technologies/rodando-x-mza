import type { OsmExtract, OsmWay } from './osm.reader.js';

/** Clases de vía que entran al grafo (docs/11 §2.1). */
export const INCLUDED_CLASSES: ReadonlySet<string> = new Set([
  'primary',
  'secondary',
  'tertiary',
  'residential',
  'unclassified',
  'living_street',
]);

export type WaySelection = {
  ways: readonly OsmWay[];
  /** Vías descartadas por su clase, contadas por la clase que traen. */
  skippedByClass: ReadonlyMap<string, number>;
  /** Peatonales sin `area=yes`: son calle, pero las deriva #34. */
  pedestrian: number;
  /** `highway=pedestrian` con `area=yes`: son plazas, quedan fuera del grafo. */
  pedestrianAreas: number;
};

/**
 * Aplica el filtro por clase de docs/11 §2.1.
 *
 * Las peatonales y las plazas se cuentan aparte y se dejan afuera: su derivación es
 * #34, y acá se reportan para que el número no desaparezca sin explicación.
 */
export function selectGridWays(extract: OsmExtract): WaySelection {
  const ways: OsmWay[] = [];
  const skippedByClass = new Map<string, number>();
  let pedestrian = 0;
  let pedestrianAreas = 0;

  for (const way of extract.ways) {
    const highwayClass = way.tags.get('highway') ?? 'sin-clase';

    if (highwayClass === 'pedestrian') {
      if (way.tags.get('area') === 'yes') pedestrianAreas += 1;
      else pedestrian += 1;
      continue;
    }

    if (!INCLUDED_CLASSES.has(highwayClass)) {
      skippedByClass.set(highwayClass, (skippedByClass.get(highwayClass) ?? 0) + 1);
      continue;
    }

    ways.push(way);
  }

  return { ways, skippedByClass, pedestrian, pedestrianAreas };
}

/**
 * Por qué una línea se corta en un nodo. El importador lo necesita para saber si en
 * ese extremo hay una esquina (y por lo tanto un cruce) o sólo el fin de la vereda.
 */
export type CutReason = 'junction' | 'boundary' | 'name-change' | 'class-change';

/**
 * Un tramo: la calle entre dos cortes, con sus dos lados todavía sin derivar.
 *
 * El tramo es la unidad de docs/11 §3.3: no es una `way` ni una cuadra, es lo que queda
 * entre dos cortes consecutivos, y puede estar hecho de varias `way`.
 */
export type Tramo = {
  streetName: string | null;
  highwayClass: string;
  nodeIds: readonly number[];
  /** Las `way` que lo componen, en orden. Con esto se resuelve `osm_way_id` (#12). */
  wayIds: readonly number[];
  startCut: CutReason;
  endCut: CutReason;
};

const streetNameOf = (way: OsmWay): string | null => way.tags.get('name') ?? null;
const classOf = (way: OsmWay): string => way.tags.get('highway') ?? '';

/**
 * Parte las calles en tramos: corta en cada intersección y une las `way` que comparten
 * un nodo de grado 2, para que dos tramos consecutivos no generen dos veredas sobre el
 * mismo par de nodos.
 *
 * Un nodo de grado 2 corta igual si cambia el nombre o la clase: `street_name` es una
 * sola columna y no puede representar dos calles (docs/11 §3.8).
 */
export function buildTramos(ways: readonly OsmWay[]): {
  tramos: Tramo[];
  warnings: string[];
} {
  const warnings: string[] = [];
  const byId = new Map(ways.map((way) => [way.id, way]));

  // Grado de cada nodo entre las vías que entran: un extremo de `way` cuenta 1 y un
  // nodo interior cuenta 2. Grado 1 es el borde del extracto; 3 o más, una intersección.
  const degree = new Map<number, number>();
  for (const way of ways) {
    if (way.nodeIds.length < 2) {
      warnings.push(`way ${way.id}: fewer than two nodes, skipped`);
      continue;
    }
    way.nodeIds.forEach((nodeId, index) => {
      const isEnd = index === 0 || index === way.nodeIds.length - 1;
      degree.set(nodeId, (degree.get(nodeId) ?? 0) + (isEnd ? 1 : 2));
    });
  }

  const isJunction = (nodeId: number): boolean => (degree.get(nodeId) ?? 0) >= 3;

  // Cada `way` se parte en sus intersecciones interiores: una sola `way` puede cruzar
  // varias esquinas (docs/11 §2.1). Los cortes en los extremos los pone el encadenado.
  type Segment = { wayId: number; nodeIds: number[] };
  const segments: Segment[] = [];
  for (const way of ways) {
    if (way.nodeIds.length < 2) continue;

    let start = 0;
    for (let index = 1; index < way.nodeIds.length - 1; index += 1) {
      const nodeId = way.nodeIds[index];
      if (nodeId !== undefined && isJunction(nodeId)) {
        segments.push({ wayId: way.id, nodeIds: way.nodeIds.slice(start, index + 1) });
        start = index;
      }
    }
    segments.push({ wayId: way.id, nodeIds: way.nodeIds.slice(start) });
  }

  // Qué segmentos tocan cada nodo por sus extremos, para encadenar.
  const segmentsByEndpoint = new Map<number, Segment[]>();
  for (const segment of segments) {
    for (const nodeId of [segment.nodeIds[0], segment.nodeIds.at(-1)]) {
      if (nodeId === undefined) continue;
      const list = segmentsByEndpoint.get(nodeId) ?? [];
      list.push(segment);
      segmentsByEndpoint.set(nodeId, list);
    }
  }

  const sameStreet = (a: OsmWay, b: OsmWay): boolean =>
    streetNameOf(a) === streetNameOf(b) && classOf(a) === classOf(b);

  const used = new Set<Segment>();
  const tramos: Tramo[] = [];

  for (const first of segments) {
    if (used.has(first)) continue;
    used.add(first);

    const nodeIds = [...first.nodeIds];
    const wayIds = [first.wayId];

    const grow = (atStart: boolean): void => {
      for (;;) {
        const endNode = atStart ? nodeIds[0] : nodeIds.at(-1);
        if (endNode === undefined) return;

        const ownWayId = atStart ? wayIds[0] : wayIds.at(-1);
        const ownWay = ownWayId === undefined ? undefined : byId.get(ownWayId);
        if (ownWay === undefined) return;
        if ((degree.get(endNode) ?? 0) !== 2) return;

        const candidates = (segmentsByEndpoint.get(endNode) ?? []).filter(
          (segment) => !used.has(segment),
        );

        const next = candidates[0];
        if (candidates.length !== 1 || next === undefined) {
          if (candidates.length > 1) {
            warnings.push(`node ${endNode}: ${candidates.length} continuations, chain stopped`);
          }
          return;
        }

        const nextWay = byId.get(next.wayId);
        if (nextWay === undefined || !sameStreet(ownWay, nextWay)) return;

        // Orientar el segmento para que arranque en el nodo compartido.
        const ordered = next.nodeIds[0] === endNode ? next.nodeIds : [...next.nodeIds].reverse();
        if (ordered[0] !== endNode) return;

        used.add(next);
        const rest = ordered.slice(1);
        if (atStart) {
          nodeIds.unshift(...rest);
          wayIds.unshift(next.wayId);
        } else {
          nodeIds.push(...rest);
          wayIds.push(next.wayId);
        }
      }
    };

    grow(false);
    grow(true);

    const startWayId = wayIds[0];
    const endWayId = wayIds.at(-1);
    const startWay = startWayId === undefined ? undefined : byId.get(startWayId);
    const endWay = endWayId === undefined ? undefined : byId.get(endWayId);
    const startNode = nodeIds[0];
    const endNode = nodeIds.at(-1);
    if (startWay === undefined || endWay === undefined || startNode === undefined || endNode === undefined) {
      continue;
    }

    const cutReason = (nodeId: number, way: OsmWay): CutReason => {
      const nodeDegree = degree.get(nodeId) ?? 0;
      if (nodeDegree >= 3) return 'junction';
      if (nodeDegree <= 1) return 'boundary';

      const other = (segmentsByEndpoint.get(nodeId) ?? [])
        .map((segment) => byId.get(segment.wayId))
        .find((candidate) => candidate !== undefined && candidate.id !== way.id);
      if (other === undefined) return 'boundary';

      return streetNameOf(other) !== streetNameOf(way) ? 'name-change' : 'class-change';
    };

    tramos.push({
      streetName: streetNameOf(startWay),
      highwayClass: classOf(startWay),
      nodeIds,
      wayIds,
      startCut: cutReason(startNode, startWay),
      endCut: cutReason(endNode, endWay),
    });
  }

  return { tramos, warnings };
}

/** Un brazo: un tramo que termina en la intersección, con su dirección de salida. */
export type JunctionArm = {
  tramoId: number;
  atStart: boolean;
  /** Dirección de salida desde el nodo, en radianes, 0 = este y positivo al norte. */
  bearing: number;
};

/**
 * Una intersección. `cross` son cuatro brazos y `tee` tres; cualquier otra cosa se
 * reporta y no se deriva.
 */
export type Junction = {
  nodeId: number;
  kind: 'cross' | 'tee' | 'unsupported';
  arms: readonly JunctionArm[];
  /** En una T, el brazo que no tiene par opuesto: la calle que termina. */
  stemTramoId: number | null;
};

const TWO_PI = Math.PI * 2;

/** Ángulo entre dos direcciones, en [0, π], sin importar el sentido. */
function angleBetween(a: number, b: number): number {
  const difference = Math.abs(((a - b + Math.PI) % TWO_PI) - Math.PI);
  return difference;
}

/**
 * Agrupa por nodo los extremos de tramo que caen en una intersección y clasifica cada
 * una por su número de brazos.
 *
 * La distinción no es cosmética: en un cruce de cuatro brazos ninguna línea de vereda
 * es colineal con otra, y las cuatro esquinas salen de intersecar pares. En una T las
 * dos calles que pasan son la misma recta, así que la vereda del lado de la boca no se
 * corta en una esquina sino que sigue de largo (docs/11 §3.2).
 *
 * `tramoId` es la posición del tramo en la lista: todavía no hay ids de base, y el
 * importador los asigna recién al insertar.
 */
export function buildJunctions(
  tramos: readonly Tramo[],
  nodes: ReadonlyMap<number, { lon: number; lat: number }>,
): { junctions: Junction[]; warnings: string[] } {
  const warnings: string[] = [];
  const armsByNode = new Map<number, JunctionArm[]>();

  // Longitud de un grado de longitud a esta latitud, para que los ángulos no salgan
  // deformados por la diferencia entre grados de latitud y de longitud.
  const meanLat =
    [...nodes.values()].reduce((sum, node) => sum + node.lat, 0) / Math.max(nodes.size, 1);
  const lonScale = Math.cos((meanLat * Math.PI) / 180);

  const offset = (from: { lon: number; lat: number }, to: { lon: number; lat: number }) => ({
    east: (to.lon - from.lon) * lonScale,
    north: to.lat - from.lat,
  });

  tramos.forEach((tramo, tramoId) => {
    const first = tramo.nodeIds[0];
    const second = tramo.nodeIds[1];
    const last = tramo.nodeIds.at(-1);
    const beforeLast = tramo.nodeIds.at(-2);

    if (tramo.startCut === 'junction' && first !== undefined && second !== undefined) {
      const node = nodes.get(first);
      const neighbour = nodes.get(second);
      if (node !== undefined && neighbour !== undefined) {
        const { east, north } = offset(node, neighbour);
        const list = armsByNode.get(first) ?? [];
        list.push({ tramoId, atStart: true, bearing: Math.atan2(north, east) });
        armsByNode.set(first, list);
      }
    }

    if (tramo.endCut === 'junction' && last !== undefined && beforeLast !== undefined) {
      const node = nodes.get(last);
      const neighbour = nodes.get(beforeLast);
      if (node !== undefined && neighbour !== undefined) {
        const { east, north } = offset(node, neighbour);
        const list = armsByNode.get(last) ?? [];
        list.push({ tramoId, atStart: false, bearing: Math.atan2(north, east) });
        armsByNode.set(last, list);
      }
    }
  });

  const junctions: Junction[] = [];

  for (const [nodeId, arms] of armsByNode) {
    if (arms.length === 4) {
      junctions.push({ nodeId, kind: 'cross', arms, stemTramoId: null });
      continue;
    }

    if (arms.length === 3) {
      // El brazo sin par opuesto es la calle que termina. Si no hay exactamente uno,
      // la geometría no es una T: tres calles que se tocan en un punto, por ejemplo.
      const stems = arms.filter((arm) =>
        arms.every(
          (other) =>
            other.tramoId === arm.tramoId ||
            angleBetween(arm.bearing, other.bearing) < (2 * Math.PI) / 3,
        ),
      );
      const stem = stems.length === 1 ? stems[0] : undefined;

      if (stem === undefined) {
        warnings.push(`node ${nodeId}: three arms without a single stem, not derived`);
        junctions.push({ nodeId, kind: 'unsupported', arms, stemTramoId: null });
        continue;
      }

      junctions.push({ nodeId, kind: 'tee', arms, stemTramoId: stem.tramoId });
      continue;
    }

    warnings.push(`node ${nodeId}: ${arms.length} arms, not derived`);
    junctions.push({ nodeId, kind: 'unsupported', arms, stemTramoId: null });
  }

  return { junctions, warnings };
}
