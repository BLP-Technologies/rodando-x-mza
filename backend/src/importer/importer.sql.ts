import { sql, type Transaction } from 'kysely';
import type { DB } from '../db/types.js';
import type { CornerPlan, CrossingPlan, Junction, Tramo } from './importer.service.js';
import type { OsmNode, OsmWay } from './osm.reader.js';

/**
 * La capa SQL del importador: convierte los tramos y las intersecciones que derivó
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

/** Un tramo con el offset que le toca por su clase o por `lanes` (docs/11 §3.4). */
export type PlannedTramo = Tramo & { offsetM: number };

export type GraphInput = {
  /** Todos los nodos del extracto: son los vértices de las geometrías. */
  nodes: readonly OsmNode[];
  /** Las vías que entran a la grilla, ya sin las que quedaron fuera. */
  ways: readonly OsmWay[];
  tramos: readonly PlannedTramo[];
  junctions: readonly Junction[];
  /** Las esquinas y las bocas, dos líneas cada una (docs/11 §3.2). */
  corners: readonly CornerPlan[];
  /** Un cruce por brazo (docs/11 §3.7). */
  crossings: readonly CrossingPlan[];
};

/**
 * Lo que el reporte dice de cada intersección derivada.
 */
export type JunctionReport = {
  osmNodeId: number;
  kind: 'cross' | 'tee';
  arms: number;
  /** Esquinas más nodos de la boca: cuatro siempre (docs/11 §3.2). */
  corners: number;
  crossings: number;
  /** Brazos que aportan una sola línea (las peatonales): no llevan cruce sobre sí. */
  singleLineArms: number;
};

export type GraphCounts = {
  /** Cordones que la corrida creó; los que ya existían por coordenada se reusan. */
  kerbsCreated: number;
  kerbsReused: number;
  sidewalksCreated: number;
  sidewalksUpdated: number;
  crossingsCreated: number;
  crossingsUpdated: number;
  /** Líneas de `ST_OffsetCurve` que volvieron `MultiLineString` y se recortaron. */
  linesSplit: number;
  /** Líneas que volvieron `NULL`: el offset no entraba en la curva del eje. */
  linesDropped: number;
  /** Veredas de la boca de una T, que no caen sobre la línea de ningún tramo. */
  bocaSidewalks: number;
  /** T que no derivaron su vereda de la boca: el lado opuesto no dio dos esquinas. */
  bocaMissingNodeIds: readonly number[];
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
  await deriveCorners(trx);
  await deriveLineEnds(trx);
  await deriveBocaPieces(trx);
  await derivePieces(trx);

  await collectKerbPoints(trx);
  const kerbsCreated = await insertKerbNodes(trx);
  const kerbsTotal = await countKerbPoints(trx);
  await mapKerbIds(trx);
  await mapCornerKerbIds(trx);

  await deriveSidewalkRows(trx);
  const { created, updated } = await upsertSidewalks(trx);

  await deriveCrossings(trx);
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
  const { nodes, ways, tramos, junctions, corners, crossings } = input;
  const nodesById = new Map(nodes.map((node) => [node.id, node]));

  // Una corrida anterior en la misma sesión dejaría sus tablas temporales: se descartan
  // antes de empezar (el test de integración corre el importador dos veces seguidas).
  await sql`
    DROP TABLE IF EXISTS
      _import_nodes, _import_way_nodes, _import_ways, _import_tramo_nodes,
      _import_tramos, _import_tramo_ways, _import_junctions, _import_junction_arms,
      _import_corner_pairs, _import_crossing_pairs, _import_lines_raw, _import_lines,
      _import_corner_points, _import_line_end_points, _import_boca_pieces,
      _import_kerb_points, _import_kerbs, _import_corner_kerbs, _import_cut_points,
      _import_pieces, _import_sidewalk_rows, _import_crossing_rows
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

  // Sólo las intersecciones que se derivan: las que no se soportan se reportan y no
  // generan ni esquinas ni cortes, así que sus tramos quedan con extremos sueltos.
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

  await sql`
    CREATE TEMP TABLE _import_junction_arms (
      junction_id integer NOT NULL,
      tramo_id integer NOT NULL,
      at_start boolean NOT NULL,
      bearing float8 NOT NULL
    ) ON COMMIT DROP
  `.execute(trx);

  await sql`
    INSERT INTO _import_junction_arms (junction_id, tramo_id, at_start, bearing)
    SELECT arms.junction_id, arms.tramo_id, arms.at_start, arms.bearing
    FROM unnest(
      ${derived.flatMap(({ junction, junctionId }) =>
        junction.arms.map(() => junctionId),
      )}::int[],
      ${derived.flatMap(({ junction }) => junction.arms.map((arm) => arm.tramoId))}::int[],
      ${derived.flatMap(({ junction }) => junction.arms.map((arm) => arm.atStart))}::boolean[],
      ${derived.flatMap(({ junction }) => junction.arms.map((arm) => arm.bearing))}::float8[]
    ) AS arms(junction_id, tramo_id, at_start, bearing)
  `.execute(trx);

  await sql`
    CREATE TEMP TABLE _import_corner_pairs (
      pair_id integer PRIMARY KEY,
      junction_id integer NOT NULL,
      kind text NOT NULL,
      tramo_a integer NOT NULL,
      side_a integer NOT NULL,
      tramo_b integer NOT NULL,
      side_b integer NOT NULL
    ) ON COMMIT DROP
  `.execute(trx);

  await sql`
    INSERT INTO _import_corner_pairs (
      pair_id, junction_id, kind, tramo_a, side_a, tramo_b, side_b)
    SELECT pair.pair_id, pair.junction_id, pair.kind,
           pair.tramo_a, pair.side_a, pair.tramo_b, pair.side_b
    FROM unnest(
      ${corners.map((_, pairId) => pairId)}::int[],
      ${corners.map((corner) => corner.junctionId)}::int[],
      ${corners.map((corner) => corner.kind)}::text[],
      ${corners.map((corner) => corner.first.tramoId)}::int[],
      ${corners.map((corner) => corner.first.side)}::int[],
      ${corners.map((corner) => corner.second.tramoId)}::int[],
      ${corners.map((corner) => corner.second.side)}::int[]
    ) AS pair(pair_id, junction_id, kind, tramo_a, side_a, tramo_b, side_b)
  `.execute(trx);

  await sql`
    CREATE TEMP TABLE _import_crossing_pairs (
      junction_id integer NOT NULL,
      tramo_id integer NOT NULL,
      pair_a integer NOT NULL,
      pair_b integer NOT NULL
    ) ON COMMIT DROP
  `.execute(trx);

  await sql`
    INSERT INTO _import_crossing_pairs (junction_id, tramo_id, pair_a, pair_b)
    SELECT crossing.junction_id, crossing.tramo_id, crossing.pair_a, crossing.pair_b
    FROM unnest(
      ${crossings.map((crossing) => crossing.junctionId)}::int[],
      ${crossings.map((crossing) => crossing.tramoId)}::int[],
      ${crossings.map((crossing) => crossing.cornerIds[0])}::int[],
      ${crossings.map((crossing) => crossing.cornerIds[1])}::int[]
    ) AS crossing(junction_id, tramo_id, pair_a, pair_b)
  `.execute(trx);
}

/**
 * Corre las dos líneas de cada tramo con `ST_OffsetCurve` sobre EPSG 32719 y las
 * devuelve a 4326 (docs/11 §3.4).
 *
 * La distancia va con signo: el positivo corre a la izquierda del sentido del tramo y
 * el negativo a la derecha. La línea se reorienta al final para que su comienzo sea el
 * comienzo del tramo, porque `ST_OffsetCurve` con distancia negativa la devuelve al
 * revés y todo lo que viene después depende de saber cuál extremo es cuál.
 *
 * Los dos defectos conocidos de `ST_OffsetCurve` se resuelven acá y se cuentan: un
 * `MultiLineString` (la línea se cruza consigo misma) se recorta a su pieza más larga
 * y un `NULL` (el offset no entra en la curva) descarta la línea.
 *
 * Un tramo peatonal llega con offset 0 —no hay calzada, se camina en todo el ancho— y
 * `ST_OffsetCurve` con distancia 0 devuelve la línea tal cual: las dos líneas del
 * tramo coinciden sobre el eje, que es lo que §3.5 pide. Que no queden dos aristas
 * encima lo resuelve el recorte por par de cordones de `deriveSidewalkRows`.
 *
 * Devuelve cuántas líneas hubo que recortar por haber vuelto `MultiLineString`.
 */
async function deriveLines(trx: Transaction<DB>): Promise<number> {
  await sql`
    CREATE TEMP TABLE _import_lines_raw (
      tramo_id integer NOT NULL,
      side integer NOT NULL,
      offset_m float8 NOT NULL,
      geom_32719 geometry
    ) ON COMMIT DROP
  `.execute(trx);

  await sql`
    INSERT INTO _import_lines_raw (tramo_id, side, offset_m, geom_32719)
    SELECT t.tramo_id, side.value, t.offset_m,
           ST_OffsetCurve(ST_Transform(t.geom, 32719), side.value * t.offset_m)
    FROM _import_tramos t
    CROSS JOIN (VALUES (1), (-1)) AS side(value)
  `.execute(trx);

  await sql`
    CREATE TEMP TABLE _import_lines (
      line_id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      tramo_id integer NOT NULL,
      side integer NOT NULL,
      offset_m float8 NOT NULL,
      geom geometry(LineString, 4326) NOT NULL
    ) ON COMMIT DROP
  `.execute(trx);

  await sql`
    INSERT INTO _import_lines (tramo_id, side, offset_m, geom)
    SELECT DISTINCT ON (raw.tramo_id, raw.side)
           raw.tramo_id, raw.side, raw.offset_m,
           CASE
             WHEN ST_Distance(ST_StartPoint(piece.geom_4326), ST_StartPoint(tramo.geom))
                  <= ST_Distance(ST_EndPoint(piece.geom_4326), ST_StartPoint(tramo.geom))
             THEN piece.geom_4326
             ELSE ST_Reverse(piece.geom_4326)
           END
    FROM _import_lines_raw raw
    JOIN _import_tramos tramo ON tramo.tramo_id = raw.tramo_id
    CROSS JOIN LATERAL (
      SELECT ST_Transform(dumped.geom, 4326) AS geom_4326,
             ST_Length(dumped.geom) AS length_32719
      FROM ST_Dump(raw.geom_32719) AS dumped
    ) piece
    ORDER BY raw.tramo_id, raw.side, piece.length_32719 DESC
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
 * Calcula las esquinas de cada intersección (docs/11 §3.2).
 *
 * Cada esquina la define un par de brazos y una línea de cada uno: la que mira hacia el
 * otro brazo. Esas dos líneas se cruzan exactamente ahí, así que la regla no necesita
 * tolerancias para tirar puntos sobrantes: no hay puntos sobrantes.
 *
 * Las líneas se prolongan con `ST_LineExtend` porque en la boca de una T el nodo queda
 * fuera de los dos segmentos: la línea del brazo que termina muere en el eje de la calle
 * que pasa y la vereda de enfrente está del otro lado. El alcance de la prolongación va
 * con el offset, así que se descarta el punto que aparezca más lejos que eso.
 *
 * El punto se redondea a 6 decimales (~10 cm) y ese es el número con el que después se
 * corta la línea y se busca el cordón: las tres cosas usan la misma coordenada.
 */
async function deriveCorners(trx: Transaction<DB>): Promise<void> {
  await sql`
    CREATE TEMP TABLE _import_corner_points AS
    SELECT pair.pair_id, pair.junction_id, pair.kind,
           round(ST_X(ST_Transform(found.intersection, 4326))::numeric, 6) AS x,
           round(ST_Y(ST_Transform(found.intersection, 4326))::numeric, 6) AS y,
           ST_SetSRID(
             ST_MakePoint(
               round(ST_X(ST_Transform(found.intersection, 4326))::numeric, 6)::float8,
               round(ST_Y(ST_Transform(found.intersection, 4326))::numeric, 6)::float8),
             4326) AS geom
    FROM _import_corner_pairs pair
    JOIN _import_junctions junction ON junction.junction_id = pair.junction_id
    JOIN _import_lines first ON first.tramo_id = pair.tramo_a AND first.side = pair.side_a
    JOIN _import_lines second ON second.tramo_id = pair.tramo_b AND second.side = pair.side_b
    CROSS JOIN LATERAL (
      SELECT 3 * GREATEST(first.offset_m, second.offset_m) AS reach,
             ST_Transform(junction.geom, 32719) AS node_32719
    ) extent
    CROSS JOIN LATERAL (
      SELECT ST_Intersection(
               ST_LineExtend(ST_Transform(first.geom, 32719), extent.reach, extent.reach),
               ST_LineExtend(ST_Transform(second.geom, 32719), extent.reach, extent.reach)
             ) AS intersection
    ) found
    WHERE ST_GeometryType(found.intersection) = 'ST_Point'
      AND NOT ST_IsEmpty(found.intersection)
      AND ST_Distance(found.intersection, extent.node_32719) < extent.reach
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
 * prolongar las dos líneas del brazo. Entre esos dos nodos va esta vereda. No está
 * sobre la línea de ningún tramo —cada línea termina en el centro de la intersección—
 * así que se construye aparte; es lo que cierra el grafo de la T.
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
      JOIN _import_corner_points point ON point.junction_id = j.junction_id
      WHERE j.kind = 'tee'
    )
    SELECT junction_id, stem_tramo_id,
           (array_agg(x ORDER BY along))[1] AS x1,
           (array_agg(y ORDER BY along))[1] AS y1,
           (array_agg(x ORDER BY along))[2] AS x2,
           (array_agg(y ORDER BY along))[2] AS y2,
           ST_SetSRID(ST_MakeLine(ST_MakePoint(x::float8, y::float8) ORDER BY along), 4326)
             AS geom
    FROM far
    WHERE along < 0
    GROUP BY junction_id, stem_tramo_id
    -- Sólo cuando la regla de las esquinas dio exactamente dos del lado opuesto: con
    -- otra cantidad la geometría no es la T que describe docs/11 y no se inventa. Y los
    -- dos tienen que ser puntos distintos: si el brazo que termina es una peatonal, que
    -- aporta una sola línea, sus dos nodos caen en el mismo punto del eje de la calle
    -- que pasa y no hay vereda que tender entre ellos (docs/11 §3.5).
    HAVING count(*) = 2 AND count(DISTINCT (x, y)) = 2
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
 * El cordón de cada esquina, por el par de líneas que la formó.
 *
 * Los cruces se arman por par de esquinas y no por coordenada: el par es lo que dice
 * cuáles son los dos nodos que quedan enfrentados a cada lado de un brazo (docs/11 §3.7).
 */
async function mapCornerKerbIds(trx: Transaction<DB>): Promise<void> {
  await sql`
    CREATE TEMP TABLE _import_corner_kerbs AS
    SELECT point.pair_id, point.junction_id, point.geom, kerb.id
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
 */
async function derivePieces(trx: Transaction<DB>): Promise<void> {
  await sql`
    CREATE TEMP TABLE _import_cut_points AS
    WITH corners AS (
      SELECT line.line_id, point.x, point.y
      FROM _import_lines line
      JOIN _import_junction_arms arm ON arm.tramo_id = line.tramo_id
      JOIN _import_corner_points point ON point.junction_id = arm.junction_id
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
           line.tramo_id,
           ordered.x AS start_x, ordered.y AS start_y,
           ordered.next_x AS end_x, ordered.next_y AS end_y,
           ST_LineSubstring(line.geom, ordered.loc, ordered.next_loc) AS geom
    FROM ordered
    JOIN _import_lines line ON line.line_id = ordered.line_id
    WHERE ordered.next_loc IS NOT NULL AND ordered.next_loc > ordered.loc
  `.execute(trx);
}

/**
 * Arma las filas de `sidewalks`: el par de cordones, la `way` que contiene el punto
 * medio y el nombre de la calle del tramo (docs/11 §2.2).
 *
 * A la vereda de la boca de una T le toca la calle que pasa, no el brazo que termina:
 * es la vereda del lado opuesto, así que su `osm_way_id` y su `street_name` salen de la
 * vía más cercana de los otros brazos de la intersección.
 */
async function deriveSidewalkRows(trx: Transaction<DB>): Promise<void> {
  await sql`
    CREATE TEMP TABLE _import_sidewalk_rows AS
    SELECT DISTINCT ON (least(start_kerb, end_kerb), greatest(start_kerb, end_kerb))
           start_kerb, end_kerb, osm_way_id, street_name, geom, is_boca
    FROM (
      SELECT start_kerb.id AS start_kerb,
             end_kerb.id AS end_kerb,
             way.way_id AS osm_way_id,
             tramo.street_name AS street_name,
             piece.geom AS geom,
             false AS is_boca
      FROM _import_pieces piece
      JOIN _import_tramos tramo ON tramo.tramo_id = piece.tramo_id
      JOIN _import_kerbs start_kerb ON start_kerb.x = piece.start_x AND start_kerb.y = piece.start_y
      JOIN _import_kerbs end_kerb ON end_kerb.x = piece.end_x AND end_kerb.y = piece.end_y
      CROSS JOIN LATERAL (
        SELECT candidate.way_id
        FROM _import_tramo_ways tramo_way
        JOIN _import_ways candidate ON candidate.way_id = tramo_way.way_id
        WHERE tramo_way.tramo_id = piece.tramo_id
        ORDER BY ST_Distance(candidate.geom, ST_LineInterpolatePoint(piece.geom, 0.5)),
                 tramo_way.ord
        LIMIT 1
      ) way

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
 * La boca se arma cuando la regla de las esquinas deja exactamente dos nodos del lado
 * opuesto. Cuando no, la geometría no es la T de docs/11 §3.2 —por ejemplo, la calle que
 * pasa cambia de ancho en el nodo y el lado opuesto tiene cuatro— y se reporta en vez de
 * inventar un cierre que el modelo no define.
 *
 * La T cuyo brazo que termina es una peatonal no entra: ese brazo aporta una sola línea,
 * así que los dos nodos del lado opuesto caen en el mismo punto y no hay vereda de la
 * boca que tender (docs/11 §3.5).
 */
async function findTeesWithoutBoca(trx: Transaction<DB>): Promise<number[]> {
  const result = await sql<{ osm_node_id: string }>`
    SELECT j.osm_node_id
    FROM _import_junctions j
    JOIN _import_tramos stem ON stem.tramo_id = j.stem_tramo_id
    WHERE j.kind = 'tee'
      AND stem.offset_m <> 0
      AND NOT EXISTS (
        SELECT 1 FROM _import_boca_pieces boca WHERE boca.junction_id = j.junction_id
      )
    ORDER BY j.osm_node_id
  `.execute(trx);

  return result.rows.map((row) => Number(row.osm_node_id));
}

/**
 * Deriva los cruces: uno por brazo, la recta entre las dos esquinas que lo flanquean
 * (docs/11 §3.7).
 *
 * La geometría es la recta entre los dos nodos y nada más, así que su largo sale de los
 * offsets de la calle cruzada: no hay un ancho de calzada que inventar por separado. Si
 * a una intersección le falta una esquina, ese brazo no tiene cruce y el reporte lo dice
 * en vez de cruzar el brazo con el nodo que encontró.
 */
async function deriveCrossings(trx: Transaction<DB>): Promise<void> {
  await sql`
    CREATE TEMP TABLE _import_crossing_rows AS
    SELECT DISTINCT ON (least(start_kerb, end_kerb), greatest(start_kerb, end_kerb))
           crossing.junction_id, start_kerb, end_kerb, geom
    FROM (
      SELECT pair.junction_id,
             first.id AS start_kerb,
             second.id AS end_kerb,
             ST_MakeLine(first.geom, second.geom) AS geom
      FROM _import_crossing_pairs pair
      JOIN _import_corner_kerbs first ON first.pair_id = pair.pair_a
      JOIN _import_corner_kerbs second ON second.pair_id = pair.pair_b
      WHERE first.id <> second.id
    ) crossing
    ORDER BY least(start_kerb, end_kerb), greatest(start_kerb, end_kerb), junction_id
  `.execute(trx);
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
): Promise<{ created: number; updated: number }> {
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
  };
}

/**
 * Lo que el reporte compara de cada intersección derivada: brazos, esquinas y cruces.
 *
 * Las dos cuentas que tienen que cerrar son cuatro nodos por intersección —dos esquinas
 * y dos de la boca, cuando es una T— y un cruce por brazo (docs/11 §3.2 y §3.7).
 *
 * Se cuentan aparte los brazos de una sola línea —las peatonales—: el brazo peatonal no
 * tiene calzada que cruzar y los dos brazos de la calle que la cruza comparten el par de
 * esquinas, así que ahí la cuenta fuerte es otra (docs/11 §3.5).
 */
async function reportJunctions(trx: Transaction<DB>): Promise<JunctionReport[]> {
  const result = await sql<{
    osm_node_id: string;
    kind: string;
    arms: string;
    corners: string;
    crossings: string;
    single_line_arms: string;
  }>`
    SELECT junction.osm_node_id, junction.kind,
           (SELECT count(*) FROM _import_junction_arms arm
             WHERE arm.junction_id = junction.junction_id) AS arms,
           (SELECT count(*) FROM _import_corner_points point
             WHERE point.junction_id = junction.junction_id) AS corners,
           (SELECT count(*) FROM _import_crossing_rows crossing
             WHERE crossing.junction_id = junction.junction_id) AS crossings,
           (SELECT count(*)
              FROM _import_junction_arms arm
              JOIN _import_tramos tramo ON tramo.tramo_id = arm.tramo_id
             WHERE arm.junction_id = junction.junction_id
               AND tramo.offset_m = 0) AS single_line_arms
    FROM _import_junctions junction
    ORDER BY junction.osm_node_id
  `.execute(trx);

  return result.rows.map((row) => ({
    osmNodeId: Number(row.osm_node_id),
    kind: row.kind === 'tee' ? 'tee' : 'cross',
    arms: Number(row.arms),
    corners: Number(row.corners),
    crossings: Number(row.crossings),
    singleLineArms: Number(row.single_line_arms),
  }));
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
