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
  /**
   * Las vías que quedan fuera de la grilla pero podrían ser un brazo: las descartadas
   * por su clase y las peatonales. El reporte las usa para explicar un brazo que falta
   * por su clase en vez de por un error de corte (docs/11 §3.7). Las plazas no entran:
   * una `area=yes` que toca un nodo no es un brazo.
   */
  outsideWays: readonly OsmWay[];
};

/**
 * Aplica el filtro por clase de docs/11 §2.1.
 *
 * Las peatonales y las plazas se cuentan aparte y se dejan afuera: su derivación es
 * #34, y acá se reportan para que el número no desaparezca sin explicación.
 */
export function selectGridWays(extract: OsmExtract): WaySelection {
  const ways: OsmWay[] = [];
  const outsideWays: OsmWay[] = [];
  const skippedByClass = new Map<string, number>();
  let pedestrian = 0;
  let pedestrianAreas = 0;

  for (const way of extract.ways) {
    const highwayClass = way.tags.get('highway') ?? 'sin-clase';

    if (highwayClass === 'pedestrian') {
      if (way.tags.get('area') === 'yes') {
        pedestrianAreas += 1;
      } else {
        pedestrian += 1;
        outsideWays.push(way);
      }
      continue;
    }

    if (!INCLUDED_CLASSES.has(highwayClass)) {
      skippedByClass.set(highwayClass, (skippedByClass.get(highwayClass) ?? 0) + 1);
      outsideWays.push(way);
      continue;
    }

    ways.push(way);
  }

  return { ways, skippedByClass, pedestrian, pedestrianAreas, outsideWays };
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

/** Una de las dos líneas de un tramo, como la nombra `_import_lines` (docs/11 §3.4). */
export type TramoLine = {
  tramoId: number;
  /** +1 es la izquierda del sentido en que está dibujado el tramo, −1 la derecha. */
  side: 1 | -1;
};

/** Una esquina: la intersección de dos líneas de vereda (docs/11 §3.2). */
export type CornerPlan = {
  /** Posición de la intersección en la lista que devolvió `buildJunctions`. */
  junctionId: number;
  /** `corner` es una esquina de la intersección; `boca`, un nodo del lado opuesto a la T. */
  kind: 'corner' | 'boca';
  first: TramoLine;
  second: TramoLine;
};

/** El cruce de un brazo: la recta entre las dos esquinas que lo flanquean (docs/11 §3.7). */
export type CrossingPlan = {
  junctionId: number;
  tramoId: number;
  /** Posiciones en la lista de esquinas de los dos nodos que une. */
  cornerIds: readonly [number, number];
};

/**
 * El lado de la línea que queda a la izquierda visto **desde el nodo hacia afuera**, que
 * es desde donde se mira qué línea de un brazo enfrenta al brazo de al lado.
 *
 * `_import_lines.side` es relativo al sentido en que está dibujado el tramo, y el tramo
 * se dibuja desde su primer nodo: si la intersección es el comienzo del tramo, alejarse
 * del nodo es avanzar por la línea y la izquierda coincide; si es el final, no.
 */
const leftAwaySide = (arm: JunctionArm): 1 | -1 => (arm.atStart ? 1 : -1);
const rightAwaySide = (arm: JunctionArm): 1 | -1 => (arm.atStart ? -1 : 1);

/**
 * Arma las esquinas y los cruces de cada intersección (docs/11 §3.2 y §3.7).
 *
 * **Una esquina por cuadrante.** La esquina la forman los dos brazos que la bordan, y
 * de cada uno se toma la línea que mira hacia el otro: la de la izquierda de un brazo
 * contra la de la derecha del siguiente. No se cruzan todos los pares de líneas de la
 * intersección: cruzar la línea que mira al brazo de al lado con la que mira al de
 * enfrente da un punto en el cuadrante equivocado, que no es ninguna esquina y que con
 * anchos distintos en cada cuadra queda a metros de la esquina real (docs/11 §3.4).
 *
 * **La boca de la T.** El hueco angular que no toca al brazo que termina tiene dos nodos
 * en vez de una esquina: son donde aterrizan las dos líneas de ese brazo sobre la vereda
 * de enfrente, y entre ellos va la vereda de la boca.
 *
 * **Los cruces.** Cada brazo tiene el suyo, entre la esquina que deja de un lado y la del
 * otro. Con los cuatro nodos de una esquina, el brazo queda entre dos y el cruce es la
 * recta que los une.
 */
export function planCorners(junctions: readonly Junction[]): {
  corners: CornerPlan[];
  crossings: CrossingPlan[];
} {
  const corners: CornerPlan[] = [];
  const crossings: CrossingPlan[] = [];

  junctions.forEach((junction, junctionId) => {
    if (junction.kind === 'unsupported') return;

    // Los brazos en orden angular. Cada par consecutivo borda un cuadrante, y el hueco
    // abierto de una T es el que queda entre los dos brazos que pasan.
    const arms = [...junction.arms].sort((first, second) => first.bearing - second.bearing);
    const count = arms.length;
    const stemIndex = arms.findIndex((arm) => arm.tramoId === junction.stemTramoId);
    const openGap = junction.kind === 'tee' && stemIndex >= 0 ? (stemIndex + 1) % count : -1;

    const add = (kind: CornerPlan['kind'], first: TramoLine, second: TramoLine): number => {
      corners.push({ junctionId, kind, first, second });
      return corners.length - 1;
    };

    // Qué nodo hay de cada lado de cada hueco angular: en un cuadrante normal es la misma
    // esquina para los dos brazos; en la boca de la T, uno para cada brazo.
    type Gap = { forArm: number; forNext: number };
    const gaps: Gap[] = [];

    for (let index = 0; index < count; index += 1) {
      const arm = arms[index];
      const next = arms[(index + 1) % count];
      if (arm === undefined || next === undefined) continue;

      if (index === openGap) {
        const stem = arms[stemIndex];
        if (stem === undefined) continue;

        const left = add(
          'boca',
          { tramoId: stem.tramoId, side: leftAwaySide(stem) },
          { tramoId: arm.tramoId, side: leftAwaySide(arm) },
        );
        const right = add(
          'boca',
          { tramoId: stem.tramoId, side: rightAwaySide(stem) },
          { tramoId: next.tramoId, side: rightAwaySide(next) },
        );
        gaps.push({ forArm: left, forNext: right });
        continue;
      }

      const corner = add(
        'corner',
        { tramoId: arm.tramoId, side: leftAwaySide(arm) },
        { tramoId: next.tramoId, side: rightAwaySide(next) },
      );
      gaps.push({ forArm: corner, forNext: corner });
    }

    for (let index = 0; index < count; index += 1) {
      const gap = gaps[index];
      const previous = gaps[(index - 1 + count) % count];
      const arm = arms[index];
      if (gap === undefined || previous === undefined || arm === undefined) continue;

      crossings.push({
        junctionId,
        tramoId: arm.tramoId,
        cornerIds: [previous.forNext, gap.forArm],
      });
    }
  });

  return { corners, crossings };
}
