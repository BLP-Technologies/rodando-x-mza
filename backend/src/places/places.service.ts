import { sql, type Kysely } from 'kysely';
import type { DB } from '../db/types.js';
import { ERROR_CODES } from '../http/error-codes.js';
import { HttpError } from '../http/errors.js';
import type { CreatePlaceDTO, UpdatePlaceDTO } from './places.schemas.js';

interface RawPlaceRow {
  id: number;
  user_id: number | null;
  name: string;
  description: string | null;
  latitude: number | string;
  longitude: number | string;
  created_at: string | Date;
  updated_at: string | Date;
}

const mapRowToPlace = (row: RawPlaceRow) => {
  const match = (row.description || '').match(/^\[(.*?)\]\s*(.*)$/);
  const category = match ? match[1] : 'OTRO';
  const address = match ? match[2] : (row.description || '');

  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    address,
    category,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    createdAt: typeof row.created_at === 'object' ? row.created_at.toISOString() : String(row.created_at),
    updatedAt: typeof row.updated_at === 'object' ? row.updated_at.toISOString() : String(row.updated_at),
  };
};

export const listPlaces = async (db: Kysely<DB>, userId?: number) => {
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
  return result.rows.map(mapRowToPlace);
};

export const getPlaceById = async (db: Kysely<DB>, id: number) => {
  const result = await sql<RawPlaceRow>`
    SELECT id, user_id, name, description,
           ST_Y(geom) AS latitude,
           ST_X(geom) AS longitude,
           created_at, updated_at
    FROM user_places
    WHERE id = ${id}
  `.execute(db);

  const row = result.rows[0];
  if (!row) {
    throw new HttpError(404, ERROR_CODES.NOT_FOUND || 'NOT_FOUND', `Lugar con ID ${id} no encontrado`);
  }

  return mapRowToPlace(row);
};

export const createPlace = async (db: Kysely<DB>, data: CreatePlaceDTO, userId?: number) => {
  const categoryTag = data.category ? `[${data.category}] ` : '';
  const fullDescription = `${categoryTag}${data.address}`.slice(0, 300);

  // 1. Buscamos un usuario real para cumplir la restricción NOT NULL de user_id
  let targetUserId: number | null = userId ?? null;

  if (targetUserId) {
    const userCheck = await sql<{ id: number }>`
      SELECT id FROM users WHERE id = ${targetUserId}
    `.execute(db);
    if (userCheck.rows.length === 0) {
      targetUserId = null;
    }
  }

  // Si no vino userId o no existe, usamos el primer usuario registrado en la base
  if (!targetUserId) {
    const defaultUser = await sql<{ id: number }>`
      SELECT id FROM users ORDER BY id ASC LIMIT 1
    `.execute(db);

    if (defaultUser.rows.length === 0) {
      throw new HttpError(
        500,
        ERROR_CODES.INTERNAL_ERROR || 'INTERNAL_ERROR',
        'No se puede crear el lugar: no existe ningún usuario registrado en la tabla users.'
      );
    }

    if (!targetUserId) {
    const defaultUser = await sql<{ id: number }>`
      SELECT id FROM users ORDER BY id ASC LIMIT 1
    `.execute(db);

    const firstRow = defaultUser.rows[0];
    if (!firstRow) {
      throw new HttpError(
        500,
        ERROR_CODES.INTERNAL_ERROR || 'INTERNAL_ERROR',
        'No se puede crear el lugar: no existe ningún usuario registrado en la tabla users.'
      );
    }

    targetUserId = firstRow.id;
  }
  }

  const lat = Number(data.latitude);
  const lon = Number(data.longitude);

  // 2. Insertamos con targetUserId garantizado (no null)
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
      ${data.name},
      ${fullDescription},
      ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326),
      ${targetUserId},
      NOW(),
      NOW()
    )
    RETURNING id, user_id, name, description,
              ST_Y(geom) AS latitude,
              ST_X(geom) AS longitude,
              created_at, updated_at
  `.execute(db);

  const createdRow = result.rows[0];
  if (!createdRow) {
    throw new HttpError(500, ERROR_CODES.INTERNAL_ERROR || 'INTERNAL_ERROR', 'No se pudo crear el lugar');
  }

  return mapRowToPlace(createdRow);
};

export const updatePlace = async (db: Kysely<DB>, id: number, data: UpdatePlaceDTO) => {
  const prev = await getPlaceById(db, id);

  const name = data.name !== undefined ? data.name : prev.name;
  const cat = data.category !== undefined ? data.category : prev.category;
  const addr = data.address !== undefined ? data.address : prev.address;
  const fullDesc = `[${cat}] ${addr}`.slice(0, 300);

  const lat = data.latitude !== undefined ? data.latitude : prev.latitude;
  const lon = data.longitude !== undefined ? data.longitude : prev.longitude;

  const result = await sql<RawPlaceRow>`
    UPDATE user_places
    SET name = ${name},
        description = ${fullDesc},
        geom = ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326),
        updated_at = NOW()
    WHERE id = ${id}
    RETURNING id, user_id, name, description,
              ST_Y(geom) AS latitude,
              ST_X(geom) AS longitude,
              created_at, updated_at
  `.execute(db);

  const updatedRow = result.rows[0];
  if (!updatedRow) {
    throw new HttpError(404, ERROR_CODES.NOT_FOUND || 'NOT_FOUND', `Lugar con ID ${id} no encontrado para actualizar`);
  }

  return mapRowToPlace(updatedRow);
};

export const deletePlace = async (db: Kysely<DB>, id: number) => {
  const result = await sql`
    DELETE FROM user_places
    WHERE id = ${id}
  `.execute(db);

  if (Number(result.numAffectedRows ?? 0) === 0) {
    throw new HttpError(404, ERROR_CODES.NOT_FOUND || 'NOT_FOUND', `Lugar con ID ${id} no encontrado`);
  }

  return { success: true, id };
};