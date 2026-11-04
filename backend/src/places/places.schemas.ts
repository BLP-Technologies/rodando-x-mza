import { z } from 'zod';

export const PLACE_CATEGORIES = [
  'CASA',
  'TRABAJO',
  'ESTUDIO',
  'MEDICO',
  'RECREATIVO',
  'OTRO',
] as const;

export const placeIdParamSchema = z.object({
  id: z.coerce.number().int().positive('El ID del lugar debe ser un entero positivo'),
});

export const createPlaceBodySchema = z.object({
  name: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres'),
  address: z.string().trim().min(4, 'La dirección es requerida'),
  category: z.enum(PLACE_CATEGORIES, {
    message: 'Categoría no válida',
  }),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const updatePlaceBodySchema = createPlaceBodySchema.partial();

export type CreatePlaceDTO = z.infer<typeof createPlaceBodySchema>;
export type UpdatePlaceDTO = z.infer<typeof updatePlaceBodySchema>;