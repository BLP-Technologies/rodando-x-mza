import { type Kysely } from 'kysely';
import type { DB } from '../db/types.js';
import { ERROR_CODES } from '../http/error-codes.js';
import { HttpError } from '../http/errors.js';
import type { CreatePlaceDTO, UpdatePlaceDTO } from './places.schemas.js';
import {
  type RawPlaceRow,
  findDefaultUserId,
  checkUserExists,
  selectPlaces,
  selectPlaceById,
  insertPlaceRow,
  updatePlaceRow,
  deletePlaceRow,
} from './places.sql.js';

export interface PlaceModel {
  id: number;
  userId: number;
  name: string;
  address: string;
  category: string;
  latitude: number;
  longitude: number;
  createdAt: string;
  updatedAt: string;
}

const mapRowToPlace = (row: RawPlaceRow): PlaceModel => {
  const match = (row.description || '').match(/^\[(.*?)\]\s*(.*)$/);
  const category = (match && match[1]) ? match[1] : 'OTRO';
  const address = (match && match[2] !== undefined) ? match[2] : (row.description || '');

  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    address,
    category,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  };
};

export const listPlaces = async (db: Kysely<DB>, userId?: number): Promise<PlaceModel[]> => {
  const rows = await selectPlaces(db, userId);
  return rows.map(mapRowToPlace);
};

export const getPlaceById = async (db: Kysely<DB>, id: number): Promise<PlaceModel> => {
  const row = await selectPlaceById(db, id);
  if (!row) {
    throw new HttpError(404, ERROR_CODES.NOT_FOUND || 'NOT_FOUND', `Lugar con ID ${id} no encontrado`);
  }
  return mapRowToPlace(row);
};

export const createPlace = async (
  db: Kysely<DB>,
  data: CreatePlaceDTO,
  userId?: number,
): Promise<PlaceModel> => {
  const categoryTag = data.category ? `[${data.category}] ` : '';
  const fullDescription = `${categoryTag}${data.address}`.slice(0, 300);

  let targetUserId: number | null = userId ?? null;

  if (targetUserId) {
    const exists = await checkUserExists(db, targetUserId);
    if (!exists) targetUserId = null;
  }

  if (!targetUserId) {
    targetUserId = await findDefaultUserId(db);
    if (!targetUserId) {
      throw new HttpError(
        500,
        ERROR_CODES.INTERNAL_ERROR || 'INTERNAL_ERROR',
        'No se puede crear el lugar: no existe ningún usuario registrado en la tabla users.',
      );
    }
  }

  const row = await insertPlaceRow(db, {
    userId: targetUserId,
    name: data.name,
    description: fullDescription,
    lat: Number(data.latitude),
    lon: Number(data.longitude),
  });

  if (!row) {
    throw new HttpError(500, ERROR_CODES.INTERNAL_ERROR || 'INTERNAL_ERROR', 'No se pudo crear el lugar');
  }

  return mapRowToPlace(row);
};

export const updatePlace = async (
  db: Kysely<DB>,
  id: number,
  data: UpdatePlaceDTO,
): Promise<PlaceModel> => {
  const prev = await getPlaceById(db, id);

  const name = data.name !== undefined ? data.name : prev.name;
  const cat = data.category !== undefined ? data.category : prev.category;
  const addr = data.address !== undefined ? data.address : prev.address;
  const fullDesc = `[${cat}] ${addr}`.slice(0, 300);

  const lat = data.latitude !== undefined ? Number(data.latitude) : prev.latitude;
  const lon = data.longitude !== undefined ? Number(data.longitude) : prev.longitude;

  const row = await updatePlaceRow(db, {
    id,
    name,
    description: fullDesc,
    lat,
    lon,
  });

  if (!row) {
    throw new HttpError(404, ERROR_CODES.NOT_FOUND || 'NOT_FOUND', `Lugar con ID ${id} no encontrado para actualizar`);
  }

  return mapRowToPlace(row);
};

export const deletePlace = async (db: Kysely<DB>, id: number) => {
  const deleted = await deletePlaceRow(db, id);
  if (!deleted) {
    throw new HttpError(404, ERROR_CODES.NOT_FOUND || 'NOT_FOUND', `Lugar con ID ${id} no encontrado`);
  }
  return { success: true, id };
};