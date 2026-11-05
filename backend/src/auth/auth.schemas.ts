import { z } from 'zod';

/**
 * El contrato de `/api/auth`, en esquemas Zod: registro (C001), inicio de sesión (C002),
 * perfil y cierre de sesión.
 *
 * Es la única fuente: de acá salen los tipos del backend, la validación de los pedidos y
 * el contrato que leen los clientes ([02 §6](../../../docs/02-stack-y-estructura.md)). Los
 * paths se publican en `openapi.ts`.
 */

/**
 * El email se limpia antes de validarlo: sin espacios y en minúsculas, porque el único de
 * la tabla es `lower(email)` y así "Ana@Mail.com" y "ana@mail.com" son la misma cuenta.
 * El tope es el de la columna (`varchar(200)`). El formato se declara aparte para el
 * `OpenAPI`: con `pipe` el generador sólo ve el texto de entrada.
 */
const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(200)
  .pipe(z.email())
  .meta({ format: 'email' });

export const registerRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(50),
    email: emailSchema,
    // Mínimo 8, igual que la app. El tope evita hashear textos enormes a propósito.
    password: z.string().min(8).max(128),
  })
  .meta({
    id: 'RegisterRequest',
    description: 'Datos para crear una cuenta.',
    example: { name: 'Ana Pérez', email: 'ana@example.com', password: 'una-clave-larga' },
  });

/**
 * En el inicio de sesión no se repite la política de la contraseña: si no cumple, igual
 * es una credencial incorrecta, y validarla acá le diría al cliente cuál es la regla.
 */
export const loginRequestSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1),
  })
  .meta({
    id: 'LoginRequest',
    description: 'Credenciales para iniciar sesión.',
    example: { email: 'ana@example.com', password: 'una-clave-larga' },
  });

/** La cuenta tal como la ve un cliente. Nunca incluye el hash de la contraseña. */
const userSchema = z
  .object({
    id: z.number().int(),
    name: z.string(),
    email: z.string(),
    is_moderator: z.boolean(),
  })
  .meta({ id: 'User' });

export const userResponseSchema = z.object({ user: userSchema }).meta({ id: 'UserResponse' });

export const loginResponseSchema = z
  .object({ token: z.string(), user: userSchema })
  .meta({ id: 'LoginResponse' });

export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type User = z.infer<typeof userSchema>;
export type LoginResponse = z.infer<typeof loginResponseSchema>;
