import { Router } from 'express';
import { getDb } from '../db/index.js';
import { ERROR_CODES } from '../http/error-codes.js';
import { validationDetails } from '../http/error-response.js';
import { HttpError } from '../http/errors.js';
import {
  placeIdParamSchema,
  createPlaceBodySchema,
  updatePlaceBodySchema,
} from './places.schemas.js';
import {
  listPlaces,
  getPlaceById,
  createPlace,
  updatePlace,
  deletePlace,
} from './places.service.js';

export const placesRouter = Router();

// GET /api/places
placesRouter.get('/', async (_req, res) => {
  const places = await listPlaces(getDb());
  res.json(places);
});

// GET /api/places/:id
placesRouter.get('/:id', async (req, res) => {
  const parsedParams = placeIdParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    throw new HttpError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      'Parámetro de ID no válido',
      validationDetails(parsedParams.error, req.params),
    );
  }

  const place = await getPlaceById(getDb(), parsedParams.data.id);
  res.json(place);
});

// POST /api/places
placesRouter.post('/', async (req, res) => {
  const body: unknown = req.body ?? {};
  const parsed = createPlaceBodySchema.safeParse(body);

  if (!parsed.success) {
    throw new HttpError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      'Cuerpo de creación de lugar inválido',
      validationDetails(parsed.error, body),
    );
  }

  const newPlace = await createPlace(getDb(), parsed.data);
  res.status(201).json(newPlace);
});

// PUT o PATCH /api/places/:id
placesRouter.patch('/:id', async (req, res) => {
  const parsedParams = placeIdParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    throw new HttpError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      'Parámetro de ID no válido',
      validationDetails(parsedParams.error, req.params),
    );
  }

  const body: unknown = req.body ?? {};
  const parsedBody = updatePlaceBodySchema.safeParse(body);
  if (!parsedBody.success) {
    throw new HttpError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      'Cuerpo de actualización de lugar inválido',
      validationDetails(parsedBody.error, body),
    );
  }

  const updated = await updatePlace(getDb(), parsedParams.data.id, parsedBody.data);
  res.json(updated);
});

// DELETE /api/places/:id
placesRouter.delete('/:id', async (req, res) => {
  const parsedParams = placeIdParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    throw new HttpError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      'Parámetro de ID no válido',
      validationDetails(parsedParams.error, req.params),
    );
  }

  await deletePlace(getDb(), parsedParams.data.id);
  res.status(204).end();
});