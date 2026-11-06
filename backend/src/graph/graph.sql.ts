import { sql, type Kysely } from 'kysely';
import type { AccessibilityLevel, DB } from '../db/types.js';
import type { BBox, ElementKind } from './graph.schemas.js';

/**
 * La consulta del grafo: una sola por pedido.
 *
 * Ver [14 §4 y §5](../../../docs/14-la-api-del-grafo.md). Las tres tablas son la misma
 * pregunta —qué elementos hay en el área— y por eso se unen en una consulta en vez de
 * hacer tres.
 */

/** Una fila del grafo, con lo que la respuesta necesita para dibujarla. */
export type GraphFeatureRow = {
  elementKind: 'sidewalk' | 'crossing' | 'kerb';
  elementId: number;
  level: AccessibilityLevel | null;
  isVerified: boolean;
  streetName: string | null;
  geometry: string;
};

/**
 * Los elementos del grafo que intersecan el bbox, como mucho `limit`.
 *
 * El filtro es el operador `&&` contra la columna: es el que usa el índice GiST y alcanza
 * para "interseca" ([14 §4](../../../docs/14-la-api-del-grafo.md)). El orden es
 * determinístico —clase e `id`— porque de él depende qué features entran cuando el
 * resultado se recorta: primero veredas, después cruces y al final cordones.
 */
export async function findGraphFeatures(
  db: Kysely<DB>,
  bbox: BBox,
  limit: number,
): Promise<GraphFeatureRow[]> {
  const result = await sql<{
    element_kind: 'sidewalk' | 'crossing' | 'kerb';
    element_id: number;
    level: AccessibilityLevel | null;
    is_verified: boolean;
    street_name: string | null;
    geometry: string;
  }>`
    WITH area AS (
      SELECT ST_MakeEnvelope(${bbox.minLon}::double precision,
                             ${bbox.minLat}::double precision,
                             ${bbox.maxLon}::double precision,
                             ${bbox.maxLat}::double precision, 4326) AS geom
    ),
    elements AS (
      SELECT 1 AS kind_order, 'sidewalk'::text AS element_kind, element.id AS element_id,
             element.accessibility_level AS level, element.is_verified,
             element.street_name, element.geom
      FROM sidewalks element, area
      WHERE element.geom && area.geom
      UNION ALL
      SELECT 2, 'crossing'::text, element.id, element.accessibility_level,
             element.is_verified, NULL::varchar(100), element.geom
      FROM crossings element, area
      WHERE element.geom && area.geom
      UNION ALL
      SELECT 3, 'kerb'::text, element.id, element.accessibility_level,
             element.is_verified, NULL::varchar(100), element.geom
      FROM kerb_nodes element, area
      WHERE element.geom && area.geom
    )
    SELECT element_kind, element_id, level, is_verified, street_name,
           ST_AsGeoJSON(geom) AS geometry
    FROM elements
    ORDER BY kind_order, element_id
    LIMIT ${limit}
  `.execute(db);

  return result.rows.map((row) => ({
    elementKind: row.element_kind,
    elementId: row.element_id,
    level: row.level,
    isVerified: row.is_verified,
    streetName: row.street_name,
    geometry: row.geometry,
  }));
}

/**
 * La tabla de cada clase de elemento y la única columna que no comparten: el nombre de
 * la calle, que sólo existe en la vereda ([14 §5](../../../docs/14-la-api-del-grafo.md)).
 *
 * El nombre de tabla nunca se interpola en el texto del SQL: `sql.table()` lo pasa como
 * referencia y Kysely lo escapa, y además el valor viene de una unión cerrada validada
 * por Zod. No hay construcción dinámica de consultas.
 */
const ELEMENT_TABLES = {
  sidewalk: { table: 'sidewalks', streetName: sql<string | null>`street_name` },
  crossing: { table: 'crossings', streetName: sql<string | null>`NULL::varchar(100)` },
  kerb: { table: 'kerb_nodes', streetName: sql<string | null>`NULL::varchar(100)` },
} as const;

/**
 * Escribe el nivel de un elemento y devuelve la fila como quedó, o `null` si no existe.
 *
 * Tres decisiones (ver [14 §7](../../../docs/14-la-api-del-grafo.md)):
 *
 * - **`is_verified` no es un parámetro**: se deriva del nivel en la misma escritura, así
 *   que no hay forma de guardar un nivel sin verificar ni de verificar sin nivel. Un
 *   elemento vuelve a "sin dato" queda como recién importado y el relevamiento lo puede
 *   completar ([12 §8.2](../../../docs/12-relevamiento-de-accesibilidad.md)).
 * - **Un solo viaje**: el `RETURNING` devuelve la fila o ninguna, así que el 404 no
 *   necesita un `SELECT` previo ni tiene la carrera entre chequear y escribir.
 * - **`::accessibility_level` explícito** en el parámetro: sin el cast, Postgres no puede
 *   tipar un parámetro que en un caso es un enum y en el otro `NULL`.
 */
export async function updateElementLevel(
  db: Kysely<DB>,
  kind: ElementKind,
  id: number,
  level: AccessibilityLevel | null,
): Promise<GraphFeatureRow | null> {
  const target = ELEMENT_TABLES[kind];

  const result = await sql<{
    element_id: number;
    level: AccessibilityLevel | null;
    is_verified: boolean;
    street_name: string | null;
    geometry: string;
  }>`
    UPDATE ${sql.table(target.table)}
    SET accessibility_level = ${level}::accessibility_level,
        is_verified = (${level}::accessibility_level IS NOT NULL)
    WHERE id = ${id}
    RETURNING id AS element_id,
              accessibility_level AS level,
              is_verified,
              ${target.streetName} AS street_name,
              ST_AsGeoJSON(geom) AS geometry
  `.execute(db);

  const row = result.rows[0];
  if (row === undefined) return null;

  return {
    elementKind: kind,
    elementId: row.element_id,
    level: row.level,
    isVerified: row.is_verified,
    streetName: row.street_name,
    geometry: row.geometry,
  };
}
