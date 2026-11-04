import { z } from 'zod';

// Esquema representativo de la tabla USERS en PostgreSQL
export const UserProfileSchema = z.object({
  id: z.union([z.number(), z.string()]),
  name: z
    .string()
    .trim()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(50, 'El nombre no puede superar los 50 caracteres'),
  email: z.string().trim().email('Correo electrónico inválido').max(200),
  is_moderator: z.boolean().default(false),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  deleted_at: z.string().nullable().optional(),
});

export type UserProfile = z.infer<typeof UserProfileSchema>;

// DTO para crear un usuario (POST /api/users o registro)
export const CreateUserSchema = z.object({
  name: z.string().trim().min(2).max(50),
  email: z.string().trim().email().max(200),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  is_moderator: z.boolean().optional().default(false),
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;

// DTO para actualizar el perfil completo o campos específicos (PUT/PATCH /api/users/:id)
export const UpdateUserNameSchema = z.object({
  name: z.
    string()
    .trim()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(50, 'El nombre no puede superar los 50 caracteres')
    
  
});

export type UpdateUserNameInput = z.infer<typeof UpdateUserNameSchema>;