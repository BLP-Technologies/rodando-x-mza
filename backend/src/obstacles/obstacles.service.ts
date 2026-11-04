import type { Kysely } from 'kysely';
import type { DB } from '../db/types.js';
import { pointGeometrySchema } from '../graph/graph.schemas.js';
import { ERROR_CODES } from '../http/error-codes.js';
import { HttpError } from '../http/errors.js';
import {
  obstacleFeatureSchema,
  obstaclesResponseSchema,
  type ObstacleFeature,
  type ObstacleSeverity,
  type ObstacleStatusFilter,
  type ObstaclesResponse,
} from './obstacles.schemas.js';
import {
  findNearestElement,
  findObstacle,
  findObstacles,
  findObstacleTypes,
  insertObstacle,
  markObstacleResolved,
  type ObstacleRow,
} from './obstacles.sql.js';

/**
 * El tope de obstáculos de una respuesta.
 *
 * Es el mismo número y el mismo motivo que el del grafo y el de los reportes
 * ([14 §5.1](../../../docs/14-la-api-del-grafo.md)): una red para que un pedido no arme una
 * respuesta de decenas de megabytes, que avisa con `truncated` en vez de mentir sobre el
 * recorte ([18 §4](../../../docs/18-la-api-de-obstaculos.md)).
 */
const MAX_OBSTACLES = 2000;

/** Lo que el alta necesita: el punto todavía suelto, sin el elemento al que se pega. */
export type NewObstacle = {
  type: string;
  severity: ObstacleSeverity;
  lon: number;
  lat: number;
};

/**
 * Crea un obstáculo publicado por el moderador (C012).
 *
 * Es la única puerta de alta del sistema, y la usa también la aprobación de un reporte
 * ([17 §7](../../../docs/17-la-api-de-reportes.md)): así el pegamento, el rechazo de `OTHER`
 * y la forma de la respuesta son los mismos vengan de donde vengan.
 *
 * **El vínculo lo decide el servidor.** El cuerpo no trae `element`: el punto se pega al
 * elemento del grafo más cercano, porque un obstáculo sin vínculo no cambia ningún costo y
 * el moderador no tiene con qué elegirlo en el mapa
 * ([09 §4.5](../../../docs/09-modelo-de-datos.md)). Si no hay nada dentro del radio, el alta
 * se rechaza con `NO_NEARBY_ELEMENT` ([18 §3](../../../docs/18-la-api-de-obstaculos.md)).
 *
 * **Un tipo inexistente, inactivo o `OTHER` es el mismo `INVALID`**: la acción del cliente
 * es la misma —elegir otro tipo del catálogo— igual que en los reportes
 * ([17 §5](../../../docs/17-la-api-de-reportes.md)).
 */
export async function createObstacle(
  db: Kysely<DB>,
  input: NewObstacle,
): Promise<ObstacleFeature> {
  const element = await findNearestElement(db, input.lon, input.lat);

  if (element === null) {
    throw new HttpError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      'no graph element near the obstacle point',
      [{ field: 'geom', code: 'NO_NEARBY_ELEMENT' }],
    );
  }

  const id = await insertObstacle(db, { ...input, element });

  if (id === null) {
    throw new HttpError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      `unknown obstacle type ${input.type}`,
      [{ field: 'type', code: 'INVALID' }],
    );
  }

  return readObstacle(db, id);
}

/**
 * Lee los obstáculos de un estado, como `FeatureCollection`, con el catálogo del formulario
 * al lado.
 *
 * Sólo lee: no hay caché ni nada que recordar entre pedidos, así que dos pedidos iguales
 * devuelven lo mismo mientras el dato no cambie. Una colección vacía es una respuesta válida
 * —no hay obstáculos en ese estado—, no un error
 * ([18 §4](../../../docs/18-la-api-de-obstaculos.md)).
 *
 * Las dos consultas son independientes —el catálogo no se filtra por estado ni compite por
 * el tope—, así que van en paralelo, igual que el grafo con sus áreas de servicio.
 */
export async function readObstacles(
  db: Kysely<DB>,
  status: ObstacleStatusFilter,
): Promise<ObstaclesResponse> {
  // Se pide una fila de más para distinguir "entraron justo 2000" de "había más".
  const [rows, types] = await Promise.all([
    findObstacles(db, status, MAX_OBSTACLES + 1),
    findObstacleTypes(db),
  ]);
  const truncated = rows.length > MAX_OBSTACLES;

  return obstaclesResponseSchema.parse({
    type: 'FeatureCollection',
    truncated,
    obstacle_types: types,
    features: (truncated ? rows.slice(0, MAX_OBSTACLES) : rows).map(toObstacleFeature),
  });
}

/**
 * Resuelve un obstáculo (C013) y lo devuelve como quedó.
 *
 * **Es idempotente**: resolver dos veces responde `200` con el mismo obstáculo y no toca
 * `resolved_at`, que conserva la fecha del primer cierre. No hay error de conflicto porque
 * el segundo pedido no quiere otra cosa que el obstáculo resuelto
 * ([18 §5](../../../docs/18-la-api-de-obstaculos.md)).
 *
 * No toca `reports`: el estado del reporte y el del obstáculo no se sincronizan en el MVP.
 */
export async function resolveObstacle(db: Kysely<DB>, id: number): Promise<ObstacleFeature> {
  await markObstacleResolved(db, id);

  return readObstacle(db, id);
}

/**
 * El obstáculo ya guardado, con la forma de la lectura.
 *
 * Un id que no existe o está dado de baja es `NOT_FOUND`: para quien pregunta, ese obstáculo
 * no está.
 */
export async function readObstacle(db: Kysely<DB>, id: number): Promise<ObstacleFeature> {
  const row = await findObstacle(db, id);

  if (row === null) {
    throw new HttpError(404, ERROR_CODES.NOT_FOUND, `obstacle ${id} not found`);
  }

  return toObstacleFeature(row);
}

/**
 * Una fila de la lectura, con la forma que tiene en la respuesta.
 *
 * Misma regla del borde que el grafo: el GeoJSON sale de la base como texto y se valida
 * antes de entrar al tipado. Las dos fechas se pasan a ISO acá porque el driver las entrega
 * como `Date`: el cliente no tiene que adivinar la zona horaria de la base.
 */
function toObstacleFeature(row: ObstacleRow): ObstacleFeature {
  const geometry: unknown = JSON.parse(row.geometry);

  return obstacleFeatureSchema.parse({
    type: 'Feature',
    geometry: pointGeometrySchema.parse(geometry),
    properties: {
      id: row.id,
      type: row.type,
      type_name: row.typeName,
      severity: row.severity,
      resolved_at: row.resolvedAt === null ? null : row.resolvedAt.toISOString(),
      element_kind: row.elementKind,
      element_id: row.elementId,
      reports_count: row.reportsCount,
      created_at: row.createdAt.toISOString(),
    },
  });
}
