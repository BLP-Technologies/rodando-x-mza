import { z } from 'zod';

export const PLACE_CATEGORIES = [
  'CASA',
  'TRABAJO',
  'ESTUDIO',
  'MEDICO',
  'RECREATIVO',
  'OTRO',
] as const;

export type PlaceCategory = (typeof PLACE_CATEGORIES)[number];

export const PlaceSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres'),
  address: z.string().trim().min(4, 'La dirección es requerida'),
  category: z.enum(PLACE_CATEGORIES, {
    message: 'Selecciona una categoría válida',
  }),
  latitude: z.number(),
  longitude: z.number(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

export type Place = z.infer<typeof PlaceSchema> & {
  id: string;
};

export type CreatePlaceInput = Omit<Place, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdatePlaceInput = Partial<CreatePlaceInput>;