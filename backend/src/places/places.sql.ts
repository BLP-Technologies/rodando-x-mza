import { sql, type Kysely } from 'kysely';
import type { DB } from '../db/types.js';

export interface RawPlaceRow {
  id: number;
  user_id: number;
  name: string;
  description: string | null;
  latitude: number | string;
  longitude: number | string;
  created_at: Date;
  updated_at: Date;
}

export type InsertPlaceRowInput = {
  userId: number;
  name: string;
  description: string;
  lon: number;
  lat: number;
};

export type UpdatePlaceRowInput = {
  id: number;
  name: string;
  description: string;
  lon: number;
  lat: number;
};

export async function findDefaultUserId(db: Kysely<DB>): Promise<number | null> {
  const result = await sql<{ id: number }>`
    SELECT id FROM users ORDER BY id ASC LIMIT 1
  `.execute(db);
  return result.rows[0]?.id ?? null;
}

export async function checkUserExists(db: Kysely<DB>, userId: number): Promise<boolean> {
  const result = await sql<{ id: number }>`
    SELECT id FROM users WHERE id = ${userId}
  `.execute(db);
  return result.rows.length > 0;
}

export async function selectPlaces(db: Kysely<DB>, userId?: number): Promise<RawPlaceRow[]> {
  let query = sql<RawPlaceRow>`
    SELECT id, user_id, name, description,
           ST_Y(geom) AS latitude,
           ST_X(geom) AS longitude,
           created_at, updated_at
    FROM user_places
  `;

  if (userId !== undefined) {
    query = sql<RawPlaceRow>`${query} WHERE user_id = ${userId}`;
  }

  query = sql<RawPlaceRow>`${query} ORDER BY id DESC`;
  const result = await query.execute(db);
  return result.rows;
}

export async function selectPlaceById(db: Kysely<DB>, id: number): Promise<RawPlaceRow | null> {
  const result = await sql<RawPlaceRow>`
    SELECT id, user_id, name, description,
           ST_Y(geom) AS latitude,
           ST_X(geom) AS longitude,
           created_at, updated_at
    FROM user_places
    WHERE id = ${id}
  `.execute(db);

  return result.rows[0] ?? null;
}

export async function insertPlaceRow(
  db: Kysely<DB>,
  input: InsertPlaceRowInput,
): Promise<RawPlaceRow | null> {
  const result = await sql<RawPlaceRow>`
    INSERT INTO user_places (
      name,
      description,
      geom,
      user_id,
      created_at,
      updated_at
    )
    VALUES (
      ${input.name},
      ${input.description},
      ST_SetSRID(ST_MakePoint(${input.lon}, ${input.lat}), 4326),
      ${input.userId},
      NOW(),
      NOW()
    )
    RETURNING id, user_id, name, description,
              ST_Y(geom) AS latitude,
              ST_X(geom) AS longitude,
              created_at, updated_at
  `.execute(db);

  return result.rows[0] ?? null;
}

export async function updatePlaceRow(
  db: Kysely<DB>,
  input: UpdatePlaceRowInput,
): Promise<RawPlaceRow | null> {
  const result = await sql<RawPlaceRow>`
    UPDATE user_places
    SET name = ${input.name},
        description = ${input.description},
        geom = ST_SetSRID(ST_MakePoint(${input.lon}, ${input.lat}), 4326),
        updated_at = NOW()
    WHERE id = ${input.id}
    RETURNING id, user_id, name, description,
              ST_Y(geom) AS latitude,
              ST_X(geom) AS longitude,
              created_at, updated_at
  `.execute(db);

  return result.rows[0] ?? null;
}

export async function deletePlaceRow(db: Kysely<DB>, id: number): Promise<boolean> {
  const result = await sql`
    DELETE FROM user_places
    WHERE id = ${id}
  `.execute(db);

  return Number(result.numAffectedRows ?? 0) > 0;
}