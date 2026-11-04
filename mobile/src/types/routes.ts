import { z } from 'zod';

export const RoutePointSchema = z.object({
  name: z.string().min(1, 'El nombre del punto es requerido'),
  address: z.string().optional(),
  latitude: z.number({ message: 'La latitud es requerida' }),
  longitude: z.number({ message: 'La longitud es requerida' }),
  placeId: z.string().nullable().optional(),
});
export const CoordinatePairSchema = z.tuple([z.number(), z.number()]); // [latitude, longitude]

export const RouteSchema = z.object({
  id: z.union([z.string(), z.number()]),
  userId: z.number().optional(), // user_id FK en PostgreSQL
  name: z.string().min(3, 'El nombre del recorrido debe tener al menos 3 caracteres'),
  origin: RoutePointSchema,
  destination: RoutePointSchema,
  distanceMeters: z.number().nonnegative(),
  durationMinutes: z.number().positive(),
  accessibilityScore: z.number().min(0).max(100).optional(),
  coordinates: z.array(CoordinatePairSchema).min(2, 'Debe contener al menos origen y destino'),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type RoutePoint = z.infer<typeof RoutePointSchema>;
export type Route = z.infer<typeof RouteSchema>;
export type CreateRouteInput = Omit<Route, 'id' | 'createdAt' | 'updatedAt' | 'userId'>;
export type UpdateRouteInput = Partial<CreateRouteInput>;