import { fileURLToPath } from 'node:url';
import { sql, type Transaction } from 'kysely';
import { afterAll, describe, expect, it } from 'vitest';
import { getDb } from '../db/index.js';
import { inRolledBackTransaction } from '../db/test-transaction.js';
import type { DB } from '../db/types.js';
import { importOsm } from '../importer/importer.run.js';
import { approveReport, createReport, rejectReport } from '../reports/reports.service.js';
import { calculateRoute } from '../routing/routing.service.js';
import type { RouteRequest, RouteResponse } from '../routing/routing.schemas.js';
import { createObstacle, readObstacles, resolveObstacle } from './obstacles.service.js';

/**
 * Lo que el alta, la resolución y la lectura escriben y leen, contra la base.
 *
 * Todo corre dentro de una transacción que se deshace, como los tests del grafo: el
 * obstáculo de prueba no queda en la base de desarrollo y no hay que limpiarlo. El grafo
 * sale del mismo extracto que usan los tests del grafo y del ruteo.
 */

const FIXTURE = fileURLToPath(new URL('../importer/fixtures/two-blocks.osm', import.meta.url));

/** La primera vereda, con lo que hace falta para rutear y para colgarle un obstáculo. */
type Sidewalk = {
  id: number;
  request: RouteRequest;
  /** Las coordenadas de una de sus dos esquinas, para un obstáculo en el cordón. */
  start: { lon: number; lat: number };
  /** Un punto sobre la vereda, lejos de las esquinas. */
  middle: { lon: number; lat: number };
};

async function firstSidewalk(trx: Transaction<DB>): Promise<Sidewalk> {
  const result = await sql<{
    id: number;
    start_lon: number;
    start_lat: number;
    end_lon: number;
    end_lat: number;
    middle_lon: number;
    middle_lat: number;
  }>`
    SELECT sidewalk.id,
           ST_X(start_node.geom) AS start_lon, ST_Y(start_node.geom) AS start_lat,
           ST_X(end_node.geom) AS end_lon, ST_Y(end_node.geom) AS end_lat,
           ST_X(ST_LineInterpolatePoint(sidewalk.geom, 0.5)) AS middle_lon,
           ST_Y(ST_LineInterpolatePoint(sidewalk.geom, 0.5)) AS middle_lat
    FROM sidewalks sidewalk
    JOIN kerb_nodes start_node ON start_node.id = sidewalk.start_node_id
    JOIN kerb_nodes end_node ON end_node.id = sidewalk.end_node_id
    ORDER BY sidewalk.id
    LIMIT 1
  `.execute(trx);

  const row = result.rows[0];
  if (row === undefined) throw new Error('the fixture derived no sidewalk to test with');

  return {
    id: row.id,
    request: {
      origin: { lon: row.start_lon, lat: row.start_lat },
      destination: { lon: row.end_lon, lat: row.end_lat },
    },
    start: { lon: row.start_lon, lat: row.start_lat },
    middle: { lon: row.middle_lon, lat: row.middle_lat },
  };
}

async function countObstacles(trx: Transaction<DB>): Promise<number> {
  const result = await sql<{ count: string }>`
    SELECT count(*) AS count FROM obstacles
  `.execute(trx);

  return Number(result.rows[0]?.count ?? 0);
}

/** Lo que la respuesta no devuelve: el vínculo crudo y la fecha de resolución. */
async function readObstacleRow(
  trx: Transaction<DB>,
  id: number,
): Promise<{ sidewalk_id: number | null; kerb_node_id: number | null; resolved_at: Date | null }> {
  const result = await sql<{
    sidewalk_id: number | null;
    kerb_node_id: number | null;
    resolved_at: Date | null;
  }>`
    SELECT sidewalk_id, kerb_node_id, resolved_at FROM obstacles WHERE id = ${id}
  `.execute(trx);

  const row = result.rows[0];
  if (row === undefined) throw new Error(`the obstacle ${id} was not saved`);

  return row;
}

/**
 * Si el recorrido pasó por una vereda concreta.
 *
 * Se pregunta por el par clase + `id` y no por el `id` solo: los ids de veredas y cruces
 * salen de secuencias distintas y se pisan.
 */
function usesSidewalk(route: RouteResponse, sidewalkId: number): boolean {
  if (!route.found) return false;

  return route.legs.some(
    (leg) => leg.element_kind === 'sidewalk' && leg.element_id === sidewalkId,
  );
}

/**
 * Cierra la conexión una sola vez, al terminar el archivo.
 *
 * Las dos suites comparten el mismo pool: destruirlo en la primera dejaría a la segunda sin
 * conexión.
 */
afterAll(async () => {
  if (process.env.DATABASE_URL) await getDb().destroy();
});

// Sin base no hay grafo ni obstáculos: el resto de la suite no la necesita.
describe.skipIf(!process.env.DATABASE_URL)('createObstacle contra la base', () => {
  it('bloquea la vereda de un CRITICAL y la libera al resolverlo', async () => {
    const outcome = await inRolledBackTransaction(async (trx) => {
      await importOsm(FIXTURE, trx);

      const sidewalk = await firstSidewalk(trx);
      const before = await calculateRoute(trx, sidewalk.request);

      const obstacle = await createObstacle(trx, {
        type: 'CONSTRUCTION',
        severity: 'CRITICAL',
        ...sidewalk.middle,
      });
      const blocked = await calculateRoute(trx, sidewalk.request);

      await resolveObstacle(trx, obstacle.properties.id);
      const after = await calculateRoute(trx, sidewalk.request);

      return { sidewalk, obstacle, before, blocked, after };
    });

    const { sidewalk, before, blocked, after } = outcome;
    if (!before.found || !after.found) {
      throw new Error('the sidewalk must have a route between its kerbs');
    }

    // El obstáculo cuelga de la vereda por el pegamento: el cuerpo no trajo el elemento
    // ([18 §3]).
    expect(outcome.obstacle.properties.element_kind).toBe('sidewalk');
    expect(outcome.obstacle.properties.element_id).toBe(sidewalk.id);
    expect(outcome.obstacle.properties.resolved_at).toBeNull();

    // Un `CRITICAL` saca la arista del grafo: o no hay recorrido, o el que hay la rodea
    // ([09 §4.7]).
    expect(usesSidewalk(blocked, sidewalk.id)).toBe(false);

    // Resolverlo devuelve el costo original: el efecto es del obstáculo y no de la arista.
    expect(after.summary.cost).toBeCloseTo(before.summary.cost, 0);
  });

  it('suma exactamente 40 m con un MODERATE', async () => {
    const outcome = await inRolledBackTransaction(async (trx) => {
      await importOsm(FIXTURE, trx);

      const sidewalk = await firstSidewalk(trx);
      await createObstacle(trx, {
        type: 'POTHOLE',
        severity: 'MODERATE',
        ...sidewalk.middle,
      });

      return calculateRoute(trx, sidewalk.request);
    });

    if (!outcome.found) throw new Error('the route through the sidewalk must exist');

    // El grafo importado cobra todo el doble (nivel nulo, [09 §4.7]), así que la única
    // diferencia con el recorrido sin obstáculo es la penalización del `MODERATE`.
    expect(outcome.summary.cost).toBeCloseTo(outcome.summary.meters * 2 + 40, 0);
  });

  it('en un cordón, un CRITICAL bloquea sus aristas y un MINOR no mueve el costo', async () => {
    const outcome = await inRolledBackTransaction(async (trx) => {
      await importOsm(FIXTURE, trx);

      const sidewalk = await firstSidewalk(trx);
      const before = await calculateRoute(trx, sidewalk.request);

      const minor = await createObstacle(trx, {
        type: 'MISSING_RAMP',
        severity: 'MINOR',
        ...sidewalk.start,
      });
      const withMinor = await calculateRoute(trx, sidewalk.request);

      const critical = await createObstacle(trx, {
        type: 'MISSING_RAMP',
        severity: 'CRITICAL',
        ...sidewalk.start,
      });
      const withCritical = await calculateRoute(trx, sidewalk.request);

      return { sidewalk, before, minor, withMinor, critical, withCritical };
    });

    const { sidewalk, before, withMinor, withCritical } = outcome;
    if (!before.found || !withMinor.found) {
      throw new Error('the route through the sidewalk must exist');
    }

    // Un punto sobre la esquina se pega al cordón y no a las aristas que salen de ahí.
    expect(outcome.minor.properties.element_kind).toBe('kerb');
    expect(outcome.critical.properties.element_kind).toBe('kerb');

    // Un nodo no tiene metros que penalizar: el `MINOR` queda como información.
    expect(withMinor.summary.cost).toBeCloseTo(before.summary.cost, 0);

    // Un `CRITICAL` en el cordón deja intransitable la vereda que sale de él.
    expect(usesSidewalk(withCritical, sidewalk.id)).toBe(false);
  });

  it('rechaza el alta sin elemento cerca y no escribe nada', async () => {
    const outcome = await inRolledBackTransaction(async (trx) => {
      await importOsm(FIXTURE, trx);

      const before = await countObstacles(trx);
      const error = await createObstacle(trx, {
        type: 'POTHOLE',
        severity: 'MINOR',
        // Buenos Aires: a cientos de kilómetros del grafo importado.
        lon: -58.4,
        lat: -34.6,
      }).catch((thrown: unknown) => thrown);

      return { before, error, after: await countObstacles(trx) };
    });

    expect(outcome.error).toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
      details: [{ field: 'geom', code: 'NO_NEARBY_ELEMENT' }],
    });
    expect(outcome.after).toBe(outcome.before);
  });

  it('rechaza OTHER como tipo de obstáculo y no escribe nada', async () => {
    const outcome = await inRolledBackTransaction(async (trx) => {
      await importOsm(FIXTURE, trx);

      const sidewalk = await firstSidewalk(trx);
      const before = await countObstacles(trx);
      const error = await createObstacle(trx, {
        type: 'OTHER',
        severity: 'MINOR',
        ...sidewalk.middle,
      }).catch((thrown: unknown) => thrown);

      return { before, error, after: await countObstacles(trx) };
    });

    // `OTHER` es la percepción del ciudadano y nunca la decisión del moderador
    // ([09 §4.5]).
    expect(outcome.error).toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
      details: [{ field: 'type', code: 'INVALID' }],
    });
    expect(outcome.after).toBe(outcome.before);
  });

  it('resolver dos veces responde 200 y no cambia la fecha', async () => {
    const outcome = await inRolledBackTransaction(async (trx) => {
      await importOsm(FIXTURE, trx);

      const sidewalk = await firstSidewalk(trx);
      const obstacle = await createObstacle(trx, {
        type: 'POTHOLE',
        severity: 'MINOR',
        ...sidewalk.middle,
      });

      const first = await resolveObstacle(trx, obstacle.properties.id);
      const firstRow = await readObstacleRow(trx, obstacle.properties.id);

      const second = await resolveObstacle(trx, obstacle.properties.id);
      const secondRow = await readObstacleRow(trx, obstacle.properties.id);

      return { first, firstRow, second, secondRow };
    });

    expect(outcome.first.properties.resolved_at).not.toBeNull();
    expect(outcome.second.properties.resolved_at).toBe(outcome.first.properties.resolved_at);
    expect(outcome.secondRow.resolved_at).toEqual(outcome.firstRow.resolved_at);
  });

  it('responde NOT_FOUND al resolver un obstáculo que no existe', async () => {
    const error = await inRolledBackTransaction(async (trx) => {
      await importOsm(FIXTURE, trx);

      return resolveObstacle(trx, 999999).catch((thrown: unknown) => thrown);
    });

    expect(error).toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });
});

describe.skipIf(!process.env.DATABASE_URL)('la moderación de reportes contra la base', () => {
  it('aprueba creando el obstáculo en el punto del reporte', async () => {
    const outcome = await inRolledBackTransaction(async (trx) => {
      await importOsm(FIXTURE, trx);

      const sidewalk = await firstSidewalk(trx);
      const report = await createReport(trx, {
        type: 'POTHOLE',
        severity: 'MINOR',
        description: 'Pozo en la vereda',
        geom: sidewalk.middle,
      });

      const approved = await approveReport(trx, report.id, {
        type: 'POTHOLE',
        severity: 'MODERATE',
      });

      const samePoint = await sql<{ same: boolean; status: string; obstacle_id: number | null }>`
        SELECT ST_Equals(report.geom, obstacle.geom) AS same,
               report.status, report.obstacle_id
        FROM reports report
        JOIN obstacles obstacle ON obstacle.id = report.obstacle_id
        WHERE report.id = ${report.id}
      `.execute(trx);

      return { report, approved, row: samePoint.rows[0] };
    });

    // El obstáculo hereda el punto del reporte: aprobar clasifica, no mueve el pin.
    expect(outcome.row?.same).toBe(true);
    expect(outcome.approved.report).toEqual({
      id: outcome.report.id,
      status: 'APPROVED',
      obstacle_id: outcome.approved.obstacle.properties.id,
    });
    expect(outcome.row?.status).toBe('APPROVED');
    expect(outcome.row?.obstacle_id).toBe(outcome.approved.obstacle.properties.id);

    // La severidad del obstáculo es la que decidió el moderador, no la del reporte.
    expect(outcome.approved.obstacle.properties.severity).toBe('MODERATE');
    expect(outcome.approved.obstacle.properties.element_kind).toBe('sidewalk');
  });

  it('aprobar dos veces responde CONFLICT y no crea un segundo obstáculo', async () => {
    const outcome = await inRolledBackTransaction(async (trx) => {
      await importOsm(FIXTURE, trx);

      const sidewalk = await firstSidewalk(trx);
      const report = await createReport(trx, {
        type: 'POTHOLE',
        severity: 'MINOR',
        description: 'Pozo en la vereda',
        geom: sidewalk.middle,
      });

      await approveReport(trx, report.id, { type: 'POTHOLE', severity: 'MINOR' });
      const before = await countObstacles(trx);

      const error = await approveReport(trx, report.id, {
        type: 'POTHOLE',
        severity: 'MINOR',
      }).catch((thrown: unknown) => thrown);

      return { error, before, after: await countObstacles(trx) };
    });

    expect(outcome.error).toMatchObject({ status: 409, code: 'CONFLICT' });
    expect(outcome.after).toBe(outcome.before);
  });

  it('descarta un reporte sin crear obstáculo', async () => {
    const outcome = await inRolledBackTransaction(async (trx) => {
      await importOsm(FIXTURE, trx);

      const sidewalk = await firstSidewalk(trx);
      const report = await createReport(trx, {
        type: 'OTHER',
        severity: 'MINOR',
        description: 'No era un obstáculo de vereda',
        geom: sidewalk.middle,
      });

      const before = await countObstacles(trx);
      const decision = await rejectReport(trx, report.id);

      return { decision, report, before, after: await countObstacles(trx) };
    });

    expect(outcome.decision).toEqual({
      id: outcome.report.id,
      status: 'REJECTED',
      obstacle_id: null,
    });
    expect(outcome.after).toBe(outcome.before);
  });

  it('deja el reporte PENDING si no hay elemento cerca del punto', async () => {
    const outcome = await inRolledBackTransaction(async (trx) => {
      await importOsm(FIXTURE, trx);

      const report = await createReport(trx, {
        type: 'POTHOLE',
        severity: 'MINOR',
        description: 'Lejos de todo',
        geom: { lon: -58.4, lat: -34.6 },
      });

      const error = await approveReport(trx, report.id, {
        type: 'POTHOLE',
        severity: 'MINOR',
      }).catch((thrown: unknown) => thrown);

      const status = await sql<{ status: string }>`
        SELECT status FROM reports WHERE id = ${report.id}
      `.execute(trx);

      return { error, status: status.rows[0]?.status };
    });

    // La transacción se deshace: ni obstáculo ni reporte marcado ([18 §6]).
    expect(outcome.error).toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
      details: [{ field: 'geom', code: 'NO_NEARBY_ELEMENT' }],
    });
    expect(outcome.status).toBe('PENDING');
  });
});

describe.skipIf(!process.env.DATABASE_URL)('readObstacles contra la base', () => {
  it('filtra por estado y avisa que el obstáculo nace activo', async () => {
    const outcome = await inRolledBackTransaction(async (trx) => {
      await importOsm(FIXTURE, trx);

      const sidewalk = await firstSidewalk(trx);
      const active = await createObstacle(trx, {
        type: 'POTHOLE',
        severity: 'MINOR',
        ...sidewalk.middle,
      });
      const resolved = await createObstacle(trx, {
        type: 'TREE',
        severity: 'MODERATE',
        ...sidewalk.middle,
      });
      await resolveObstacle(trx, resolved.properties.id);

      const ids = (features: { properties: { id: number } }[]) =>
        features.map((feature) => feature.properties.id);

      return {
        activeId: active.properties.id,
        resolvedId: resolved.properties.id,
        active: ids((await readObstacles(trx, 'ACTIVE')).features),
        resolved: ids((await readObstacles(trx, 'RESOLVED')).features),
        all: ids((await readObstacles(trx, 'ALL')).features),
      };
    });

    expect(outcome.active).toContain(outcome.activeId);
    expect(outcome.active).not.toContain(outcome.resolvedId);
    expect(outcome.resolved).toContain(outcome.resolvedId);
    expect(outcome.resolved).not.toContain(outcome.activeId);
    expect(outcome.all).toEqual(expect.arrayContaining([outcome.activeId, outcome.resolvedId]));
  });

  it('cuenta los reportes sin bajas ni rechazados', async () => {
    const outcome = await inRolledBackTransaction(async (trx) => {
      await importOsm(FIXTURE, trx);

      const sidewalk = await firstSidewalk(trx);
      const obstacle = await createObstacle(trx, {
        type: 'POTHOLE',
        severity: 'MINOR',
        ...sidewalk.middle,
      });
      const obstacleId = obstacle.properties.id;

      // Dos reportes apuntan al obstáculo y descuentan: uno pendiente y uno ya aprobado.
      await sql`
        INSERT INTO reports (type_id, severity, description, geom, status, obstacle_id)
        SELECT catalogue.id, 'MINOR', 'otro aviso del mismo pozo',
               ST_SetSRID(ST_MakePoint(${sidewalk.middle.lon}, ${sidewalk.middle.lat}), 4326),
               'PENDING', ${obstacleId}
        FROM obstacle_types catalogue
        WHERE catalogue.code = 'POTHOLE'
      `.execute(trx);
      await sql`
        INSERT INTO reports (type_id, severity, description, geom, status, obstacle_id)
        SELECT catalogue.id, 'MINOR', 'un tercero',
               ST_SetSRID(ST_MakePoint(${sidewalk.middle.lon}, ${sidewalk.middle.lat}), 4326),
               'APPROVED', ${obstacleId}
        FROM obstacle_types catalogue
        WHERE catalogue.code = 'POTHOLE'
      `.execute(trx);

      // Los que no cuentan: rechazado y dado de baja.
      await sql`
        INSERT INTO reports (type_id, severity, description, geom, status, obstacle_id)
        SELECT catalogue.id, 'MINOR', 'descartado',
               ST_SetSRID(ST_MakePoint(${sidewalk.middle.lon}, ${sidewalk.middle.lat}), 4326),
               'REJECTED', ${obstacleId}
        FROM obstacle_types catalogue
        WHERE catalogue.code = 'POTHOLE'
      `.execute(trx);
      await sql`
        INSERT INTO reports (type_id, severity, description, geom, status, obstacle_id, deleted_at)
        SELECT catalogue.id, 'MINOR', 'dado de baja',
               ST_SetSRID(ST_MakePoint(${sidewalk.middle.lon}, ${sidewalk.middle.lat}), 4326),
               'PENDING', ${obstacleId}, now()
        FROM obstacle_types catalogue
        WHERE catalogue.code = 'POTHOLE'
      `.execute(trx);

      const read = await readObstacles(trx, 'ACTIVE');
      const feature = read.features.find((candidate) => candidate.properties.id === obstacleId);

      return { feature, read };
    });

    expect(outcome.feature?.properties.reports_count).toBe(2);
  });

  it('devuelve el catálogo sin OTHER y con el nombre en español', async () => {
    const read = await inRolledBackTransaction((trx) =>
      readObstacles(trx, 'ACTIVE'),
    );

    const codes = read.obstacle_types.map((type) => type.code);
    expect(codes).not.toContain('OTHER');
    expect(read.obstacle_types).toContainEqual({ code: 'POTHOLE', name: 'Pozo' });
  });

  it('no devuelve un obstáculo dado de baja, en ningún estado', async () => {
    const outcome = await inRolledBackTransaction(async (trx) => {
      await importOsm(FIXTURE, trx);

      const sidewalk = await firstSidewalk(trx);
      const obstacle = await createObstacle(trx, {
        type: 'POTHOLE',
        severity: 'MINOR',
        ...sidewalk.middle,
      });

      await sql`UPDATE obstacles SET deleted_at = now() WHERE id = ${obstacle.properties.id}`.execute(
        trx,
      );

      const statuses = ['ACTIVE', 'RESOLVED', 'ALL'] as const;
      return {
        id: obstacle.properties.id,
        reads: await Promise.all(statuses.map((status) => readObstacles(trx, status))),
      };
    });

    for (const read of outcome.reads) {
      expect(read.features.map((feature) => feature.properties.id)).not.toContain(outcome.id);
    }
  });
});
