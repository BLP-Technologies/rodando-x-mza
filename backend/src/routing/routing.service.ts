import type { Kysely } from 'kysely';
import type { DB } from '../db/types.js';
import { ERROR_CODES } from '../http/error-codes.js';
import { HttpError } from '../http/errors.js';
import {
  findRouteLegs,
  findServiceAreaCoverage,
  snapToKerbNode,
  type RouteLegRow,
  type SnappedNode,
} from './routing.sql.js';
import {
  lineStringSchema,
  type RouteLeg,
  type RouteRequest,
  type RouteResponse,
  type RouteSummary,
} from './routing.schemas.js';

/**
 * Calcula un recorrido accesible entre dos puntos.
 *
 * El orden es el de [13 §4 a §7](../../../docs/13-api-de-ruteo.md): validar las puntas
 * contra la red de seguridad, pegarlas al cordón más cercano y recién ahí rutear. No
 * escribe nada: la respuesta depende sólo del grafo y los obstáculos del momento.
 */
export async function calculateRoute(
  db: Kysely<DB>,
  request: RouteRequest,
): Promise<RouteResponse> {
  await assertInsideServiceArea(db, request);

  const [originNode, destinationNode] = await Promise.all([
    snapToKerbNode(db, request.origin),
    snapToKerbNode(db, request.destination),
  ]);

  const origin = toEndpoint(originNode);
  const destination = toEndpoint(destinationNode);

  // Las dos puntas en el mismo cordón: el recorrido es de cero metros, no un error.
  if (originNode.id === destinationNode.id) {
    return {
      found: true,
      origin,
      destination,
      summary: { meters: 0, cost: 0, crossings: 0, unverified_meters: 0 },
      legs: [],
    };
  }

  const rows = await findRouteLegs(db, originNode.id, destinationNode.id);

  // Sin tramos no hay recorrido: `pgr_dijkstra` no devuelve filas, y el pedido está bien.
  if (rows.length === 0) {
    return { found: false, origin, destination };
  }

  return {
    found: true,
    origin,
    destination,
    summary: summarize(rows),
    legs: rows.map(toLeg),
  };
}

/**
 * Rechaza el pedido si alguna punta cae fuera del perímetro de búsqueda.
 *
 * Una base sin área activa no es un pedido inválido sino una instalación incompleta, y
 * por eso termina en un 500 ([13 §8](../../../docs/13-api-de-ruteo.md)).
 */
async function assertInsideServiceArea(db: Kysely<DB>, request: RouteRequest): Promise<void> {
  const coverage = await findServiceAreaCoverage(db, request.origin, request.destination);

  if (coverage.activeAreas === 0) {
    throw new HttpError(
      500,
      ERROR_CODES.INTERNAL_ERROR,
      'no active service area to validate the request against',
    );
  }

  const details: { field: string; code: string }[] = [];
  if (!coverage.originCovered) {
    details.push({ field: 'origin', code: 'OUTSIDE_SERVICE_AREA' });
  }
  if (!coverage.destinationCovered) {
    details.push({ field: 'destination', code: 'OUTSIDE_SERVICE_AREA' });
  }

  if (details.length > 0) {
    throw new HttpError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      'a route endpoint is outside the service area',
      details,
    );
  }
}

/** La punta tal como la devuelve la respuesta: el nodo real y cuánto se movió. */
function toEndpoint(node: SnappedNode): RouteResponse['origin'] {
  return {
    node: { id: node.id, lat: node.lat, lon: node.lon },
    distance_m: round1(node.distanceM),
  };
}

function toLeg(row: RouteLegRow): RouteLeg {
  const parsed: unknown = JSON.parse(row.geometry);

  return {
    element_kind: row.elementKind,
    element_id: row.elementId,
    level: row.level,
    is_verified: row.isVerified,
    meters: round1(row.meters),
    geometry: lineStringSchema.parse(parsed),
  };
}

/**
 * Los totales del recorrido, derivados de los tramos y no de una segunda consulta: así no
 * hay dos cuentas que puedan discrepar.
 *
 * `unverified_meters` es lo que necesita la app para avisar que el recorrido se apoya en
 * datos que nadie miró: un `NULL` se cobra como `PARTIAL` ([09 §4.7]), y hoy el grafo
 * entero está en `NULL`.
 */
function summarize(rows: readonly RouteLegRow[]): RouteSummary {
  let meters = 0;
  let cost = 0;
  let crossings = 0;
  let unverified = 0;

  for (const row of rows) {
    meters += row.meters;
    cost += row.cost;
    unverified += row.isVerified ? 0 : row.meters;
    if (row.elementKind === 'crossing') crossings += 1;
  }

  return {
    meters: round1(meters),
    cost: round1(cost),
    crossings,
    unverified_meters: round1(unverified),
  };
}

/** Una décima alcanza: el cliente no distingue un milímetro y el JSON deja de tener ruido. */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
