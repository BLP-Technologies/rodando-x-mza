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
  id: z.union([z.string(), z.number()]).optional(),
  userId: z.number().optional(), // user_id FK en PostgreSQL
  name: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres'),
  address: z.string().trim().min(4, 'La dirección es requerida'),
  category: z.enum(PLACE_CATEGORIES, {
    message: 'Selecciona una categoría válida',
  }),
  latitude: z.number(),
  longitude: z.number(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type Place = z.infer<typeof PlaceSchema> & {
  id: string | number;
};

export type CreatePlaceInput = Omit<Place, 'id' | 'createdAt' | 'updatedAt' | 'userId'>;
export type UpdatePlaceInput = Partial<CreatePlaceInput>;