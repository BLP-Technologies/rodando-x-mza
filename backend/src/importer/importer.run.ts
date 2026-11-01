import type { Transaction } from 'kysely';
import type { DB } from '../db/types.js';
import {
  buildJunctions,
  buildTramos,
  planCorners,
  planLines,
  selectGridWays,
} from './importer.service.js';
import { writeGraph, type JunctionReport } from './importer.sql.js';
import { readOsm, type OsmWay } from './osm.reader.js';
import { detectBoulevards } from './way-rules.js';

/**
 * El reporte de una corrida: lo que entró, lo que se derivó y lo que quedó afuera.
 *
 * Es la salida del comando y también lo que hace visible una imperfección del extracto
 * (docs/11 §4): una vía que no se pudo leer, una línea que `ST_OffsetCurve` no pudo
 * correr y una intersección que no se derivó aparecen acá y no como un grafo silencioso
 * más chico.
 */
export type ImportReport = {
  extract: string;
  waysRead: number;
  waysIncluded: number;
  /** Vías descartadas por su clase, contadas por clase. */
  waysSkippedByClass: Record<string, number>;
  /** Los boulevards detectados: una avenida cada uno, con sus pares y sus calzadas. */
  boulevards: { groups: number; pairs: number; carriageways: number; names: readonly string[] };
  /** Peatonales sin `area=yes`: entran con una sola línea sobre el eje. */
  pedestrianWays: number;
  /** `highway=pedestrian` con `area=yes`: plazas, fuera del grafo. */
  pedestrianAreas: number;
  tramos: number;
  /** Líneas caminables: dos por tramo común, una por calzada y una por mediana. */
  walkableLines: { total: number; medians: number };
  junctions: { cross: number; tee: number; unsupported: number };
  /** Cordones creados y reusados: la clave es la coordenada (docs/11 §4). */
  kerbs: { created: number; reused: number };
  sidewalks: { created: number; updated: number; boca: number };
  /** `median`: los que salen de la mediana al atravesar una calle (docs/11 §3.6). */
  crossings: { created: number; updated: number; median: number };
  /** Vías que se cruzan sin compartir un nodo: se reportan y no se derivan. */
  unsharedCrossings: number;
  /** Defectos de `ST_OffsetCurve` que se resolvieron y se cuentan. */
  lines: {
    split: number;
    dropped: number;
    /**
     * Tramos que quedaron sin alguna de sus veredas porque los cortes no cayeron sobre la
     * línea. No cuenta los que terminan en una intersección no soportada: ésos ya se
     * reportan por nodo, y la línea sin vereda es la consecuencia (docs/11 §3.2).
     */
    withoutSidewalk: number;
  };
  warnings: readonly string[];
};

/**
 * Importa un extracto y deja el grafo en la base.
 *
 * Recibe la transacción ya abierta: la derivación geométrica y las dos escrituras van
 * juntas, así que una corrida que falla no deja cordones sin veredas. No borra nada:
 * inserta lo que falta y actualiza lo que ya está, por su clave geométrica (docs/11 §4).
 */
export async function importOsm(filePath: string, trx: Transaction<DB>): Promise<ImportReport> {
  const extract = await readOsm(filePath);
  const selection = selectGridWays(extract);
  const waysById = new Map(selection.ways.map((way) => [way.id, way]));

  const boulevard = detectBoulevards(selection.ways, extract.nodes);

  const { tramos, warnings: tramoWarnings } = buildTramos(selection.ways);
  const planned = planLines(tramos, waysById, extract.nodes, boulevard.groups);
  const { junctions, warnings: junctionWarnings } = buildJunctions(planned.tramos, extract.nodes);
  const { nodes: nodePlans, crossings } = planCorners(junctions);
  const outsideClasses = outsideClassesByNode(selection.outsideWays);

  const counts = await writeGraph(trx, {
    nodes: [...extract.nodes.values()],
    ways: selection.ways,
    tramos: planned.tramos,
    lines: planned.lines,
    boulevards: planned.boulevards,
    junctions,
    nodePlans,
    crossings,
  });

  const junctionKinds = { cross: 0, tee: 0, unsupported: 0 };
  for (const junction of junctions) junctionKinds[junction.kind] += 1;

  // Los tramos que desembocan en una intersección no soportada quedan con una punta sin
  // esquina: se reporta el nodo, no cada una de las calles que llegan a él.
  const unsupportedTramos = new Set(
    junctions
      .filter((junction) => junction.kind === 'unsupported')
      .flatMap((junction) => junction.arms.map((arm) => arm.tramoId)),
  );

  return {
    extract: filePath,
    waysRead: extract.ways.length,
    waysIncluded: selection.ways.length,
    waysSkippedByClass: Object.fromEntries(selection.skippedByClass),
    boulevards: {
      groups: boulevard.groups.length,
      pairs: boulevard.pairs.length,
      carriageways: boulevard.boulevardWayIds.size,
      names: boulevard.groups.map((group) => group.name),
    },
    pedestrianWays: selection.pedestrian,
    pedestrianAreas: selection.pedestrianAreas,
    tramos: planned.tramos.length,
    walkableLines: {
      total: planned.lines.length,
      medians: planned.lines.filter((line) => line.kind === 'median').length,
    },
    junctions: junctionKinds,
    kerbs: { created: counts.kerbsCreated, reused: counts.kerbsReused },
    sidewalks: {
      created: counts.sidewalksCreated,
      updated: counts.sidewalksUpdated,
      boca: counts.bocaSidewalks,
    },
    crossings: {
      created: counts.crossingsCreated,
      updated: counts.crossingsUpdated,
      median: counts.medianCrossings,
    },
    unsharedCrossings: counts.unsharedCrossings.length,
    lines: {
      split: counts.linesSplit,
      dropped: counts.linesDropped,
      withoutSidewalk: counts.linesWithoutSidewalk.filter(
        (tramo) => !unsupportedTramos.has(tramo.tramoId),
      ).length,
    },
    warnings: [
      ...tramoWarnings,
      ...junctionWarnings,
      ...planned.warnings,
      ...counts.bocaMissingNodeIds.map(
        (nodeId) =>
          `node ${nodeId}: the tee has no "boca" sidewalk, the opposite side is not two nodes`,
      ),
      ...counts.mediansWithoutPieces.map(
        (boulevardId) => `boulevard ${boulevardId}: the median has no edges, no street crosses it`,
      ),
      ...counts.medians
        .filter((median) => median.dropped > 0)
        .map(
          (median) =>
            `boulevard ${median.boulevardId}: ${median.dropped} median stations dropped, the other carriageway ends there`,
        ),
      ...boulevard.sameSensePairs.map(
        (pair) =>
          `ways ${pair.wayIds.join(' and ')} (${pair.name}): two carriageways ${pair.distanceM} m apart in the same direction, maybe an undetected boulevard`,
      ),
      ...junctionShapeWarnings(counts.junctions, outsideClasses),
      ...counts.unsharedCrossings.map(([first, second]) =>
        unsharedCrossingWarning(first, second, waysById),
      ),
      ...counts.linesWithoutSidewalk
        .filter((tramo) => !unsupportedTramos.has(tramo.tramoId))
        .map(
          (tramo) =>
            `tramo ${tramo.tramoId} (${tramo.streetName ?? 'sin nombre'}): a line without a sidewalk, its cuts do not fall on it`,
        ),
    ],
  };
}

/** La advertencia de dos vías que se cruzan sin compartir nodo, con sus nombres. */
function unsharedCrossingWarning(
  firstWayId: number,
  secondWayId: number,
  waysById: ReadonlyMap<number, OsmWay>,
): string {
  const describe = (wayId: number): string => {
    const way = waysById.get(wayId);
    const name = way?.tags.get('name') ?? 'sin nombre';
    const highwayClass = way?.tags.get('highway') ?? 'sin clase';
    return `way ${wayId} (${name}, ${highwayClass})`;
  };

  return `${describe(firstWayId)} and ${describe(secondWayId)} cross without a shared node: not derived`;
}

/**
 * Qué clases de vía fuera de la grilla tocan cada nodo del extracto.
 *
 * Es lo que permite decir por qué una intersección tiene menos brazos de los que se ven
 * en el mapa: un `service` que desemboca ahí no entra al grafo y no es un error de corte
 * (docs/11 §3.7).
 */
function outsideClassesByNode(ways: readonly OsmWay[]): ReadonlyMap<number, string[]> {
  const classes = new Map<number, Set<string>>();

  for (const way of ways) {
    const highwayClass = way.tags.get('highway') ?? 'sin-clase';
    for (const nodeId of way.nodeIds) {
      const list = classes.get(nodeId) ?? new Set<string>();
      list.add(highwayClass);
      classes.set(nodeId, list);
    }
  }

  return new Map([...classes].map(([nodeId, list]) => [nodeId, [...list].sort()]));
}

/**
 * Las advertencias que salen de la forma de cada intersección (docs/11 §4).
 *
 * No hay una cuenta fija que exigir: con el boulevard y la peatonal, los brazos aportan
 * una, dos o tres líneas y la cuenta depende de la forma. Lo que sí no puede pasar es una
 * intersección sin nodos o sin ningún cruce, y cuando pasa el reporte dice el nodo, y si
 * ahí desemboca una vía fuera de la grilla se dice cuál: un `service` que termina en la
 * esquina y un error de corte dan el mismo síntoma y no son el mismo problema.
 */
function junctionShapeWarnings(
  junctions: readonly JunctionReport[],
  outsideClasses: ReadonlyMap<number, string[]>,
): string[] {
  const warnings: string[] = [];

  for (const junction of junctions) {
    const outside = outsideClasses.get(junction.osmNodeId) ?? [];
    const note =
      outside.length === 0 ? '' : `, an out-of-grid way ends here (${outside.join(', ')})`;

    if (junction.nodes < 2) {
      warnings.push(
        `node ${junction.osmNodeId}: ${junction.nodes} nodes for ${junction.arms} arms${note}`,
      );
    }

    if (junction.crossings === 0) {
      warnings.push(
        `node ${junction.osmNodeId}: ${junction.arms} arms without crossings${note}`,
      );
    }
  }

  return warnings;
}
