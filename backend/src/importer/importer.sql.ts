import { sql, type Transaction } from 'kysely';
import type { DB } from '../db/types.js';
import type {
  BoulevardPlan,
  CrossingPlan,
  Junction,
  NodePlan,
  PlannedTramo,
  WalkableLine,
} from './importer.service.js';
import type { OsmNode, OsmWay } from './osm.reader.js';

/**
 * La capa SQL del importador: convierte las líneas y las intersecciones que derivó
 * `importer.service` en veredas y cordones, y los escribe con upsert (docs/11 §3 y §4).
 *
 * Todo pasa en tablas temporales dentro de la transacción del llamador: la geometría se
 * calcula con PostGIS y la base se escribe una sola vez al final, así que una corrida
 * que falla a mitad no deja medio grafo. Ninguna de las dos escrituras pisa
 * `accessibility_level` ni `is_verified`: el relevamiento sobrevive a la reimportación.
 *
 * Las coordenadas de los puntos que el importador deriva (esquinas y extremos) se
 * normalizan a **6 decimales** (~10 cm) antes de buscar sus filas. La identidad de
 * `kerb_nodes` es la coordenada a 7 decimales (docs/11 §4), pero una misma esquina
 * calculada por dos pares de líneas distintos difiere en centímetros —el eje de los dos
 * tramos de la calle que pasa no coincide exactamente en el nodo—: sin esta
 * normalización, el mismo punto entra como dos cordones a centímetros de distancia y la
 * vereda de la boca de la T deja de encontrar sus dos nodos.
 */

export type GraphInput = {
  /** Todos los nodos del extracto: son los vértices de las geometrías. */
  nodes: readonly OsmNode[];
  /** Las vías que entran a la grilla. */
  ways: readonly OsmWay[];
  tramos: readonly PlannedTramo[];
  /** Todas las líneas caminables: es lo que se corre, se corta y se escribe. */
  lines: readonly WalkableLine[];
  /** La mediana de cada boulevard, con las dos cadenas de las que sale. */
  boulevards: readonly BoulevardPlan[];
  junctions: readonly Junction[];
  /** Los nodos: esquinas, boca de una T y cruces de la mediana con otra calle. */
  nodePlans: readonly NodePlan[];
  /** Un cruce por calzada atravesada (docs/11 §3.7). */
  crossings: readonly CrossingPlan[];
};

/**
 * Lo que el reporte dice de cada intersección derivada.
 *
 * No hay una cuenta fija que cerrar: un cruce de cuatro brazos tiene 4 nodos y 4 cruces,
 * una T de dos líneas 4 y 3, una T de una línea 2 y 1, y el boulevard suma la mediana
 * (docs/11 §4). Por eso el reporte muestra la forma —brazos y líneas por brazo— y avisa
 * sólo cuando algo no puede cerrar.
 */
export type JunctionReport = {
  osmNodeId: number;
  kind: 'cross' | 'tee';
  arms: number;
  /** Cuántas líneas aporta cada brazo, en orden angular. */
  armLines: readonly number[];
  /** Esquinas, nodos de boca y nodos de mediana: donde se juntan dos líneas. */
  nodes: number;
  crossings: number;
};

export type GraphCounts = {
  /** Cordones que la corrida creó; los que ya existían por coordenada se reusan. */
  kerbsCreated: number;
  kerbsReused: number;
  sidewalksCreated: number;
  sidewalksUpdated: number;
  crossingsCreated: number;
  crossingsUpdated: number;
  /** Urbes de `ST_OffsetCurve` que volvieron `MultiLineString` y se recortaron. */
  linesSplit: number;
  /** Líneas que volvieron `NULL`: el offset no entraba en la curva del eje. */
  linesDropped: number;
  /** Veredas de la boca de una T, que no caen sobre la línea de ningún tramo. */
  bocaSidewalks: number;
  /** T que no derivaron su vereda de la boca teniendo dos líneas para aterrizar. */
  bocaMissingNodeIds: readonly number[];
  /** Cruces que salen de la mediana al atravesar una calle (docs/11 §3.6). */
  medianCrossings: number;
  /** Por boulevard: estaciones de la mediana usadas y descartadas por falta de la otra calzada. */
  medians: readonly { boulevardId: number; stations: number; dropped: number }[];
  /** Medianas que no produjeron ninguna arista: sin dos nodos no hay tramo que caminar. */
  mediansWithoutPieces: readonly number[];
  /** Una fila por intersección: es lo que el reporte cuenta (docs/11 §4). */
  junctions: readonly JunctionReport[];
  /**
   * Tramos con alguna línea que no produjo vereda: sus cortes no cayeron sobre la línea,
   * así que el tramo no existe en el grafo. Se reporta y no se inventa la vereda.
   */
  linesWithoutSidewalk: readonly { tramoId: number; streetName: string | null }[];
  /**
   * Pares de vías que se cruzan a menos de ~2 m sin compartir un nodo de OSM: se reportan
   * y no se derivan, porque inventar la intersección sería adivinar (docs/11 §3.2).
   */
  unsharedCrossings: readonly (readonly [number, number])[];
};

/**
 * Monta el grafo de la grilla y devuelve cuántas filas se crearon y se actualizaron.
 *
 * Los pasos son los de docs/11 §3, en orden: se corren las líneas, se intersecan para
 * tener esquinas, se cortan las líneas en sus nodos y se insertan los tramos como
 * aristas. Los nodos salen de la intersección de líneas y nunca de un nodo de OSM.
 */
export async function writeGraph(
  trx: Transaction<DB>,
  input: GraphInput,
): Promise<GraphCounts> {
  await stageExtract(trx, input);

  const linesSplit = await deriveLines(trx);
  const linesDropped = await countDroppedLines(trx);
  const medians = await deriveMedians(trx);
  await deriveCorners(trx);
  await deriveLineEnds(trx);
  await deriveBocaPieces(trx);
  await derivePieces(trx);
  await classifyMedianPieces(trx);

  await collectKerbPoints(trx);
  const kerbsCreated = await insertKerbNodes(trx);
  const kerbsTotal = await countKerbPoints(trx);
  await mapKerbIds(trx);
  await mapCornerKerbIds(trx);

  await deriveSidewalkRows(trx);
  const { created, updated } = await upsertSidewalks(trx);

  const crossings = await upsertCrossings(trx);

  return {
    kerbsCreated,
    kerbsReused: kerbsTotal - kerbsCreated,
    sidewalksCreated: created,
    sidewalksUpdated: updated,
    crossingsCreated: crossings.created,
    crossingsUpdated: crossings.updated,
    linesSplit,
    linesDropped,
    bocaSidewalks: await countBocaSidewalks(trx),
    bocaMissingNodeIds: await findTeesWithoutBoca(trx),
    medianCrossings: crossings.medianCrossings,
    medians,
    mediansWithoutPieces: await findMediansWithoutPieces(trx),
    junctions: await reportJunctions(trx),
    linesWithoutSidewalk: await findLinesWithoutSidewalk(trx),
    unsharedCrossings: await findUnsharedCrossings(trx),
  };
}

/**
 * Deja en tablas temporales lo que se derivó en TypeScript.
 *
 * Las vías y los tramos llegan con sus nodos en orden, y la geometría la arma PostGIS
 * con `ST_MakeLine`: así el extracto es la única fuente de coordenadas y no hay
texto de WKT viajando entre las dos capas.
 */
async function stageExtract(trx: Transaction<DB>, input: GraphInput): Promise<void> {
  const { nodes, ways, tramos, lines, boulevards, junctions, nodePlans, crossings } = input;
  const nodesById = new Map(nodes.map((node) => [node.id, node]));

  // Una corrida anterior en la misma sesión dejaría sus tablas temporales: se descartan
  // antes de empezar (el test de integración corre el importador dos veces seguidas).
  await sql`
    DROP TABLE IF EXISTS
      _import_nodes, _import_way_nodes, _import_ways, _import_tramo_nodes,
      _import_tramos, _import_tramo_ways, _import_lines_plan, _import_lines,
      _import_boulevards, _import_boulevard_ways, _import_median_lines,
      _import_junctions, _import_junction_arms, _import_node_plans, _import_crossing_plans,
      _import_corner_points, _import_line_end_points, _import_boca_pieces,
      _import_kerb_points, _import_kerbs, _import_corner_kerbs, _import_cut_points,
      _import_pieces, _import_median_crossings, _import_sidewalk_rows, _import_crossing_rows
  `.execute(trx);

  await sql`
    CREATE TEMP TABLE _import_nodes (
      osm_node_id bigint PRIMARY KEY,
      geom geometry(Point, 4326) NOT NULL
    ) ON COMMIT DROP
  `.execute(trx);

  await sql`
    INSERT INTO _import_nodes (osm_node_id, geom)
    SELECT extract.id, ST_SetSRID(ST_MakePoint(extract.lon, extract.lat), 4326)
    FROM unnest(
      ${nodes.map((node) => node.id)}::bigint[],
      ${nodes.map((node) => node.lon)}::float8[],
      ${nodes.map((node) => node.lat)}::float8[]
    ) AS extract(id, lon, lat)
  `.execute(trx);

  // Una vía de un solo nodo no tiene geometría y `buildTramos` ya la descartó.
  const stagedWays = ways.filter((way) => way.nodeIds.length >= 2);

  await sql`
    CREATE TEMP TABLE _import_way_nodes (
      way_id bigint NOT NULL,
      ord integer NOT NULL,
      osm_node_id bigint NOT NULL
    ) ON COMMIT DROP
  `.execute(trx);

  await sql`
    INSERT INTO _import_way_nodes (way_id, ord, osm_node_id)
    SELECT refs.way_id, refs.ord, refs.osm_node_id
    FROM unnest(
      ${stagedWays.flatMap((way) => way.nodeIds.map(() => way.id))}::bigint[],
      ${stagedWays.flatMap((way) => way.nodeIds.map((_, ord) => ord))}::int[],
      ${stagedWays.flatMap((way) => way.nodeIds)}::bigint[]
    ) AS refs(way_id, ord, osm_node_id)
  `.execute(trx);

  await sql`
    CREATE TEMP TABLE _import_ways AS
    SELECT meta.way_id, meta.street_name, meta.highway_class,
           ST_MakeLine(n.geom ORDER BY refs.ord) AS geom
    FROM unnest(
      ${stagedWays.map((way) => way.id)}::bigint[],
      ${stagedWays.map((way) => way.tags.get('name') ?? null)}::text[],
      ${stagedWays.map((way) => way.tags.get('highway') ?? null)}::text[]
    ) AS meta(way_id, street_name, highway_class)
    JOIN _import_way_nodes refs ON refs.way_id = meta.way_id
    JOIN _import_nodes n ON n.osm_node_id = refs.osm_node_id
    GROUP BY meta.way_id, meta.street_name, meta.highway_class
  `.execute(trx);

  await sql`
    CREATE TEMP TABLE _import_tramo_nodes (
      tramo_id integer NOT NULL,
      ord integer NOT NULL,
      osm_node_id bigint NOT NULL
    ) ON COMMIT DROP
  `.execute(trx);

  await sql`
    INSERT INTO _import_tramo_nodes (tramo_id, ord, osm_node_id)
    SELECT refs.tramo_id, refs.ord, refs.osm_node_id
    FROM unnest(
      ${tramos.flatMap((tramo, tramoId) => tramo.nodeIds.map(() => tramoId))}::int[],
      ${tramos.flatMap((tramo) => tramo.nodeIds.map((_, ord) => ord))}::int[],
      ${tramos.flatMap((tramo) => tramo.nodeIds)}::bigint[]
    ) AS refs(tramo_id, ord, osm_node_id)
  `.execute(trx);

  await sql`
    CREATE TEMP TABLE _import_tramos AS
    SELECT meta.tramo_id, meta.street_name, meta.highway_class, meta.offset_m,
           meta.start_cut, meta.end_cut,
           ST_MakeLine(n.geom ORDER BY refs.ord) AS geom
    FROM unnest(
      ${tramos.map((_, tramoId) => tramoId)}::int[],
      ${tramos.map((tramo) => tramo.streetName)}::text[],
      ${tramos.map((tramo) => tramo.highwayClass)}::text[],
      ${tramos.map((tramo) => tramo.offsetM)}::float8[],
      ${tramos.map((tramo) => tramo.startCut)}::text[],
      ${tramos.map((tramo) => tramo.endCut)}::text[]
    ) AS meta(tramo_id, street_name, highway_class, offset_m, start_cut, end_cut)
    JOIN _import_tramo_nodes refs ON refs.tramo_id = meta.tramo_id
    JOIN _import_nodes n ON n.osm_node_id = refs.osm_node_id
    GROUP BY meta.tramo_id, meta.street_name, meta.highway_class, meta.offset_m,
             meta.start_cut, meta.end_cut
  `.execute(trx);

  // `osm_way_id` sale de la `way` que contiene el punto medio del tramo, así que las
  // vías de cada tramo se guardan en orden.
  await sql`
    CREATE TEMP TABLE _import_tramo_ways (
      tramo_id integer NOT NULL,
      ord integer NOT NULL,
      way_id bigint NOT NULL
    ) ON COMMIT DROP
  `.execute(trx);

  await sql`
    INSERT INTO _import_tramo_ways (tramo_id, ord, way_id)
    SELECT refs.tramo_id, refs.ord, refs.way_id
    FROM unnest(
      ${tramos.flatMap((tramo, tramoId) => tramo.wayIds.map(() => tramoId))}::int[],
      ${tramos.flatMap((tramo) => tramo.wayIds.map((_, ord) => ord))}::int[],
      ${tramos.flatMap((tramo) => tramo.wayIds)}::bigint[]
    ) AS refs(tramo_id, ord, way_id)
  `.execute(trx);

  // Las líneas caminables tal como las planeó `importer.service`: el SQL no decide
  // cuántas tiene cada tramo, sólo les da geometría y las corta (docs/11 §3.1).
  await sql`
    CREATE TEMP TABLE _import_lines_plan (
      line_id integer PRIMARY KEY,
      kind text NOT NULL,
      tramo_id integer,
      side integer NOT NULL,
      offset_m float8 NOT NULL,
      street_name varchar(100),
      osm_way_id bigint,
      boulevard_id integer
    ) ON COMMIT DROP
  `.execute(trx);

  await sql`
    INSERT INTO _import_lines_plan (
      line_id, kind, tramo_id, side, offset_m, street_name, osm_way_id, boulevard_id)
    SELECT plan.line_id, plan.kind, plan.tramo_id, plan.side, plan.offset_m,
           plan.street_name, plan.osm_way_id, plan.boulevard_id
    FROM unnest(
      ${lines.map((line) => line.lineId)}::int[],
      ${lines.map((line) => line.kind)}::text[],
      ${lines.map((line) => line.tramoId)}::int[],
      ${lines.map((line) => line.side)}::int[],
      ${lines.map((line) => line.offsetM)}::float8[],
      ${lines.map((line) => line.streetName)}::text[],
      ${lines.map((line) => line.osmWayId)}::bigint[],
      ${lines.map((line) => line.boulevardId)}::int[]
    ) AS plan(line_id, kind, tramo_id, side, offset_m, street_name, osm_way_id, boulevard_id)
  `.execute(trx);

  // El boulevard y sus dos cadenas: la mediana sale del punto medio entre las dos, así
  // que la avenida tiene que estar entera acá (docs/11 §3.6).
  await sql`
    CREATE TEMP TABLE _import_boulevards (
      boulevard_id integer PRIMARY KEY,
      name text NOT NULL,
      median_line_id integer NOT NULL,
      max_distance_m float8 NOT NULL
    ) ON COMMIT DROP
  `.execute(trx);

  await sql`
    INSERT INTO _import_boulevards (boulevard_id, name, median_line_id, max_distance_m)
    SELECT boulevard.boulevard_id, boulevard.name, boulevard.median_line_id,
           boulevard.max_distance_m
    FROM unnest(
      ${boulevards.map((boulevard) => boulevard.boulevardId)}::int[],
      ${boulevards.map((boulevard) => boulevard.name)}::text[],
      ${boulevards.map((boulevard) => boulevard.medianLineId)}::int[],
      ${boulevards.map((boulevard) => boulevard.maxDistanceM)}::float8[]
    ) AS boulevard(boulevard_id, name, median_line_id, max_distance_m)
  `.execute(trx);

  await sql`
    CREATE TEMP TABLE _import_boulevard_ways (
      boulevard_id integer NOT NULL,
      side integer NOT NULL,
      way_id bigint NOT NULL
    ) ON COMMIT DROP
  `.execute(trx);

  await sql`
    INSERT INTO _import_boulevard_ways (boulevard_id, side, way_id)
    SELECT refs.boulevard_id, refs.side, refs.way_id
    FROM unnest(
      ${boulevards.flatMap((boulevard) =>
        boulevard.sides.flatMap((side) => side.map(() => boulevard.boulevardId)),
      )}::int[],
      ${boulevards.flatMap((boulevard) =>
        boulevard.sides.flatMap((side, index) => side.map(() => index)),
      )}::int[],
      ${boulevards.flatMap((boulevard) => boulevard.sides.flatMap((side) => side))}::bigint[]
    ) AS refs(boulevard_id, side, way_id)
  `.execute(trx);

  // Sólo las intersecciones que se derivan: las que no se soportan se reportan y no
  // generan ni nodos ni cortes, así que sus tramos quedan con extremos sueltos.
  const derived = junctions
    .map((junction, junctionId) => ({ junction, junctionId }))
    .filter(({ junction }) => junction.kind !== 'unsupported');

  await sql`
    CREATE TEMP TABLE _import_junctions (
      junction_id integer PRIMARY KEY,
      osm_node_id bigint NOT NULL,
      kind text NOT NULL,
      stem_tramo_id integer,
      geom geometry(Point, 4326) NOT NULL
    ) ON COMMIT DROP
  `.execute(trx);

  await sql`
    INSERT INTO _import_junctions (junction_id, osm_node_id, kind, stem_tramo_id, geom)
    SELECT j.junction_id, j.osm_node_id, j.kind, j.stem_tramo_id,
           ST_SetSRID(ST_MakePoint(j.lon, j.lat), 4326)
    FROM unnest(
      ${derived.map(({ junctionId }) => junctionId)}::int[],
      ${derived.map(({ junction }) => junction.nodeId)}::bigint[],
      ${derived.map(({ junction }) => junction.kind)}::text[],
      ${derived.map(({ junction }) => junction.stemTramoId)}::int[],
      ${derived.map(({ junction }) => nodesById.get(junction.nodeId)?.lon ?? null)}::float8[],
      ${derived.map(({ junction }) => nodesById.get(junction.nodeId)?.lat ?? null)}::float8[]
    ) AS j(junction_id, osm_node_id, kind, stem_tramo_id, lon, lat)
  `.execute(trx);

  // Los brazos, con cuántas líneas aporta cada uno: es la forma de la intersección y lo
  // que el reporte muestra en vez de exigir cuatro nodos (docs/11 §4).
  await sql`
    CREATE TEMP TABLE _import_junction_arms (
      junction_id integer NOT NULL,
      tramo_id integer NOT NULL,
      at_start boolean NOT NULL,
      bearing float8 NOT NULL,
      line_count integer NOT NULL
    ) ON COMMIT DROP
  `.execute(trx);

  await sql`
    INSERT INTO _import_junction_arms (junction_id, tramo_id, at_start, bearing, line_count)
    SELECT arms.junction_id, arms.tramo_id, arms.at_start, arms.bearing, arms.line_count
    FROM unnest(
      ${derived.flatMap(({ junction, junctionId }) =>
        junction.arms.map(() => junctionId),
      )}::int[],
      ${derived.flatMap(({ junction }) => junction.arms.map((arm) => arm.tramoId))}::int[],
      ${derived.flatMap(({ junction }) => junction.arms.map((arm) => arm.atStart))}::boolean[],
      ${derived.flatMap(({ junction }) => junction.arms.map((arm) => arm.bearing))}::float8[],
      ${derived.flatMap(({ junction }) => junction.arms.map((arm) => arm.lines.length))}::int[]
    ) AS arms(junction_id, tramo_id, at_start, bearing, line_count)
  `.execute(trx);

  await sql`
    CREATE TEMP TABLE _import_node_plans (
      plan_id integer PRIMARY KEY,
      junction_id integer NOT NULL,
      kind text NOT NULL,
      line_a integer NOT NULL,
      line_b integer NOT NULL
    ) ON COMMIT DROP
  `.execute(trx);

  await sql`
    INSERT INTO _import_node_plans (plan_id, junction_id, kind, line_a, line_b)
    SELECT plan.plan_id, plan.junction_id, plan.kind, plan.line_a, plan.line_b
    FROM unnest(
      ${nodePlans.map((_, planId) => planId)}::int[],
      ${nodePlans.map((plan) => plan.junctionId)}::int[],
      ${nodePlans.map((plan) => plan.kind)}::text[],
      ${nodePlans.map((plan) => plan.first)}::int[],
      ${nodePlans.map((plan) => plan.second)}::int[]
    ) AS plan(plan_id, junction_id, kind, line_a, line_b)
  `.execute(trx);

  await sql`
    CREATE TEMP TABLE _import_crossing_plans (
      junction_id integer NOT NULL,
      node_a integer NOT NULL,
      node_b integer NOT NULL
    ) ON COMMIT DROP
  `.execute(trx);

  await sql`
    INSERT INTO _import_crossing_plans (junction_id, node_a, node_b)
    SELECT plan.junction_id, plan.node_a, plan.node_b
    FROM unnest(
      ${crossings.map((crossing) => crossing.junctionId)}::int[],
      ${crossings.map((crossing) => crossing.nodeIds[0])}::int[],
      ${crossings.map((crossing) => crossing.nodeIds[1])}::int[]
    ) AS plan(junction_id, node_a, node_b)
  `.execute(trx);
}

/**
 * Le da geometría a cada línea caminable (docs/11 §3.1, §3.4 y §3.5).
 *
 * Las líneas de un tramo con offset se corren con `ST_OffsetCurve` sobre EPSG 32719 y
 * vuelven a 4326. La distancia va con signo: el positivo corre a la izquierda del sentido
 * del tramo y el negativo a la derecha, y la línea se reorienta al final para que su
 * comienzo sea el del tramo, porque `ST_OffsetCurve` con distancia negativa la devuelve al
 * revés y todo lo que viene después depende de saber cuál extremo es cuál.
 *
 * Los dos defectos conocidos de `ST_OffsetCurve` se resuelven acá y se cuentan: un
 * `MultiLineString` (la línea se cruza consigo misma) se recorta a su pieza más larga y un
 * `NULL` (el offset no entra en la curva) descarta la línea.
 *
 * La calle peatonal va sobre su eje, sin correr: se camina en todo el ancho (§3.5).
 *
 * Devuelve cuántas líneas hubo que recortar por haber vuelto `MultiLineString`.
 */
async function deriveLines(trx: Transaction<DB>): Promise<number> {
  await sql`
    CREATE TEMP TABLE _import_lines_raw (
      line_id integer NOT NULL,
      geom_32719 geometry
    ) ON COMMIT DROP
  `.execute(trx);

  await sql`
    INSERT INTO _import_lines_raw (line_id, geom_32719)
    SELECT plan.line_id,
           ST_OffsetCurve(ST_Transform(tramo.geom, 32719), plan.side * plan.offset_m)
    FROM _import_lines_plan plan
    JOIN _import_tramos tramo ON tramo.tramo_id = plan.tramo_id
    WHERE plan.kind = 'tramo' AND plan.offset_m > 0
  `.execute(trx);

  await sql`
    CREATE TEMP TABLE _import_lines (
      line_id integer PRIMARY KEY,
      kind text NOT NULL,
      tramo_id integer,
      side integer NOT NULL,
      offset_m float8 NOT NULL,
      street_name varchar(100),
      osm_way_id bigint,
      boulevard_id integer,
      geom geometry(LineString, 4326) NOT NULL
    ) ON COMMIT DROP
  `.execute(trx);

  await sql`
    INSERT INTO _import_lines (
      line_id, kind, tramo_id, side, offset_m, street_name, osm_way_id, boulevard_id, geom)
    SELECT DISTINCT ON (raw.line_id)
           plan.line_id, plan.kind, plan.tramo_id, plan.side, plan.offset_m,
           plan.street_name, plan.osm_way_id, plan.boulevard_id,
           CASE
             WHEN ST_Distance(ST_StartPoint(piece.geom_4326), ST_StartPoint(tramo.geom))
                  <= ST_Distance(ST_EndPoint(piece.geom_4326), ST_StartPoint(tramo.geom))
             THEN piece.geom_4326
             ELSE ST_Reverse(piece.geom_4326)
           END
    FROM _import_lines_raw raw
    JOIN _import_lines_plan plan ON plan.line_id = raw.line_id
    JOIN _import_tramos tramo ON tramo.tramo_id = plan.tramo_id
    CROSS JOIN LATERAL (
      SELECT ST_Transform(dumped.geom, 4326) AS geom_4326,
             ST_Length(dumped.geom) AS length_32719
      FROM ST_Dump(raw.geom_32719) AS dumped
    ) piece
    ORDER BY raw.line_id, piece.length_32719 DESC
  `.execute(trx);

  // La peatonal no se corre: su única línea es el eje del tramo, tal como viene.
  await sql`
    INSERT INTO _import_lines (
      line_id, kind, tramo_id, side, offset_m, street_name, osm_way_id, boulevard_id, geom)
    SELECT plan.line_id, plan.kind, plan.tramo_id, plan.side, plan.offset_m,
           plan.street_name, plan.osm_way_id, plan.boulevard_id, tramo.geom
    FROM _import_lines_plan plan
    JOIN _import_tramos tramo ON tramo.tramo_id = plan.tramo_id
    WHERE plan.kind = 'tramo' AND plan.offset_m = 0
  `.execute(trx);

  const split = await sql<{ count: string }>`
    SELECT count(*) AS count
    FROM _import_lines_raw
    WHERE ST_GeometryType(geom_32719) = 'ST_MultiLineString'
  `.execute(trx);

  return Number(split.rows[0]?.count ?? 0);
}

/** Cuántas líneas se descartaron porque `ST_OffsetCurve` devolvió `NULL`. */
async function countDroppedLines(trx: Transaction<DB>): Promise<number> {
  const result = await sql<{ count: string }>`
    SELECT count(*) AS count FROM _import_lines_raw WHERE geom_32719 IS NULL
  `.execute(trx);

  return Number(result.rows[0]?.count ?? 0);
}

/**
 * Deriva la mediana de cada boulevard (docs/11 §3.6).
 *
 * La mediana es la línea equidistante entre las dos calzadas, y «equidistante» se toma en
 * serio: una sola distancia no sirve porque el ancho de la avenida cambia (Belgrano va de
 * 19,7 a 23,6 m), así que se toman estaciones cada 10 m sobre una de las dos cadenas, se
 * busca el punto más cercano de la otra y se guarda el punto medio. La cadena sale de
 * `ST_LineMerge` de las `way` de ese lado, que comparten nodos.
 *
 * El resultado es **una franja por avenida**, no una por par de calzadas. Donde la otra
 * calzada ya no está —el boulevard se termina— la estación se descarta y se cuenta: más
 * allá de eso no hay mediana que caminar.
 */
async function deriveMedians(
  trx: Transaction<DB>,
): Promise<{ boulevardId: number; stations: number; dropped: number }[]> {
  await sql`
    CREATE TEMP TABLE _import_median_lines AS
    WITH chain AS (
      SELECT boulevard.boulevard_id, boulevard.median_line_id, boulevard.max_distance_m,
             side.side,
             ST_LineMerge(ST_Collect(ST_Transform(way.geom, 32719))) AS geom_32719
      FROM _import_boulevard_ways side
      JOIN _import_boulevards boulevard ON boulevard.boulevard_id = side.boulevard_id
      JOIN _import_ways way ON way.way_id = side.way_id
      GROUP BY boulevard.boulevard_id, boulevard.median_line_id, boulevard.max_distance_m,
               side.side
    ), pair AS (
      SELECT reference.boulevard_id, reference.median_line_id, reference.max_distance_m,
             reference.geom_32719 AS reference_geom, partner.geom_32719 AS partner_geom
      FROM chain reference
      JOIN chain partner
        ON partner.boulevard_id = reference.boulevard_id AND partner.side <> reference.side
      WHERE reference.side = 0
    ), stations AS (
      SELECT pair.boulevard_id, pair.median_line_id, pair.max_distance_m,
             station.geom AS point_32719,
             station.path[1] AS ord,
             ST_ClosestPoint(pair.partner_geom, station.geom) AS partner_point_32719,
             ST_Distance(station.geom, ST_ClosestPoint(pair.partner_geom, station.geom))
               AS separation_m
      FROM pair
      CROSS JOIN LATERAL ST_DumpPoints(ST_Segmentize(pair.reference_geom, 10)) AS station
    ), kept AS (
      SELECT boulevard_id, median_line_id, ord,
             ST_LineInterpolatePoint(
               ST_MakeLine(point_32719, partner_point_32719), 0.5) AS geom_32719
      FROM stations
      WHERE separation_m <= max_distance_m
    ), counted AS (
      SELECT boulevard_id, max(median_line_id) AS median_line_id,
             count(*) FILTER (WHERE separation_m <= max_distance_m) AS stations,
             count(*) FILTER (WHERE separation_m > max_distance_m) AS dropped
      FROM stations
      GROUP BY boulevard_id
    )
    SELECT counted.boulevard_id, counted.median_line_id, counted.stations, counted.dropped,
           ST_Transform(ST_MakeLine(kept.geom_32719 ORDER BY kept.ord), 4326) AS geom
    FROM counted
    JOIN kept ON kept.boulevard_id = counted.boulevard_id
    GROUP BY counted.boulevard_id, counted.median_line_id, counted.stations, counted.dropped
  `.execute(trx);

  await sql`
    INSERT INTO _import_lines (
      line_id, kind, tramo_id, side, offset_m, street_name, osm_way_id, boulevard_id, geom)
    SELECT plan.line_id, plan.kind, plan.tramo_id, plan.side, plan.offset_m,
           plan.street_name, plan.osm_way_id, plan.boulevard_id, median.geom
    FROM _import_median_lines median
    JOIN _import_lines_plan plan ON plan.line_id = median.median_line_id
    WHERE median.geom IS NOT NULL
  `.execute(trx);

  const result = await sql<{ boulevard_id: number; stations: string; dropped: string }>`
    SELECT boulevard_id, stations, dropped FROM _import_median_lines ORDER BY boulevard_id
  `.execute(trx);

  return result.rows.map((row) => ({
    boulevardId: Number(row.boulevard_id),
    stations: Number(row.stations),
    dropped: Number(row.dropped),
  }));
}

/**
 * Calcula los nodos de cada intersección (docs/11 §3.2).
 *
 * Cada nodo lo define un par de líneas que se cruzan: la esquina, el nodo de la boca de
 * una T o el de la mediana donde la corta la calle que pasa. Esas dos líneas se cruzan
 * exactamente ahí, así que la regla no necesita tolerancias para tirar puntos sobrantes:
 * no hay puntos sobrantes.
 *
 * Las líneas se prolongan con `ST_LineExtend` porque el nodo puede quedar fuera de los dos
 * segmentos: en la boca de una T la línea del brazo que termina muere en el eje de la
 * calle que pasa y la vereda de enfrente está del otro lado, y una mediana está a media
 * avenida de la línea que la corta. El alcance de la prolongación va con el offset, así
 * que se descarta el punto que aparezca más lejos que eso.
 *
 * El punto se redondea a 6 decimales (~10 cm) y ese es el número con el que después se
 * corta la línea y se busca el cordón: las tres cosas usan la misma coordenada.
 */
async function deriveCorners(trx: Transaction<DB>): Promise<void> {
  await sql`
    CREATE TEMP TABLE _import_corner_points AS
    SELECT plan.plan_id, plan.junction_id, plan.kind,
           round(ST_X(ST_Transform(point.geom, 4326))::numeric, 6) AS x,
           round(ST_Y(ST_Transform(point.geom, 4326))::numeric, 6) AS y,
           ST_SetSRID(
             ST_MakePoint(
               round(ST_X(ST_Transform(point.geom, 4326))::numeric, 6)::float8,
               round(ST_Y(ST_Transform(point.geom, 4326))::numeric, 6)::float8),
             4326) AS geom
    FROM _import_node_plans plan
    JOIN _import_junctions junction ON junction.junction_id = plan.junction_id
    JOIN _import_lines first ON first.line_id = plan.line_a
    JOIN _import_lines second ON second.line_id = plan.line_b
    -- El alcance de la prolongación no sale sólo del offset: el nodo puede estar a media
    -- avenida de la línea que lo corta —la vereda exterior de la otra calzada de un
    -- boulevard ancho—, así que se suma la distancia entre las dos líneas.
    CROSS JOIN LATERAL (
      SELECT 3 * GREATEST(first.offset_m, second.offset_m, 6.5)
               + ST_Distance(ST_Transform(first.geom, 32719), ST_Transform(second.geom, 32719))
               AS reach,
             ST_Transform(junction.geom, 32719) AS node_32719
    ) extent
    CROSS JOIN LATERAL (
      SELECT ST_Intersection(
               ST_LineExtend(ST_Transform(first.geom, 32719), extent.reach, extent.reach),
               ST_LineExtend(ST_Transform(second.geom, 32719), extent.reach, extent.reach)
             ) AS intersection
    ) found
    -- Las dos líneas pueden cortarse en más de un punto —la mediana corre a lo largo de
    -- toda la avenida y su prolongación vuelve a cruzar la vereda de la transversal—, así
    -- que se toma el corte más cercano al nodo de la intersección.
    CROSS JOIN LATERAL (
      SELECT dumped.geom
      FROM ST_Dump(found.intersection) AS dumped
      WHERE ST_GeometryType(dumped.geom) = 'ST_Point'
      ORDER BY ST_Distance(dumped.geom, extent.node_32719)
      LIMIT 1
    ) point
    WHERE NOT ST_IsEmpty(found.intersection)
      AND ST_Distance(point.geom, extent.node_32719) < extent.reach
  `.execute(trx);
}

/**
 * Los extremos de línea que son nodo: el borde del extracto y el cambio de nombre o de
 * clase a mitad de cuadra (docs/11 §3.2 y §3.8).
 *
 * Los extremos de una intersección no entran: ahí la línea termina en el centro de la
 * intersección y las esquinas ya los reemplazaron.
 */
async function deriveLineEnds(trx: Transaction<DB>): Promise<void> {
  await sql`
    CREATE TEMP TABLE _import_line_end_points AS
    SELECT l.line_id,
           CASE WHEN ends.at_start THEN ST_StartPoint(l.geom) ELSE ST_EndPoint(l.geom) END
             AS geom
    FROM _import_lines l
    JOIN _import_tramos t ON t.tramo_id = l.tramo_id
    CROSS JOIN (VALUES (true), (false)) AS ends(at_start)
    WHERE (ends.at_start AND t.start_cut <> 'junction')
       OR (NOT ends.at_start AND t.end_cut <> 'junction')
  `.execute(trx);
}

/**
 * La vereda de la boca de una T (docs/11 §3.2).
 *
 * Del lado opuesto al brazo que termina quedan dos nodos que no son intersección de dos
 * líneas de vereda: son donde aterrizan los cruces sobre la calle que pasa, y salen de
 * prolongar las dos líneas exteriores del brazo. Entre esos dos nodos va esta vereda. No
 * está sobre la línea de ningún tramo —cada línea termina en el centro de la
 * intersección— así que se construye aparte; es lo que cierra el grafo de la T.
 *
 * Un brazo de una sola línea —una peatonal, una calzada suelta al terminar el boulevard—
 * da **un** nodo del lado opuesto y no dos: ahí no hay vereda de boca que cerrar, porque
 * la vereda de enfrente pasa por ese nodo sin cortarse (docs/11 §3.2).
 *
 * El lado se resuelve por la dirección del brazo: los dos nodos del lado opuesto son los
 * que caen del otro lado del nodo de la intersección respecto de él.
 */
async function deriveBocaPieces(trx: Transaction<DB>): Promise<void> {
  await sql`
    CREATE TEMP TABLE _import_boca_pieces AS
    WITH far AS (
      SELECT j.junction_id, j.stem_tramo_id,
             point.x, point.y,
             (ST_X(ST_Transform(point.geom, 32719)) - ST_X(ST_Transform(j.geom, 32719)))
               * cos(arm.bearing)
             + (ST_Y(ST_Transform(point.geom, 32719)) - ST_Y(ST_Transform(j.geom, 32719)))
               * sin(arm.bearing) AS along
      FROM _import_junctions j
      JOIN _import_junction_arms arm
        ON arm.junction_id = j.junction_id AND arm.tramo_id = j.stem_tramo_id
      JOIN _import_corner_points point
        ON point.junction_id = j.junction_id AND point.kind = 'boca'
      WHERE j.kind = 'tee'
    )
    SELECT junction_id, stem_tramo_id,
           (array_agg(x ORDER BY along))[1] AS x1,
           (array_agg(y ORDER BY along))[1] AS y1,
           (array_agg(x ORDER BY along))[2] AS x2,
           (array_agg(y ORDER BY along))[2] AS y2,
           ST_SetSRID(ST_MakeLine(ST_MakePoint(x::float8, y::float8) ORDER BY along), 4326)
             AS geom
    FROM (
      SELECT DISTINCT junction_id, stem_tramo_id, x, y, along FROM far WHERE along < 0
    ) far
    GROUP BY junction_id, stem_tramo_id
    -- Sólo cuando el lado opuesto dio exactamente dos nodos: con uno no hay vereda que
    -- cerrar y con otra cantidad la geometría no es la T que describe docs/11.
    HAVING count(*) = 2
  `.execute(trx);
}

/**
 * Inserta los cordones de la corrida y devuelve cuántos se crearon.
 *
 * La clave es la coordenada normalizada a 7 decimales (docs/11 §4): un cordón que ya
 * existe no se toca, así que no hace falta `DO UPDATE` y el relevamiento queda intacto.
 */
async function insertKerbNodes(trx: Transaction<DB>): Promise<number> {
  const inserted = await sql<{ id: number }>`
    INSERT INTO kerb_nodes (geom)
    SELECT geom FROM _import_kerb_points
    ON CONFLICT ((round(ST_X(geom)::numeric, 7)), (round(ST_Y(geom)::numeric, 7)))
    DO NOTHING
    RETURNING id
  `.execute(trx);

  return inserted.rows.length;
}

/**
 * Junta en una sola tabla los puntos que son cordón: las esquinas, los nodos de la boca
 * de una T y los del borde del extracto.
 *
 * Se toman de los extremos de las aristas y no de las esquinas calculadas: **un nodo es
 * donde se conecta algo** (docs/11 §3.2), así que una esquina que no cayó sobre ninguna
 * línea no es un nodo sino un defecto del recorte, y se reporta en vez de quedar como
 * cordón suelto. Las coordenadas ya vienen normalizadas a 6 decimales del cálculo de las
 * esquinas, así que el par de cordones se resuelve por identidad exacta.
 */
async function collectKerbPoints(trx: Transaction<DB>): Promise<void> {
  await sql`
    CREATE TEMP TABLE _import_kerb_points AS
    SELECT DISTINCT x, y, ST_SetSRID(ST_MakePoint(x::float8, y::float8), 4326) AS geom
    FROM (
      SELECT start_x AS x, start_y AS y FROM _import_pieces
      UNION ALL
      SELECT end_x, end_y FROM _import_pieces
      UNION ALL
      SELECT x1, y1 FROM _import_boca_pieces
      UNION ALL
      SELECT x2, y2 FROM _import_boca_pieces
    ) endpoints
  `.execute(trx);
}

async function countKerbPoints(trx: Transaction<DB>): Promise<number> {
  const result = await sql<{ count: string }>`
    SELECT count(*) AS count FROM _import_kerb_points
  `.execute(trx);

  return Number(result.rows[0]?.count ?? 0);
}

/** Resuelve el id de cada punto: el de la fila que acaba de insertarse o el que ya estaba. */
async function mapKerbIds(trx: Transaction<DB>): Promise<void> {
  await sql`
    CREATE TEMP TABLE _import_kerbs AS
    SELECT point.x, point.y, kerb.id
    FROM _import_kerb_points point
    JOIN kerb_nodes kerb
      ON round(ST_X(kerb.geom)::numeric, 7) = point.x
     AND round(ST_Y(kerb.geom)::numeric, 7) = point.y
  `.execute(trx);
}

/**
 * El cordón de cada nodo, por el par de líneas que lo formó.
 *
 * Los cruces se arman por par de nodos y no por coordenada: el par es lo que dice cuáles
 * son los dos nodos que quedan enfrentados a cada lado de un brazo (docs/11 §3.7).
 */
async function mapCornerKerbIds(trx: Transaction<DB>): Promise<void> {
  await sql`
    CREATE TEMP TABLE _import_corner_kerbs AS
    SELECT point.plan_id, point.junction_id, point.geom, kerb.id
    FROM _import_corner_points point
    JOIN _import_kerbs kerb ON kerb.x = point.x AND kerb.y = point.y
  `.execute(trx);
}

/**
 * Corta cada línea en los nodos que caen sobre ella, más sus extremos de borde, y deja
 * un tramo por cada par de nodos consecutivos (docs/11 §3.3).
 *
 * El corte es por nodo y no por `way` ni por manzana: es la condición para que la
 * topología no quede desconectada en ese punto. Las coordenadas de los nodos viajan
 * junto con el corte para que el par de cordones se resuelva por identidad exacta y no
 * por una distancia.
 *
 * La mediana entra como una línea más: el corte en sus nodos es lo que la parte en el
 * lugar donde la cruza cada calle (docs/11 §3.6).
 */
async function derivePieces(trx: Transaction<DB>): Promise<void> {
  await sql`
    CREATE TEMP TABLE _import_cut_points AS
    WITH corner_lines AS (
      SELECT plan.plan_id, plan.line_a AS line_id FROM _import_node_plans plan
      UNION ALL
      SELECT plan.plan_id, plan.line_b FROM _import_node_plans plan
    ),
    corners AS (
      SELECT lines.line_id, point.x, point.y
      FROM corner_lines lines
      JOIN _import_corner_points point ON point.plan_id = lines.plan_id
      JOIN _import_lines line ON line.line_id = lines.line_id
      WHERE ST_DWithin(ST_Transform(point.geom, 32719), ST_Transform(line.geom, 32719), 1)
    ),
    ends AS (
      SELECT line_id,
             round(ST_X(geom)::numeric, 6) AS x,
             round(ST_Y(geom)::numeric, 6) AS y
      FROM _import_line_end_points
    )
    SELECT line_id, x, y FROM corners
    UNION
    SELECT line_id, x, y FROM ends
  `.execute(trx);

  await sql`
    CREATE TEMP TABLE _import_pieces AS
    WITH ordered AS (
      SELECT cut.line_id, cut.x, cut.y, cut.loc,
             LEAD(cut.x) OVER w AS next_x,
             LEAD(cut.y) OVER w AS next_y,
             LEAD(cut.loc) OVER w AS next_loc
      FROM (
        SELECT cut.line_id, cut.x, cut.y,
               ST_LineLocatePoint(line.geom,
                                  ST_SetSRID(ST_MakePoint(cut.x::float8, cut.y::float8), 4326))
                 AS loc
        FROM _import_cut_points cut
        JOIN _import_lines line ON line.line_id = cut.line_id
      ) cut
      WINDOW w AS (PARTITION BY cut.line_id ORDER BY cut.loc, cut.x, cut.y)
    )
    SELECT ordered.line_id,
           ordered.x AS start_x, ordered.y AS start_y,
           ordered.next_x AS end_x, ordered.next_y AS end_y,
           ST_LineSubstring(line.geom, ordered.loc, ordered.next_loc) AS geom
    FROM ordered
    JOIN _import_lines line ON line.line_id = ordered.line_id
    WHERE ordered.next_loc IS NOT NULL AND ordered.next_loc > ordered.loc
  `.execute(trx);
}

/**
 * Separa las piezas de mediana que atraviesan una calzada (docs/11 §3.6).
 *
 * La mediana se corta a los dos lados de cada calle que la cruza, así que la pieza que
 * queda entre esos dos nodos es asfalto: se camina sobre la calzada de la transversal. Esa
 * pieza **es un cruce**, no una vereda de la avenida, y se reconoce por geometría: la
 * pieza cruza el eje de otra calle. La vereda de la mediana —la que corre entre dos
 * calles— no cruza ningún eje, y una vereda común tampoco.
 */
async function classifyMedianPieces(trx: Transaction<DB>): Promise<void> {
  await sql`
    CREATE TEMP TABLE _import_median_crossings AS
    SELECT piece.line_id, piece.start_x, piece.start_y, piece.end_x, piece.end_y, piece.geom
    FROM _import_pieces piece
    JOIN _import_lines line ON line.line_id = piece.line_id
    WHERE line.kind = 'median'
      AND EXISTS (
        SELECT 1
        FROM _import_tramos tramo
        WHERE ST_Intersects(piece.geom, tramo.geom)
          AND NOT EXISTS (
            SELECT 1
            FROM _import_tramo_ways tramo_way
            JOIN _import_boulevard_ways boulevard_way
              ON boulevard_way.way_id = tramo_way.way_id
             AND boulevard_way.boulevard_id = line.boulevard_id
            WHERE tramo_way.tramo_id = tramo.tramo_id
          )
      )
  `.execute(trx);
}

/**
 * Arma las filas de `sidewalks`: el par de cordones, la `way` que contiene el punto
 * medio y el nombre de la calle del tramo (docs/11 §2.2).
 *
 * A la vereda de la boca de una T le toca la calle que pasa, no el brazo que termina:
 * es la vereda del lado opuesto, así que su `osm_way_id` y su `street_name` salen de la
 * vía más cercana de los otros brazos de la intersección.
 *
 * La mediana es una vereda más, con el nombre de la avenida y `osm_way_id` en `NULL`
 * porque sale de dos `way` (docs/11 §3.6). Las piezas de mediana que atraviesan una
 * calzada no entran acá: ésas son cruces.
 */
async function deriveSidewalkRows(trx: Transaction<DB>): Promise<void> {
  await sql`
    CREATE TEMP TABLE _import_sidewalk_rows AS
    SELECT DISTINCT ON (least(start_kerb, end_kerb), greatest(start_kerb, end_kerb))
           start_kerb, end_kerb, osm_way_id, street_name, geom, is_boca
    FROM (
      SELECT start_kerb.id AS start_kerb,
             end_kerb.id AS end_kerb,
             CASE WHEN line.kind = 'median' THEN NULL ELSE way.way_id END AS osm_way_id,
             line.street_name AS street_name,
             piece.geom AS geom,
             false AS is_boca
      FROM _import_pieces piece
      JOIN _import_lines line ON line.line_id = piece.line_id
      JOIN _import_kerbs start_kerb ON start_kerb.x = piece.start_x AND start_kerb.y = piece.start_y
      JOIN _import_kerbs end_kerb ON end_kerb.x = piece.end_x AND end_kerb.y = piece.end_y
      LEFT JOIN LATERAL (
        SELECT candidate.way_id
        FROM _import_tramo_ways tramo_way
        JOIN _import_ways candidate ON candidate.way_id = tramo_way.way_id
        WHERE tramo_way.tramo_id = line.tramo_id
        ORDER BY ST_Distance(candidate.geom, ST_LineInterpolatePoint(piece.geom, 0.5)),
                 tramo_way.ord
        LIMIT 1
      ) way ON line.kind <> 'median'
      WHERE NOT EXISTS (
        SELECT 1 FROM _import_median_crossings crossing
        WHERE crossing.line_id = piece.line_id
          AND crossing.start_x = piece.start_x AND crossing.start_y = piece.start_y
          AND crossing.end_x = piece.end_x AND crossing.end_y = piece.end_y
      )

      UNION ALL

      SELECT start_kerb.id, end_kerb.id, way.way_id, way.street_name, boca.geom, true
      FROM _import_boca_pieces boca
      JOIN _import_kerbs start_kerb ON start_kerb.x = boca.x1 AND start_kerb.y = boca.y1
      JOIN _import_kerbs end_kerb ON end_kerb.x = boca.x2 AND end_kerb.y = boca.y2
      CROSS JOIN LATERAL (
        SELECT candidate.way_id, candidate.street_name
        FROM _import_junction_arms arm
        JOIN _import_tramo_ways tramo_way ON tramo_way.tramo_id = arm.tramo_id
        JOIN _import_ways candidate ON candidate.way_id = tramo_way.way_id
        WHERE arm.junction_id = boca.junction_id
          AND arm.tramo_id <> boca.stem_tramo_id
        ORDER BY ST_Distance(candidate.geom, ST_LineInterpolatePoint(boca.geom, 0.5)),
                 arm.tramo_id, tramo_way.ord
        LIMIT 1
      ) way
    ) rows
    ORDER BY least(start_kerb, end_kerb), greatest(start_kerb, end_kerb), ST_Length(geom) DESC
  `.execute(trx);
}

/**
 * Escribe las veredas con upsert por par de nodos en orden canónico (docs/11 §4).
 *
 * El `DO UPDATE` sólo toca lo que el importador deriva. `accessibility_level` y
 * `is_verified` no aparecen: una segunda corrida no puede borrar el relevamiento.
 * `xmax = 0` distingue en el mismo `RETURNING` las filas creadas de las actualizadas.
 */
async function upsertSidewalks(
  trx: Transaction<DB>,
): Promise<{ created: number; updated: number }> {
  const result = await sql<{ created: string; updated: string }>`
    WITH written AS (
      INSERT INTO sidewalks (start_node_id, end_node_id, osm_way_id, street_name, geom)
      SELECT start_kerb, end_kerb, osm_way_id, street_name, geom
      FROM _import_sidewalk_rows
      ON CONFLICT ((least(start_node_id, end_node_id)), (greatest(start_node_id, end_node_id)))
      DO UPDATE SET geom = EXCLUDED.geom,
                    osm_way_id = EXCLUDED.osm_way_id,
                    street_name = EXCLUDED.street_name
      RETURNING (xmax = 0) AS inserted
    )
    SELECT count(*) FILTER (WHERE inserted) AS created,
           count(*) FILTER (WHERE NOT inserted) AS updated
    FROM written
  `.execute(trx);

  return {
    created: Number(result.rows[0]?.created ?? 0),
    updated: Number(result.rows[0]?.updated ?? 0),
  };
}

async function countBocaSidewalks(trx: Transaction<DB>): Promise<number> {
  const result = await sql<{ count: string }>`
    SELECT count(*) AS count FROM _import_sidewalk_rows WHERE is_boca
  `.execute(trx);

  return Number(result.rows[0]?.count ?? 0);
}

/**
 * Las T que no derivaron la vereda de la boca.
 *
 * La boca se arma cuando el lado opuesto al brazo que termina da exactamente dos nodos,
 * y eso pasa cuando el brazo tiene dos líneas exteriores. Una T cuyo brazo es una
 * peatonal o una calzada suelta tiene una sola: ahí no hay boca y no es un defecto
 * (docs/11 §3.2).
 */
async function findTeesWithoutBoca(trx: Transaction<DB>): Promise<number[]> {
  const result = await sql<{ osm_node_id: string }>`
    SELECT j.osm_node_id
    FROM _import_junctions j
    JOIN _import_junction_arms stem
      ON stem.junction_id = j.junction_id AND stem.tramo_id = j.stem_tramo_id
    WHERE j.kind = 'tee'
      AND stem.line_count >= 2
      AND NOT EXISTS (
        SELECT 1 FROM _import_boca_pieces boca WHERE boca.junction_id = j.junction_id
      )
    ORDER BY j.osm_node_id
  `.execute(trx);

  return result.rows.map((row) => Number(row.osm_node_id));
}

/**
 * Deriva los cruces (docs/11 §3.6 y §3.7).
 *
 * Salen de dos lados. Uno: la recta entre los dos nodos que flanquean un brazo, que el
 * plan ya parte una vez por calzada atravesada —el boulevard da dos, uno por calzada, con
 * el nodo de mediana en el medio—. Dos: las piezas de mediana que atraviesan la calzada de
 * una transversal, que son asfalto y no vereda.
 *
 * La geometría es la recta entre los dos nodos y nada más, así que su largo sale de los
 * offsets de la calle cruzada: no hay un ancho de calzada que inventar por separado. Si a
 * una intersección le falta un nodo, ese brazo no tiene cruce y el reporte lo dice en vez
 * de cruzar el brazo con el nodo que encontró.
 */
async function deriveCrossings(
  trx: Transaction<DB>,
): Promise<{ rows: number; medianCrossings: number }> {
  await sql`
    CREATE TEMP TABLE _import_crossing_rows AS
    SELECT DISTINCT ON (least(start_kerb, end_kerb), greatest(start_kerb, end_kerb))
           junction_id, start_kerb, end_kerb, geom
    FROM (
      SELECT plan.junction_id,
             first.id AS start_kerb,
             second.id AS end_kerb,
             ST_MakeLine(first.geom, second.geom) AS geom
      FROM _import_crossing_plans plan
      JOIN _import_corner_kerbs first ON first.plan_id = plan.node_a
      JOIN _import_corner_kerbs second ON second.plan_id = plan.node_b
      WHERE first.id <> second.id

      UNION ALL

      SELECT NULL::integer,
             start_kerb.id,
             end_kerb.id,
             crossing.geom
      FROM _import_median_crossings crossing
      JOIN _import_kerbs start_kerb
        ON start_kerb.x = crossing.start_x AND start_kerb.y = crossing.start_y
      JOIN _import_kerbs end_kerb
        ON end_kerb.x = crossing.end_x AND end_kerb.y = crossing.end_y
      WHERE start_kerb.id <> end_kerb.id
    ) crossing
    ORDER BY least(start_kerb, end_kerb), greatest(start_kerb, end_kerb), geom::text
  `.execute(trx);

  const result = await sql<{ rows: string; median_crossings: string }>`
    SELECT count(*) AS rows,
           count(*) FILTER (WHERE junction_id IS NULL) AS median_crossings
    FROM _import_crossing_rows
  `.execute(trx);

  return {
    rows: Number(result.rows[0]?.rows ?? 0),
    medianCrossings: Number(result.rows[0]?.median_crossings ?? 0),
  };
}

/**
 * Escribe los cruces con upsert por par de nodos en orden canónico (docs/11 §4).
 *
 * `accessibility_level` no aparece en la lista de columnas: el nivel de un cruce se
 * deriva del peor de sus dos esquinas al rutear ([12 §3](12-relevamiento-de-accesibilidad.md))
 * y el importador no inventa ninguno. `is_verified` queda en su valor de import.
 */
async function upsertCrossings(
  trx: Transaction<DB>,
): Promise<{ created: number; updated: number; medianCrossings: number }> {
  const { medianCrossings } = await deriveCrossings(trx);

  const result = await sql<{ created: string; updated: string }>`
    WITH written AS (
      INSERT INTO crossings (start_node_id, end_node_id, geom)
      SELECT start_kerb, end_kerb, geom
      FROM _import_crossing_rows
      ON CONFLICT ((least(start_node_id, end_node_id)), (greatest(start_node_id, end_node_id)))
      DO UPDATE SET geom = EXCLUDED.geom
      RETURNING (xmax = 0) AS inserted
    )
    SELECT count(*) FILTER (WHERE inserted) AS created,
           count(*) FILTER (WHERE NOT inserted) AS updated
    FROM written
  `.execute(trx);

  return {
    created: Number(result.rows[0]?.created ?? 0),
    updated: Number(result.rows[0]?.updated ?? 0),
    medianCrossings,
  };
}

/**
 * La forma de cada intersección derivada: brazos, líneas por brazo, nodos y cruces.
 *
 * No hay una cuenta fija que cerrar. Un cruce de cuatro brazos tiene 4 nodos y 4 cruces;
 * una T de dos líneas, 4 y 3; una T de una línea, 2 y 1; y el boulevard suma el nodo de
 * mediana y parte el cruce en dos (docs/11 §3.2, §3.6 y §3.7). Por eso el reporte muestra
 * la forma —es lo que permite auditar una esquina rara a ojo— y las advertencias quedan
 * para lo que no puede cerrar de ninguna manera.
 */
async function reportJunctions(trx: Transaction<DB>): Promise<JunctionReport[]> {
  const result = await sql<{
    osm_node_id: string;
    kind: string;
    arms: string;
    arm_lines: number[];
    nodes: string;
    crossings: string;
  }>`
    SELECT junction.osm_node_id, junction.kind,
           (SELECT count(*) FROM _import_junction_arms arm
             WHERE arm.junction_id = junction.junction_id) AS arms,
           (SELECT array_agg(arm.line_count ORDER BY arm.bearing)
              FROM _import_junction_arms arm
             WHERE arm.junction_id = junction.junction_id) AS arm_lines,
           (SELECT count(*) FROM _import_corner_points point
             WHERE point.junction_id = junction.junction_id) AS nodes,
           (SELECT count(*) FROM _import_crossing_rows crossing
             WHERE crossing.junction_id = junction.junction_id) AS crossings
    FROM _import_junctions junction
    ORDER BY junction.osm_node_id
  `.execute(trx);

  return result.rows.map((row) => ({
    osmNodeId: Number(row.osm_node_id),
    kind: row.kind === 'tee' ? 'tee' : 'cross',
    arms: Number(row.arms),
    armLines: row.arm_lines.map((count) => Number(count)),
    nodes: Number(row.nodes),
    crossings: Number(row.crossings),
  }));
}

/**
 * Las medianas que no produjeron ninguna arista.
 *
 * Una mediana sin dos nodos no se puede caminar: no hay par de cordones que unir. Puede
 * pasar si la calle nunca la cruza, y entonces el reporte lo dice en vez de dejar la
 * avenida sin su franja central.
 */
async function findMediansWithoutPieces(trx: Transaction<DB>): Promise<number[]> {
  const result = await sql<{ boulevard_id: number }>`
    SELECT boulevard.boulevard_id
    FROM _import_boulevards boulevard
    WHERE NOT EXISTS (
      SELECT 1 FROM _import_pieces piece WHERE piece.line_id = boulevard.median_line_id
    )
    ORDER BY boulevard.boulevard_id
  `.execute(trx);

  return result.rows.map((row) => Number(row.boulevard_id));
}

/**
 * Los tramos con alguna línea que no produjo ninguna vereda.
 *
 * Pasa cuando los cortes de la línea —la esquina de cada punta y los extremos de borde—
 * no caen sobre ella: la línea queda sin par de nodos y no hay arista que insertar. Es un
 * error de corte y se reporta como tal, en vez de dejar la calle afuera del grafo sin
 * decirlo (docs/11 §4).
 */
async function findLinesWithoutSidewalk(
  trx: Transaction<DB>,
): Promise<{ tramoId: number; streetName: string | null }[]> {
  const result = await sql<{ tramo_id: number; street_name: string | null }>`
    SELECT line.tramo_id, max(tramo.street_name) AS street_name
    FROM _import_lines line
    JOIN _import_tramos tramo ON tramo.tramo_id = line.tramo_id
    WHERE NOT EXISTS (
      SELECT 1 FROM _import_pieces piece WHERE piece.line_id = line.line_id
    )
    GROUP BY line.tramo_id
    ORDER BY line.tramo_id
  `.execute(trx);

  return result.rows.map((row) => ({
    tramoId: Number(row.tramo_id),
    streetName: row.street_name,
  }));
}

/**
 * Los pares de vías que se cruzan en el mapa sin compartir un nodo de OSM (docs/11 §3.2).
 *
 * Es un diagnóstico y no parte del grafo: una imperfección del extracto se ve acá y no
 * como dos calles que se tocan en el mapa y no en el grafo. El umbral de 2 m absorbe el
 * error de dibujo de OSM sin juntar dos calles que pasan cerca, y no se inventa el nodo
 * que falta.
 */
async function findUnsharedCrossings(
  trx: Transaction<DB>,
): Promise<readonly (readonly [number, number])[]> {
  const result = await sql<{ way_a: string; way_b: string }>`
    SELECT first.way_id AS way_a, second.way_id AS way_b
    FROM _import_ways first
    JOIN _import_ways second ON second.way_id > first.way_id
    WHERE ST_DWithin(ST_Transform(first.geom, 32719),
                     ST_Transform(second.geom, 32719), 2)
      AND NOT EXISTS (
        SELECT 1
        FROM _import_way_nodes first_node
        JOIN _import_way_nodes second_node
          ON second_node.osm_node_id = first_node.osm_node_id
        WHERE first_node.way_id = first.way_id
          AND second_node.way_id = second.way_id
      )
    ORDER BY first.way_id, second.way_id
  `.execute(trx);

  return result.rows.map((row) => [Number(row.way_a), Number(row.way_b)] as const);
}
