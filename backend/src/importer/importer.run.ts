import type { Transaction } from 'kysely';
import type { DB } from '../db/types.js';
import {
  buildJunctions,
  buildTramos,
  planCorners,
  selectGridWays,
} from './importer.service.js';
import { writeGraph, type JunctionReport, type PlannedTramo } from './importer.sql.js';
import { readOsm, type OsmWay } from './osm.reader.js';
import { detectBoulevards, sidewalkOffset } from './way-rules.js';

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
  /** Calzadas de boulevard: se detectaron y se dejan para #34 (docs/11 §3.6). */
  waysExcludedByBoulevard: number;
  boulevards: number;
  /** Peatonales sin `area=yes`: son calle, las deriva #34. */
  pedestrianWays: number;
  /** `highway=pedestrian` con `area=yes`: plazas, fuera del grafo. */
  pedestrianAreas: number;
  tramos: number;
  junctions: { cross: number; tee: number; unsupported: number };
  /** Cordones creados y reusados: la clave es la coordenada (docs/11 §4). */
  kerbs: { created: number; reused: number };
  sidewalks: { created: number; updated: number; boca: number };
  crossings: { created: number; updated: number };
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
 * Importa un extracto y deja el grafo de la grilla en la base.
 *
 * Recibe la transacción ya abierta: la derivación geométrica y las dos escrituras van
 * juntas, así que una corrida que falla no deja cordones sin veredas. No borra nada:
 * inserta lo que falta y actualiza lo que ya está, por su clave geométrica (docs/11 §4).
 */
export async function importOsm(filePath: string, trx: Transaction<DB>): Promise<ImportReport> {
  const extract = await readOsm(filePath);
  const selection = selectGridWays(extract);

  const boulevard = detectBoulevards(selection.ways, extract.nodes);
  const gridWays = selection.ways.filter((way) => !boulevard.excludedWayIds.has(way.id));
  const waysById = new Map(gridWays.map((way) => [way.id, way]));

  const { tramos, warnings: tramoWarnings } = buildTramos(gridWays);
  const planned: PlannedTramo[] = tramos.map((tramo) => {
    const firstWayId = tramo.wayIds[0];
    const way = firstWayId === undefined ? undefined : waysById.get(firstWayId);
    if (way === undefined) {
      throw new Error(`Tramo without a way: [${tramo.wayIds.join(', ')}]`);
    }

    return { ...tramo, offsetM: sidewalkOffset(way) };
  });

  const { junctions, warnings: junctionWarnings } = buildJunctions(planned, extract.nodes);
  const { corners, crossings } = planCorners(junctions);
  const outsideClasses = outsideClassesByNode([
    ...selection.outsideWays,
    ...selection.ways.filter((way) => boulevard.excludedWayIds.has(way.id)),
  ]);

  const counts = await writeGraph(trx, {
    nodes: [...extract.nodes.values()],
    ways: gridWays,
    tramos: planned,
    junctions,
    corners,
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
    waysIncluded: gridWays.length,
    waysSkippedByClass: Object.fromEntries(selection.skippedByClass),
    waysExcludedByBoulevard: boulevard.excludedWayIds.size,
    boulevards: boulevard.boulevards.length,
    pedestrianWays: selection.pedestrian,
    pedestrianAreas: selection.pedestrianAreas,
    tramos: planned.length,
    junctions: junctionKinds,
    kerbs: { created: counts.kerbsCreated, reused: counts.kerbsReused },
    sidewalks: {
      created: counts.sidewalksCreated,
      updated: counts.sidewalksUpdated,
      boca: counts.bocaSidewalks,
    },
    crossings: { created: counts.crossingsCreated, updated: counts.crossingsUpdated },
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
      ...counts.bocaMissingNodeIds.map(
        (nodeId) =>
          `node ${nodeId}: the tee has no "boca" sidewalk, the opposite side is not two corners`,
      ),
      ...junctionCountWarnings(counts.junctions, outsideClasses),
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
 * Las advertencias que salen de contar esquinas y cruces por intersección.
 *
 * Un cruce por brazo y cuatro nodos por intersección son las dos cuentas de docs/11 §3.2
 * y §3.7. Cuando no cierran se reporta el nodo, y si ahí desemboca una vía fuera de la
 * grilla se dice cuál: los dos síntomas son iguales y los problemas no.
 */
function junctionCountWarnings(
  junctions: readonly JunctionReport[],
  outsideClasses: ReadonlyMap<number, string[]>,
): string[] {
  const warnings: string[] = [];

  for (const junction of junctions) {
    const outside = outsideClasses.get(junction.osmNodeId) ?? [];
    const note =
      outside.length === 0 ? '' : `, an out-of-grid way ends here (${outside.join(', ')})`;

    if (junction.corners !== 4) {
      warnings.push(
        `node ${junction.osmNodeId}: ${junction.corners} corners for ${junction.arms} arms${note}`,
      );
    }

    if (junction.crossings !== junction.arms) {
      warnings.push(
        `node ${junction.osmNodeId}: ${junction.crossings} crossings for ${junction.arms} arms${note}`,
      );
    }
  }

  return warnings;
}
