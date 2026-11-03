import { sql, type Kysely } from 'kysely';
import type { DB } from '../db/types.js';
import type {
  ObstacleElementKind,
  ObstacleSeverity,
  ObstacleStatusFilter,
} from './obstacles.schemas.js';

/**
 * La escritura y la lectura de los obstáculos.
 *
 * Ver [18 §3, §4, §5 y §6](../../../docs/18-la-api-de-obstaculos.md).
 */

/**
 * A cuántos metros de un elemento del grafo se acepta un obstáculo.
 *
 * Es el **punto de partida**, no un contrato: mide cuánto se puede errar el clic. Treinta
 * metros cubren una vereda y la calzada de al lado, que es donde cae el pin cuando alguien
 * apunta a una esquina; más que eso ya no es "este paso" sino otra cuadra. Se ajusta
 * midiendo altas reales, y cambiarlo cambia sólo esta constante
 * ([18 §3](../../../docs/18-la-api-de-obstaculos.md)).
 */
const GLUE_RADIUS_METERS = 30;

/** El elemento al que se pegó un obstáculo: la clase y el `id` de su fila. */
export type GluedElement = { kind: ObstacleElementKind; id: number };

/** Un obstáculo leído, con lo que la respuesta necesita para dibujarlo y listarlo. */
export type ObstacleRow = {
  id: number;
  type: string;
  typeName: string;
  severity: ObstacleSeverity;
  resolvedAt: Date | null;
  elementKind: ObstacleElementKind;
  elementId: number;
  reportsCount: number;
  createdAt: Date;
  geometry: string;
};

/** Lo que la escritura necesita del pedido, con el punto y el elemento ya resueltos. */
export type InsertObstacleInput = {
  type: string;
  severity: ObstacleSeverity;
  lon: number;
  lat: number;
  element: GluedElement;
};

/**
 * Las columnas de un obstáculo leído, en un solo lugar.
 *
 * La lectura por estado y la de un solo `id` devuelven lo mismo, así que comparten el
 * `SELECT`: dos copias de estas quince líneas serían dos lugares donde arreglar el mismo
 * campo ([18 §4](../../../docs/18-la-api-de-obstaculos.md)).
 *
 * Tres decisiones adentro:
 *
 * - **El vínculo se traduce a un par.** `element_kind` y `element_id` salen de las tres
 *   columnas con los nombres que ya usa una feature del grafo, y no de las tres columnas:
 *   el cliente no tiene que saber cuál de las tres está escrita.
 * - **`reports_count` se cuenta acá.** Son los reportes que apuntan al obstáculo sin baja y
 *   sin haber sido rechazados: un reporte descartado no es un aviso vigente.
 * - **`deleted_at IS NULL` siempre**, en la lectura y en el conteo: un obstáculo dado de
 *   baja no está en el mapa ni suma reportes.
 */
const obstacleColumns = sql`
  obstacle.id,
  catalogue.code AS type,
  catalogue.name_es AS type_name,
  obstacle.severity,
  obstacle.resolved_at,
  ST_AsGeoJSON(obstacle.geom) AS geometry,
  CASE
    WHEN obstacle.sidewalk_id IS NOT NULL THEN 'sidewalk'
    WHEN obstacle.kerb_node_id IS NOT NULL THEN 'kerb'
    ELSE 'crossing'
  END AS element_kind,
  coalesce(obstacle.sidewalk_id, obstacle.kerb_node_id, obstacle.crossing_id) AS element_id,
  (SELECT count(*)
   FROM reports report
   WHERE report.obstacle_id = obstacle.id
     AND report.deleted_at IS NULL
     AND report.status <> 'REJECTED') AS reports_count,
  obstacle.created_at`;

/** El filtro por estado, aplicado en la consulta y no en el cliente. */
const STATUS_FILTERS = {
  ACTIVE: sql`obstacle.resolved_at IS NULL`,
  RESOLVED: sql`obstacle.resolved_at IS NOT NULL`,
  ALL: sql`true`,
} as const;

/** La columna del vínculo que corresponde a cada clase de elemento. */
const ELEMENT_COLUMNS = {
  sidewalk: sql`sidewalk_id`,
  kerb: sql`kerb_node_id`,
  crossing: sql`crossing_id`,
} as const;

/**
 * Los obstáculos de un estado, como mucho `limit`.
 *
 * El orden es determinístico —del más nuevo al más antiguo y desempatando por `id`— porque
 * de él depende qué filas entran cuando la respuesta se recorta, igual que en la lectura de
 * reportes ([17 §7](../../../docs/17-la-api-de-reportes.md)).
 */
export async function findObstacles(
  db: Kysely<DB>,
  status: ObstacleStatusFilter,
  limit: number,
): Promise<ObstacleRow[]> {
  const result = await sql<{
    id: number;
    type: string;
    type_name: string;
    severity: ObstacleSeverity;
    resolved_at: Date | null;
    element_kind: ObstacleElementKind;
    element_id: number;
    reports_count: string;
    created_at: Date;
    geometry: string;
  }>`
    SELECT ${obstacleColumns}
    FROM obstacles obstacle
    JOIN obstacle_types catalogue ON catalogue.id = obstacle.type_id
    WHERE obstacle.deleted_at IS NULL AND ${STATUS_FILTERS[status]}
    ORDER BY obstacle.created_at DESC, obstacle.id DESC
    LIMIT ${limit}
  `.execute(db);

  return result.rows.map(toObstacleRow);
}

/**
 * Un obstáculo por `id`, o `null` si no existe o está dado de baja.
 *
 * Es la forma de la respuesta del alta y la de resolver: el `POST` devuelve el obstáculo con
 * la misma forma que la lectura, así que sale de la misma consulta y no de un `RETURNING`
 * que repita el `JOIN` con el catálogo ([18 §3](../../../docs/18-la-api-de-obstaculos.md)).
 */
export async function findObstacle(db: Kysely<DB>, id: number): Promise<ObstacleRow | null> {
  const result = await sql<{
    id: number;
    type: string;
    type_name: string;
    severity: ObstacleSeverity;
    resolved_at: Date | null;
    element_kind: ObstacleElementKind;
    element_id: number;
    reports_count: string;
    created_at: Date;
    geometry: string;
  }>`
    SELECT ${obstacleColumns}
    FROM obstacles obstacle
    JOIN obstacle_types catalogue ON catalogue.id = obstacle.type_id
    WHERE obstacle.id = ${id} AND obstacle.deleted_at IS NULL
  `.execute(db);

  const row = result.rows[0];

  return row === undefined ? null : toObstacleRow(row);
}

/** La fila cruda del `SELECT` compartido, ya con los nombres del dominio. */
function toObstacleRow(row: {
  id: number;
  type: string;
  type_name: string;
  severity: ObstacleSeverity;
  resolved_at: Date | null;
  element_kind: ObstacleElementKind;
  element_id: number;
  reports_count: string;
  created_at: Date;
  geometry: string;
}): ObstacleRow {
  return {
    id: row.id,
    type: row.type,
    typeName: row.type_name,
    severity: row.severity,
    resolvedAt: row.resolved_at,
    elementKind: row.element_kind,
    elementId: row.element_id,
    // `count(*)` es `bigint` y el driver lo entrega como texto.
    reportsCount: Number(row.reports_count),
    createdAt: row.created_at,
    geometry: row.geometry,
  };
}

/**
 * Los tipos del catálogo que un obstáculo puede tener: activos y distintos de `OTHER`.
 *
 * Es la lista del formulario del portal, así que no viaja el catálogo completo: `OTHER` es
 * la percepción del ciudadano y el moderador clasifica con el tipo que corresponde
 * ([09 §4.5](../../../docs/09-modelo-de-datos.md)). Se ordena por nombre en español, que es
 * como se lee un desplegable.
 */
export async function findObstacleTypes(
  db: Kysely<DB>,
): Promise<{ code: string; name: string }[]> {
  const result = await sql<{ code: string; name: string }>`
    SELECT code, name_es AS name
    FROM obstacle_types
    WHERE is_active AND code <> 'OTHER'
    ORDER BY name_es
  `.execute(db);

  return result.rows;
}

/**
 * El elemento del grafo más cercano a un punto, dentro del radio de pegamento.
 *
 * - **Las tres clases compiten en una sola consulta** (`UNION ALL`): el obstáculo se cuelga
 *   del que esté más cerca sin que nadie elija la clase. Elegir por clase primero dejaría un
 *   `kerb_node` a un metro perdiendo contra una vereda a veinte.
 * - **La distancia es en metros reales** (`::geography`), no en grados: en grados, un mismo
 *   error en latitud y en longitud no mide lo mismo ([09 §4.7](../../../docs/09-modelo-de-datos.md)).
 * - **A igual distancia gana el más chico**: el cordón antes que la arista, porque un punto
 *   que cae justo sobre el extremo de dos aristas está en la esquina, y `MISSING_RAMP` vive
 *   ahí ([09 §4.5](../../../docs/09-modelo-de-datos.md)). Sin ese desempate, un punto sobre
 *   una esquina caería en cualquiera de los cuatro elementos que la tocan y el mismo pin
 *   daría un obstáculo distinto en cada alta.
 * - **El desempate es determinístico** —distancia, clase e `id`—, así que el mismo punto
 *   siempre se pega al mismo elemento.
 *
 * Devuelve `null` si no hay nada dentro del radio: el alta lo rechaza con
 * `NO_NEARBY_ELEMENT` ([18 §3](../../../docs/18-la-api-de-obstaculos.md)).
 */
export async function findNearestElement(
  db: Kysely<DB>,
  lon: number,
  lat: number,
): Promise<GluedElement | null> {
  const result = await sql<{ element_kind: ObstacleElementKind; element_id: number }>`
    WITH point AS (
      SELECT ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326) AS geom
    ),
    candidates AS (
      SELECT 'kerb'::text AS element_kind, 1 AS kind_order, element.id AS element_id,
             ST_Distance(element.geom::geography, point.geom::geography) AS distance_m
      FROM kerb_nodes element, point
      WHERE ST_DWithin(element.geom::geography, point.geom::geography, ${GLUE_RADIUS_METERS})
      UNION ALL
      SELECT 'crossing'::text, 2, element.id,
             ST_Distance(element.geom::geography, point.geom::geography)
      FROM crossings element, point
      WHERE ST_DWithin(element.geom::geography, point.geom::geography, ${GLUE_RADIUS_METERS})
      UNION ALL
      SELECT 'sidewalk'::text, 3, element.id,
             ST_Distance(element.geom::geography, point.geom::geography)
      FROM sidewalks element, point
      WHERE ST_DWithin(element.geom::geography, point.geom::geography, ${GLUE_RADIUS_METERS})
    )
    SELECT element_kind, element_id
    FROM candidates
    ORDER BY distance_m, kind_order, element_id
    LIMIT 1
  `.execute(db);

  const row = result.rows[0];

  return row === undefined ? null : { kind: row.element_kind, id: row.element_id };
}

/**
 * Guarda un obstáculo y devuelve su `id`, o `null` si ese código no sirve como obstáculo.
 *
 * Dos decisiones (ver [18 §3](../../../docs/18-la-api-de-obstaculos.md)):
 *
 * - **Una sola consulta, sin `SELECT` previo**: el catálogo se resuelve en el mismo
 *   `INSERT ... SELECT`, así que no hay carrera entre chequear que el código existe y
 *   escribir. Cero filas devueltas significa exactamente una cosa: no hay ningún tipo activo
 *   con ese código que no sea `OTHER`.
 * - **Se escribe una sola de las tres columnas**, la que corresponde al elemento pegado, así
 *   el `CHECK obstacles_element_check` nunca ve dos.
 */
export async function insertObstacle(
  db: Kysely<DB>,
  input: InsertObstacleInput,
): Promise<number | null> {
  const result = await sql<{ id: number }>`
    INSERT INTO obstacles (type_id, severity, geom, ${ELEMENT_COLUMNS[input.element.kind]})
    SELECT catalogue.id, ${input.severity}::obstacle_severity,
           ST_SetSRID(ST_MakePoint(${input.lon}, ${input.lat}), 4326), ${input.element.id}
    FROM obstacle_types catalogue
    WHERE catalogue.code = ${input.type} AND catalogue.is_active AND catalogue.code <> 'OTHER'
    RETURNING id
  `.execute(db);

  return result.rows[0]?.id ?? null;
}

/**
 * Marca un obstáculo como resuelto, si todavía no lo estaba.
 *
 * El `WHERE resolved_at IS NULL` es lo que hace idempotente a la operación: un obstáculo ya
 * resuelto no se reescribe, así que `resolved_at` conserva la fecha de la primera vez
 * ([18 §5](../../../docs/18-la-api-de-obstaculos.md)).
 */
export async function markObstacleResolved(db: Kysely<DB>, id: number): Promise<void> {
  await sql`
    UPDATE obstacles
    SET resolved_at = now()
    WHERE id = ${id} AND deleted_at IS NULL AND resolved_at IS NULL
  `.execute(db);
}
