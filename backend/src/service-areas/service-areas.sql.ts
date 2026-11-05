import { sql, type Kysely } from 'kysely';
import type { DB } from '../db/types.js';

/**
 * La consulta del área de servicio: una sola, y sin filtro por pedido.
 *
 * Está aparte de `graph.sql.ts` porque el área no comparte ni una columna con el grafo y no
 * se filtra por bbox: es el contexto de la zona, no un elemento del área pedida
 * ([14 §5.2](../../../docs/14-la-api-del-grafo.md)).
 */

/**
 * Un área de servicio activa, con su geometría ya en GeoJSON.
 *
 * Vive aparte de `GraphFeatureRow` porque no comparte ni una columna con el grafo: el
 * área tiene nombre y polígono, el elemento tiene clase, nivel y vereda.
 */
export type ServiceAreaRow = { id: number; name: string; geometry: string };

/**
 * Las áreas de servicio activas, con su perímetro listo para dibujar.
 *
 * Tres decisiones (ver [14 §5.2](../../../docs/14-la-api-del-grafo.md) y
 * [09 §4.8](../../../docs/09-modelo-de-datos.md)):
 *
 * - **Se filtra por `is_active` y no por `id`**: así un perímetro se reemplaza sin cortar
 *   el servicio. Se desactiva el viejo y se activa el nuevo en la misma escritura, y no
 *   hay un `id` que el código tenga que conocer para encontrar la zona vigente.
 * - **No se filtra por bbox**: el área es el contexto de la zona, no un elemento del
 *   área pedida. Recortarla al pedido dejaría al mapa sin el borde justo cuando el
 *   usuario panea fuera, que es cuando más lo necesita.
 * - **`ORDER BY id`**: la lectura promete que dos pedidos iguales devuelven lo mismo
 *   ([14 §1](../../../docs/14-la-api-del-grafo.md)); sin orden, el orden de las filas
 *   queda librado al plan de la consulta.
 */
export async function findActiveServiceAreas(db: Kysely<DB>): Promise<ServiceAreaRow[]> {
  const result = await sql<{ id: number; name: string; geometry: string }>`
    SELECT id, name, ST_AsGeoJSON(geom) AS geometry
    FROM service_areas
    WHERE is_active
    ORDER BY id
  `.execute(db);

  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    geometry: row.geometry,
  }));
}
