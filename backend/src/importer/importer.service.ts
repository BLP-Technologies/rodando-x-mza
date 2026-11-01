import type { OsmExtract, OsmWay } from './osm.reader.js';
import {
  distanceBetweenLines,
  sideOfLine,
  sidewalkOffset,
  type BoulevardGroup,
} from './way-rules.js';

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
  /** Peatonales sin `area=yes`: entran al grafo, con una sola línea sobre el eje. */
  pedestrian: number;
  /** `highway=pedestrian` con `area=yes`: son plazas, quedan fuera del grafo. */
  pedestrianAreas: number;
  /**
   * Las vías que quedaron fuera de la grilla pero podrían ser un brazo: las descartadas
   * por su clase. El reporte las usa para explicar un brazo que falta por su clase en vez
   * de por un error de corte (docs/11 §3.7). Las plazas no entran: una `area=yes` que
   * toca un nodo no es un brazo.
   */
  outsideWays: readonly OsmWay[];
};

/**
 * Aplica el filtro por clase de docs/11 §2.1.
 *
 * Entran las vías de circulación general y la calle peatonal sin `area=yes`. Las plazas
 * (`highway=pedestrian` con `area=yes`) se cuentan aparte y quedan afuera: no son calle.
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
        ways.push(way);
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

/**
 * Una línea caminable: una polilínea por la que se camina (docs/11 §3.1).
 *
 * Es la unidad del grafo, no la calle: un tramo común produce dos, una calzada de
 * boulevard produce la suya y la mediana es una línea más, de la avenida entera.
 */
export type WalkableLine = {
  lineId: number;
  /** `tramo` sale de un tramo del extracto; `median`, de las dos calzadas de un boulevard. */
  kind: 'tramo' | 'median';
  /** El tramo del que sale. La mediana no sale de ninguno: es `null`. */
  tramoId: number | null;
  /** +1 izquierda y −1 derecha del sentido dibujado; 0 sobre el eje (peatonal y mediana). */
  side: 1 | -1 | 0;
  offsetM: number;
  streetName: string | null;
  /** `NULL` en la mediana: sale de dos `way`, no de una (docs/11 §3.6). */
  osmWayId: number | null;
  boulevardId: number | null;
};

/** Las líneas de un tramo, con el lado relativo a cómo está dibujado. */
export type TramoLineRef = { lineId: number; side: 1 | -1 | 0 };

/** Lo que aporta un tramo por ser calzada de un boulevard (§3.6). */
export type BoulevardCalzada = {
  boulevardId: number;
  /** La mediana de la avenida: es la otra línea del brazo, del lado de la otra calzada. */
  medianLineId: number;
};

/** Un tramo ya planificado: su offset, sus líneas y, si es calzada, su boulevard. */
export type PlannedTramo = Tramo & {
  offsetM: number;
  lines: readonly TramoLineRef[];
  calzada: BoulevardCalzada | null;
};

/** La geometría de la mediana de un boulevard (docs/11 §3.6). */
export type BoulevardPlan = {
  boulevardId: number;
  name: string;
  medianLineId: number;
  /** Las `way` de cada lado: son las dos cadenas de donde sale la mediana. */
  sides: readonly [readonly number[], readonly number[]];
  /** Más allá de esto la otra calzada no está: la mediana no se deriva ahí. */
  maxDistanceM: number;
};

/** Un brazo: un tramo que termina en la intersección, con su dirección de salida. */
export type JunctionArm = {
  tramoId: number;
  atStart: boolean;
  /** Dirección de salida desde el nodo, en radianes, 0 = este y positivo al norte. */
  bearing: number;
  /**
   * Las líneas del brazo de izquierda a derecha, visto desde el nodo hacia afuera. Una
   * calle común aporta dos, una peatonal una y una calzada de boulevard dos: su vereda
   * exterior y la mediana, una de cada lado (docs/11 §3.6).
   *
   * La vereda exterior de la **otra** calzada no está acá: es del brazo de esa calzada, y
   * su esquina se deriva en el nodo de ella. Ponerla en los dos brazos dejaba la esquina de
   * este nodo a media avenida de distancia (docs/11 §3.2).
   */
  lines: readonly number[];
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

/**
 * Ángulo entre dos direcciones, en [0, π], sin importar el sentido.
 *
 * El módulo de JavaScript conserva el signo del dividendo, así que `(a - b) % 2π` puede
 * volver negativo y el ángulo saldría de 2π en vez de π: con `a = -103°` y `b = 168°`
 * daba 271° en lugar de 89°, y la T se clasificaba como un nodo de tres brazos sin brazo
 * que termina. Por eso se normaliza a [0, 2π) antes de plegar.
 */
function angleBetween(a: number, b: number): number {
  const counterClockwise = (((a - b) % TWO_PI) + TWO_PI) % TWO_PI;
  return counterClockwise > Math.PI ? TWO_PI - counterClockwise : counterClockwise;
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
  tramos: readonly PlannedTramo[],
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

  /**
   * Las líneas del brazo, de izquierda a derecha visto desde el nodo hacia afuera.
   *
   * El lado de cada línea es relativo al sentido en que está dibujado el tramo, y el
   * brazo se mira desde el nodo: si la intersección es el comienzo del tramo, alejarse es
   * avanzar por la línea y la izquierda coincide; si es el final, se invierte. Una calzada
   * de boulevard suma la mediana **del lado de la otra calzada**: el brazo queda con una
   * línea de cada lado, y la vereda exterior de la otra calzada es del brazo de ella
   * (docs/11 §3.6).
   */
  const armLines = (tramo: PlannedTramo, atStart: boolean): number[] => {
    const ordered = tramo.lines.map((line) => ({
      lineId: line.lineId,
      lateral: line.side * (atStart ? 1 : -1),
    }));

    if (tramo.calzada !== null) {
      const own = ordered[0];
      const sign = own !== undefined && own.lateral < 0 ? -1 : 1;

      ordered.push({ lineId: tramo.calzada.medianLineId, lateral: -sign });
    }

    return ordered
      .sort((first, second) => second.lateral - first.lateral)
      .map((line) => line.lineId);
  };

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
        list.push({
          tramoId,
          atStart: true,
          bearing: Math.atan2(north, east),
          lines: armLines(tramo, true),
        });
        armsByNode.set(first, list);
      }
    }

    if (tramo.endCut === 'junction' && last !== undefined && beforeLast !== undefined) {
      const node = nodes.get(last);
      const neighbour = nodes.get(beforeLast);
      if (node !== undefined && neighbour !== undefined) {
        const { east, north } = offset(node, neighbour);
        const list = armsByNode.get(last) ?? [];
        list.push({
          tramoId,
          atStart: false,
          bearing: Math.atan2(north, east),
          lines: armLines(tramo, false),
        });
        armsByNode.set(last, list);
      }
    }
  });

  const junctions: Junction[] = [];

  for (const [nodeId, rawArms] of armsByNode) {
    if (rawArms.length === 4) {
      junctions.push({ nodeId, kind: 'cross', arms: rawArms, stemTramoId: null });
      continue;
    }

    if (rawArms.length === 3) {
      // El brazo sin par opuesto es la calle que termina. Si no hay exactamente uno,
      // la geometría no es una T: tres calles que se tocan en un punto, por ejemplo.
      const stems = rawArms.filter((arm) =>
        rawArms.every(
          (other) =>
            other.tramoId === arm.tramoId ||
            angleBetween(arm.bearing, other.bearing) < (2 * Math.PI) / 3,
        ),
      );
      const stem = stems.length === 1 ? stems[0] : undefined;

      if (stem === undefined) {
        warnings.push(`node ${nodeId}: three arms without a single stem, not derived`);
        junctions.push({ nodeId, kind: 'unsupported', arms: rawArms, stemTramoId: null });
        continue;
      }

      // El brazo que termina es una calzada de boulevard: el boulevard se acaba acá y la
      // otra calzada termina en su propio nodo. El ancho del brazo es el suyo, no el de
      // la avenida entera (docs/11 §3.6).
      const own = (tramos[stem.tramoId]?.lines ?? []).map((line) => line.lineId);
      const arms =
        own.length === 0
          ? rawArms
          : rawArms.map((arm) => (arm.tramoId === stem.tramoId ? { ...arm, lines: own } : arm));

      junctions.push({ nodeId, kind: 'tee', arms, stemTramoId: stem.tramoId });
      continue;
    }

    warnings.push(`node ${nodeId}: ${rawArms.length} arms, not derived`);
    junctions.push({ nodeId, kind: 'unsupported', arms: rawArms, stemTramoId: null });
  }

  return { junctions, warnings };
}

/** Un nodo de la intersección: dónde se cruzan dos líneas caminables (docs/11 §3.2). */
export type NodePlan = {
  /** Posición de la intersección en la lista que devolvió `buildJunctions`. */
  junctionId: number;
  /** `corner` es una esquina o un nodo de mediana; `boca`, uno del lado opuesto a una T. */
  kind: 'corner' | 'boca';
  first: number;
  second: number;
};

/** Un cruce: la recta entre dos de esos nodos (docs/11 §3.7). */
export type CrossingPlan = {
  junctionId: number;
  /** Posiciones en la lista de nodos de los dos que une. */
  nodeIds: readonly [number, number];
};

/**
 * Arma los nodos y los cruces de cada intersección (docs/11 §3.2 y §3.7).
 *
 * **Un nodo por hueco.** En cada hueco angular hay una esquina: la línea que un brazo
 * mira hacia el de al lado contra la que el otro mira hacia atrás. No se cruzan todas las
 * líneas entre sí: la que mira al brazo de lado, cruzada con la que mira al de enfrente,
 * da un punto en el cuadrante equivocado (docs/11 §3.4).
 *
 * **Los nodos de la mediana.** La mediana no mira a ningún hueco, va por el medio, pero es
 * una línea y las de la calle que pasa la cortan: esos cortes son nodos, y son los que
 * parten el cruce sobre el boulevard en dos, uno por calzada.
 *
 * **La boca de la T.** El hueco abierto no tiene esquina: el brazo que termina prolonga
 * sus líneas exteriores hasta la vereda de enfrente y ahí aterrizan los cruces. Con dos
 * líneas exteriores son dos nodos y la vereda de la boca; con una sola (una peatonal, una
 * calzada suelta) es un nodo y no hay vereda de boca que cerrar.
 *
 * **Los cruces.** El de un brazo es la recta entre el nodo más externo de un lado y el del
 * otro, pasando por los nodos internos: la mediana parte en dos el cruce de la avenida.
 */
export function planCorners(junctions: readonly Junction[]): {
  nodes: NodePlan[];
  crossings: CrossingPlan[];
} {
  const nodes: NodePlan[] = [];
  const crossings: CrossingPlan[] = [];

  junctions.forEach((junction, junctionId) => {
    if (junction.kind === 'unsupported') return;

    // Los brazos en orden angular. Cada par consecutivo borda un cuadrante, y el hueco
    // abierto de una T es el que queda entre los dos brazos que pasan.
    const arms = [...junction.arms].sort((first, second) => first.bearing - second.bearing);
    const count = arms.length;
    const stemIndex = arms.findIndex((arm) => arm.tramoId === junction.stemTramoId);
    const openGap = junction.kind === 'tee' && stemIndex >= 0 ? (stemIndex + 1) % count : -1;

    const add = (kind: NodePlan['kind'], first: number, second: number): number => {
      nodes.push({ junctionId, kind, first, second });
      return nodes.length - 1;
    };

    // Los nodos de cada hueco: los que usa el brazo de la izquierda y los del derecho.
    // En un cuadrante normal son la misma esquina para los dos; en la boca de la T, uno
    // para cada brazo. Cada lista va del nodo más externo hacia adentro.
    type Gap = { forArm: readonly number[]; forNext: readonly number[] };
    const gaps: Gap[] = [];

    for (let index = 0; index < count; index += 1) {
      const arm = arms[index];
      const next = arms[(index + 1) % count];
      if (arm === undefined || next === undefined) continue;

      const armFacing = arm.lines[0];
      const nextFacing = next.lines.at(-1);

      if (index === openGap) {
        const stem = arms[stemIndex];
        if (stem === undefined || armFacing === undefined || nextFacing === undefined) continue;

        // Un nodo de boca por cada línea exterior del brazo que termina. Si el brazo tiene
        // una sola línea, el mismo punto cae sobre las dos veredas del hueco y hay que
        // cortar las dos: son dos planes en el mismo lugar, y el cordón que sale es uno.
        const outer = stem.lines.length <= 1 ? [stem.lines[0]] : [stem.lines[0], stem.lines.at(-1)];
        const bocaForArm = add('boca', outer[0] ?? armFacing, armFacing);
        const bocaForNext = add('boca', outer[1] ?? outer[0] ?? nextFacing, nextFacing);

        gaps.push({ forArm: [bocaForArm], forNext: [bocaForNext] });
        continue;
      }

      if (armFacing === undefined || nextFacing === undefined) continue;

      // La esquina del hueco, más los nodos donde las líneas internas de cada brazo —la
      // mediana— cortan la vereda de enfrente.
      const corner = add('corner', armFacing, nextFacing);
      const armInterior = arm.lines.slice(1, -1);
      const nextInterior = next.lines.slice(1, -1);

      gaps.push({
        forArm: [corner, ...armInterior.map((line) => add('corner', line, nextFacing))],
        forNext: [corner, ...nextInterior.map((line) => add('corner', armFacing, line))],
      });
    }

    for (let index = 0; index < count; index += 1) {
      const gap = gaps[index];
      const previous = gaps[(index - 1 + count) % count];
      if (gap === undefined || previous === undefined) continue;

      const outer = previous.forNext[0];
      const last = gap.forArm[0];
      if (outer === undefined || last === undefined) continue;

      // Del nodo externo de un lado al del otro, pasando por los internos.
      const chain = [outer, ...previous.forNext.slice(1), ...gap.forArm.slice(1), last];

      for (let position = 1; position < chain.length; position += 1) {
        const from = chain[position - 1];
        const to = chain[position];
        if (from === undefined || to === undefined || from === to) continue;
        crossings.push({ junctionId, nodeIds: [from, to] });
      }
    }
  });

  return { nodes, crossings };
}

/**
 * Arma las líneas caminables de la corrida (docs/11 §3.1).
 *
 * Un tramo común da dos líneas, una por costado, a la distancia de su clase o de `lanes`
 * (§3.4). Una calle peatonal da una sola sobre su eje (§3.5), y una calzada de boulevard
 * da sólo la exterior: la de adentro la ocupa la mediana, que es una línea de la avenida
 * entera y no de una calzada (§3.6).
 */
export function planLines(
  tramos: readonly Tramo[],
  waysById: ReadonlyMap<number, OsmWay>,
  nodes: ReadonlyMap<number, { lon: number; lat: number }>,
  boulevards: readonly BoulevardGroup[],
): {
  tramos: PlannedTramo[];
  lines: WalkableLine[];
  boulevards: BoulevardPlan[];
  warnings: string[];
} {
  const warnings: string[] = [];
  const lines: WalkableLine[] = [];

  const boulevardByWay = new Map<number, number>();
  const sideByWay = new Map<number, 0 | 1>();

  boulevards.forEach((boulevard, boulevardId) => {
    for (const wayId of boulevard.wayIds) boulevardByWay.set(wayId, boulevardId);
    boulevard.sides.forEach((side, label) => {
      for (const wayId of side) sideByWay.set(wayId, label === 0 ? 0 : 1);
    });
  });

  const pointsOf = (tramo: Tramo): { lon: number; lat: number }[] =>
    tramo.nodeIds
      .map((nodeId) => nodes.get(nodeId))
      .filter((node): node is { lon: number; lat: number } => node !== undefined);

  // La mediana de cada boulevard: una línea de la avenida entera, no de una calzada, y
  // con `osm_way_id` en NULL porque sale de dos `way` (docs/11 §3.6).
  const medianPlans: BoulevardPlan[] = [];
  const medianLineByBoulevard = new Map<number, number>();

  boulevards.forEach((boulevard, boulevardId) => {
    const lineId = lines.length;
    lines.push({
      lineId,
      kind: 'median',
      tramoId: null,
      side: 0,
      offsetM: 0,
      streetName: boulevard.name,
      osmWayId: null,
      boulevardId,
    });
    medianLineByBoulevard.set(boulevardId, lineId);
    medianPlans.push({
      boulevardId,
      name: boulevard.name,
      medianLineId: lineId,
      sides: boulevard.sides,
      maxDistanceM: Math.round(boulevard.distanceRangeM.max * 1.5 * 10) / 10,
    });
  });

  // De qué boulevard y de qué lado de la avenida es cada tramo, si es una calzada.
  const traceOf = (tramo: Tramo): { boulevardId: number; side: 0 | 1 } | null => {
    const ids = new Set(tramo.wayIds.map((wayId) => boulevardByWay.get(wayId) ?? -1));
    const [only] = [...ids];
    if (ids.size !== 1 || only === undefined || only < 0) return null;
    const side = sideByWay.get(tramo.wayIds[0] ?? -1);
    return side === undefined ? null : { boulevardId: only, side };
  };

  const traces = tramos.map(traceOf);
  const geometries = tramos.map(pointsOf);

  /** El tramo de la otra calzada que corre al lado de éste, si lo hay. */
  const partnerOf = (
    tramoIndex: number,
    trace: { boulevardId: number; side: 0 | 1 },
  ): number | undefined => {
    let nearest: { tramoId: number; distance: number } | undefined;

    traces.forEach((other, otherIndex) => {
      if (other === null || otherIndex === tramoIndex) return;
      if (other.boulevardId !== trace.boulevardId || other.side === trace.side) return;

      const distance = distanceBetweenLines(
        geometries[tramoIndex] ?? [],
        geometries[otherIndex] ?? [],
      );
      if (nearest === undefined || distance < nearest.distance) {
        nearest = { tramoId: otherIndex, distance };
      }
    });

    return nearest?.tramoId;
  };

  // Primera pasada: de qué lado corre la línea de cada tramo. Dos costados para una calle
  // común, el eje para la peatonal y **sólo la exterior** para una calzada de boulevard:
  // la de adentro la ocupa la mediana (docs/11 §3.4 y §3.6).
  const drafts = tramos.map((tramo, tramoIndex) => {
    const way = waysById.get(tramo.wayIds[0] ?? -1);
    if (way === undefined) throw new Error(`Tramo without a way: [${tramo.wayIds.join(', ')}]`);

    const offsetM = sidewalkOffset(way);
    const trace = traces[tramoIndex] ?? null;
    const pedestrian = way.tags.get('highway') === 'pedestrian';

    if (pedestrian) return { tramoIndex, offsetM, trace, sides: [0] as (1 | -1 | 0)[], partner: null };
    if (trace === null) return { tramoIndex, offsetM, trace, sides: [1, -1] as (1 | -1 | 0)[], partner: null };

    const partner = partnerOf(tramoIndex, trace);
    const own = geometries[tramoIndex] ?? [];

    if (partner === undefined || own.length < 2) {
      warnings.push(
        `tramo ${tramo.wayIds.join('+')} (${tramo.streetName ?? 'sin nombre'}): carriageway without its pair, two sidewalks`,
      );
      return { tramoIndex, offsetM, trace, sides: [1, -1] as (1 | -1 | 0)[], partner: null };
    }

    // La vereda exterior es la que mira al otro lado de la avenida: la interior es la que
    // ocupa la mediana.
    const exterior: 1 | -1 = sideOfLine(own, geometries[partner] ?? []) === 1 ? -1 : 1;

    return { tramoIndex, offsetM, trace, sides: [exterior] as (1 | -1 | 0)[], partner };
  });

  // Segunda pasada: las líneas, en el orden de los tramos para que el `lineId` sea estable.
  const plannedLines: number[][] = [];

  for (const draft of drafts) {
    const tramo = tramos[draft.tramoIndex];
    if (tramo === undefined) continue;
    const way = waysById.get(tramo.wayIds[0] ?? -1);

    plannedLines[draft.tramoIndex] = draft.sides.map((side) => {
      const lineId = lines.length;
      lines.push({
        lineId,
        kind: 'tramo',
        tramoId: draft.tramoIndex,
        side,
        offsetM: draft.offsetM,
        streetName: tramo.streetName,
        osmWayId: way?.id ?? null,
        boulevardId: draft.trace?.boulevardId ?? null,
      });
      return lineId;
    });
  }

  const planned: PlannedTramo[] = drafts.map((draft) => {
    const tramo = tramos[draft.tramoIndex];
    if (tramo === undefined) throw new Error('Tramo without a source');

    const trace = draft.trace;
    const calzada =
      trace === null
        ? null
        : {
            boulevardId: trace.boulevardId,
            medianLineId: medianLineByBoulevard.get(trace.boulevardId) ?? -1,
          };

    const lineIds = plannedLines[draft.tramoIndex] ?? [];

    return {
      ...tramo,
      offsetM: draft.offsetM,
      lines: lineIds.flatMap((lineId, position) => {
        const side = draft.sides[position];
        return side === undefined ? [] : [{ lineId, side }];
      }),
      calzada,
    };
  });

  return { tramos: planned, lines, boulevards: medianPlans, warnings };
}
