import type { Transaction } from 'kysely';
import type { DB } from '../db/types.js';
import { buildJunctions, buildTramos, selectGridWays } from './importer.service.js';
import { writeGraph, type PlannedTramo } from './importer.sql.js';
import { readOsm } from './osm.reader.js';
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
  /** Defectos de `ST_OffsetCurve` que se resolvieron y se cuentan. */
  lines: { split: number; dropped: number };
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

  const counts = await writeGraph(trx, {
    nodes: [...extract.nodes.values()],
    ways: gridWays,
    tramos: planned,
    junctions,
  });

  const junctionKinds = { cross: 0, tee: 0, unsupported: 0 };
  for (const junction of junctions) junctionKinds[junction.kind] += 1;

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
    lines: { split: counts.linesSplit, dropped: counts.linesDropped },
    warnings: [
      ...tramoWarnings,
      ...junctionWarnings,
      ...counts.bocaMissingNodeIds.map(
        (nodeId) =>
          `node ${nodeId}: the tee has no "boca" sidewalk, the opposite side is not two corners`,
      ),
    ],
  };
}
