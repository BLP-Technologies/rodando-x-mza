import { sql, type Kysely } from 'kysely';
import type { AccessibilityLevel, DB } from '../db/types.js';

/**
 * Las consultas del ruteo. La forma del grafo, del costo y de la red de seguridad ya está
 * en el esquema; acá sólo se consultan.
 *
 * Ver [13 §4 y §5](../../../docs/13-api-de-ruteo.md) y
 * [11 §5](../../../docs/11-grafo-peatonal.md).
 */

/** Un punto del pedido, en WGS 84. */
export type RoutePoint = { lat: number; lon: number };

/** Un cordón al que se pegó una punta. */
export type SnappedNode = { id: number; lat: number; lon: number; distanceM: number };

/** Un tramo del recorrido, con lo que hace falta para cobrarlo y para mostrarlo. */
export type RouteLegRow = {
  elementKind: 'sidewalk' | 'crossing';
  elementId: number;
  level: AccessibilityLevel | null;
  isVerified: boolean;
  meters: number;
  cost: number;
  geometry: string;
};

/**
 * Cuántas áreas activas hay y si cubren cada punta.
 *
 * Se valida el punto **tal como se pidió**, no el nodo al que después se pega ([13 §4.1]).
 * Devuelve las dos puntas en una sola consulta porque son la misma pregunta.
 */
export async function findServiceAreaCoverage(
  db: Kysely<DB>,
  origin: RoutePoint,
  destination: RoutePoint,
): Promise<{ activeAreas: number; originCovered: boolean; destinationCovered: boolean }> {
  const result = await sql<{
    active_areas: string;
    origin_covered: string;
    destination_covered: string;
  }>`
    SELECT count(*) AS active_areas,
           count(*) FILTER (WHERE ST_Covers(area.geom, points.origin)) AS origin_covered,
           count(*) FILTER (WHERE ST_Covers(area.geom, points.destination)) AS destination_covered
    FROM service_areas area,
         (SELECT ST_SetSRID(ST_MakePoint(${origin.lon}, ${origin.lat}), 4326) AS origin,
                 ST_SetSRID(ST_MakePoint(${destination.lon}, ${destination.lat}), 4326) AS destination
         ) points
    WHERE area.is_active
  `.execute(db);

  const row = result.rows[0];

  return {
    activeAreas: Number(row?.active_areas ?? 0),
    originCovered: Number(row?.origin_covered ?? 0) > 0,
    destinationCovered: Number(row?.destination_covered ?? 0) > 0,
  };
}

/**
 * El cordón más cercano a un punto, con la distancia que se movió la punta.
 *
 * `geom <-> punto` es la distancia por índice GiST ([11 §5.2]); la distancia que se
 * devuelve, en cambio, es en metros reales, y es lo que la respuesta informa para que el
 * cliente no haga creer que el recorrido empieza en el punto pedido ([13 §4.2]).
 */
export async function snapToKerbNode(db: Kysely<DB>, point: RoutePoint): Promise<SnappedNode> {
  const result = await sql<{ id: number; lat: number; lon: number; distance_m: number }>`
    SELECT node.id,
           ST_Y(node.geom) AS lat,
           ST_X(node.geom) AS lon,
           ST_Distance(node.geom::geography, point.geom::geography) AS distance_m
    FROM kerb_nodes node,
         (SELECT ST_SetSRID(ST_MakePoint(${point.lon}, ${point.lat}), 4326) AS geom) point
    ORDER BY node.geom <-> point.geom
    LIMIT 1
  `.execute(db);

  const row = result.rows[0];
  if (row === undefined) {
    throw new Error('the graph has no kerb nodes to snap to');
  }

  return { id: row.id, lat: row.lat, lon: row.lon, distanceM: row.distance_m };
}

/** La relación que recorre `pgr_dijkstra`: `id`, `source`, `target` y `cost` ([11 §5]). */
const EDGES_SQL = 'SELECT id, source, target, cost FROM walkable_edges';

/**
 * Los tramos del recorrido, en orden.
 *
 * El `JOIN` con la vista trae el detalle de cada arista; las tablas de los elementos
 * entran sólo por `is_verified`, que la vista no expone: `element_kind` y `element_id`
 * existen justamente para volver de la arista al elemento ([11 §5]).
 *
 * Un cruce hereda la verificación de sus dos esquinas cuando nadie miró el cruce mismo,
 * porque su nivel es el peor de ellas ([09 §4.7](../../../docs/09-modelo-de-datos.md)): si
 * las dos se relevaron, el valor derivado se apoya en dato relevado.
 */
export async function findRouteLegs(
  db: Kysely<DB>,
  fromNodeId: number,
  toNodeId: number,
): Promise<RouteLegRow[]> {
  const result = await sql<{
    element_kind: 'sidewalk' | 'crossing';
    element_id: number;
    level: AccessibilityLevel | null;
    is_verified: boolean;
    meters: number;
    cost: number;
    geometry: string;
  }>`
    SELECT edge.element_kind,
           edge.element_id,
           edge.level,
           edge.meters,
           edge.cost,
           CASE
             WHEN edge.element_kind = 'sidewalk' THEN coalesce(sidewalk.is_verified, false)
             ELSE coalesce(crossing.is_verified, false)
               OR (coalesce(start_kerb.is_verified, false)
                   AND coalesce(end_kerb.is_verified, false))
           END AS is_verified,
           ST_AsGeoJSON(edge.geom) AS geometry
    FROM pgr_dijkstra(${EDGES_SQL}, ${fromNodeId}::bigint, ${toNodeId}::bigint,
                      directed := false) path
    JOIN walkable_edges edge ON edge.id = path.edge
    LEFT JOIN sidewalks sidewalk
      ON edge.element_kind = 'sidewalk' AND sidewalk.id = edge.element_id
    LEFT JOIN crossings crossing
      ON edge.element_kind = 'crossing' AND crossing.id = edge.element_id
    LEFT JOIN kerb_nodes start_kerb ON start_kerb.id = crossing.start_node_id
    LEFT JOIN kerb_nodes end_kerb ON end_kerb.id = crossing.end_node_id
    ORDER BY path.path_seq
  `.execute(db);

  return result.rows.map((row) => ({
    elementKind: row.element_kind,
    elementId: row.element_id,
    level: row.level,
    isVerified: row.is_verified,
    meters: row.meters,
    cost: row.cost,
    geometry: row.geometry,
  }));
}
