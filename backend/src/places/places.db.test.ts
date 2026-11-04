import { afterAll, describe, expect, it } from 'vitest';
import { getDb } from '../db/index.js';
import { inRolledBackTransaction } from '../db/test-transaction.js';
import {
  findDefaultUserId,
  checkUserExists,
  insertPlaceRow,
  selectPlaceById,
  selectPlaces,
  updatePlaceRow,
  deletePlaceRow,
} from './places.sql.js';

describe.skipIf(!process.env.DATABASE_URL)('places.sql contra la base de datos', () => {
  afterAll(async () => {
    await getDb().destroy();
  });

  it('encuentra el id del usuario por defecto y valida su existencia', async () => {
    await inRolledBackTransaction(async (trx) => {
      const defaultUserId = await findDefaultUserId(trx);
      expect(defaultUserId).not.toBeNull();
      expect(typeof defaultUserId).toBe('number');

      const exists = await checkUserExists(trx, defaultUserId!);
      expect(exists).toBe(true);

      const nonExistent = await checkUserExists(trx, 999999);
      expect(nonExistent).toBe(false);
    });
  });

  it('inserta un lugar persistiendo coordenadas geográficas en PostGIS y lo recupera por id', async () => {
    await inRolledBackTransaction(async (trx) => {
      const userId = (await findDefaultUserId(trx))!;

      const inserted = await insertPlaceRow(trx, {
        userId,
        name: 'Plaza Independencia',
        description: '[PARQUE] Chile y Espejo',
        lat: -32.88945,
        lon: -68.84583,
      });

      expect(inserted).not.toBeNull();
      expect(inserted?.id).toBeGreaterThan(0);
      expect(inserted?.name).toBe('Plaza Independencia');
      expect(inserted?.description).toBe('[PARQUE] Chile y Espejo');
      expect(Number(inserted?.latitude)).toBeCloseTo(-32.88945, 4);
      expect(Number(inserted?.longitude)).toBeCloseTo(-68.84583, 4);

      const fetched = await selectPlaceById(trx, inserted!.id);
      expect(fetched).not.toBeNull();
      expect(fetched?.id).toBe(inserted?.id);
      expect(fetched?.name).toBe('Plaza Independencia');
    });
  });

  it('lista los lugares filtrados por usuario y ordenados descendentemente', async () => {
    await inRolledBackTransaction(async (trx) => {
      const userId = (await findDefaultUserId(trx))!;

      const p1 = await insertPlaceRow(trx, {
        userId,
        name: 'Lugar 1',
        description: 'Desc 1',
        lat: -32.89,
        lon: -68.84,
      });

      const p2 = await insertPlaceRow(trx, {
        userId,
        name: 'Lugar 2',
        description: 'Desc 2',
        lat: -32.891,
        lon: -68.841,
      });

      const list = await selectPlaces(trx, userId);
      expect(list.length).toBeGreaterThanOrEqual(2);

      const ids = list.map((item) => item.id);
      expect(ids.indexOf(p2!.id)).toBeLessThan(ids.indexOf(p1!.id));
    });
  });

  it('actualiza un lugar existente modificando datos y geometría', async () => {
    await inRolledBackTransaction(async (trx) => {
      const userId = (await findDefaultUserId(trx))!;

      const inserted = await insertPlaceRow(trx, {
        userId,
        name: 'Nombre Original',
        description: '[ORIGINAL] Calle Falsa 123',
        lat: -32.89,
        lon: -68.84,
      });

      const updated = await updatePlaceRow(trx, {
        id: inserted!.id,
        name: 'Nombre Editado',
        description: '[EDITADO] San Martín 456',
        lat: -32.895,
        lon: -68.845,
      });

      expect(updated).not.toBeNull();
      expect(updated?.name).toBe('Nombre Editado');
      expect(updated?.description).toBe('[EDITADO] San Martín 456');
      expect(Number(updated?.latitude)).toBeCloseTo(-32.895, 4);
      expect(Number(updated?.longitude)).toBeCloseTo(-68.845, 4);
    });
  });

  it('elimina un lugar y retorna false al intentar borrar uno inexistente', async () => {
    await inRolledBackTransaction(async (trx) => {
      const userId = (await findDefaultUserId(trx))!;

      const inserted = await insertPlaceRow(trx, {
        userId,
        name: 'A Eliminar',
        description: 'Temp',
        lat: -32.89,
        lon: -68.84,
      });

      const deleted = await deletePlaceRow(trx, inserted!.id);
      expect(deleted).toBe(true);

      const postDelete = await selectPlaceById(trx, inserted!.id);
      expect(postDelete).toBeNull();

      const deleteAgain = await deletePlaceRow(trx, inserted!.id);
      expect(deleteAgain).toBe(false);
    });
  });
});