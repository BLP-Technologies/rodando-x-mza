import { sql, type Kysely } from 'kysely';
import type { AccessibilityLevel, DB } from '../db/types.js';
import type { BBox } from './graph.schemas.js';

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
