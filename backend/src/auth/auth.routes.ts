import { Router } from 'express';
import { getDb } from '../db/index.js';
import { ERROR_CODES } from '../http/error-codes.js';
import { validationDetails } from '../http/error-response.js';
import { HttpError } from '../http/errors.js';
import { getAuth, requireAuth } from './auth.middleware.js';
import { loginRequestSchema, registerRequestSchema } from './auth.schemas.js';
import { login, logout, register } from './auth.service.js';

/**
 * Rutas de autenticación, montadas en `/api/auth`: registro (C001), inicio de sesión
 * (C002), perfil y cierre de sesión.
 *
 * Cada ruta valida la forma del pedido y delega el resto en el servicio. Express 5
 * reenvía sola la promesa rechazada al manejador de errores.
 */
export const authRouter = Router();

/** Crea una cuenta. Responde `201` con la cuenta, sin abrir sesión. */
authRouter.post('/register', async (req, res) => {
  const body: unknown = req.body ?? {};
  const parsed = registerRequestSchema.safeParse(body);

  if (!parsed.success) {
    throw new HttpError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      'invalid register request',
      validationDetails(parsed.error, body),
    );
  }

  res.status(201).json({ user: await register(getDb(), parsed.data) });
});

/** Inicia sesión. Responde con el token, que el cliente manda después como `Bearer`. */
authRouter.post('/login', async (req, res) => {
  const body: unknown = req.body ?? {};
  const parsed = loginRequestSchema.safeParse(body);

  if (!parsed.success) {
    throw new HttpError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      'invalid login request',
      validationDetails(parsed.error, body),
    );
  }

  res.json(await login(getDb(), parsed.data));
});

/** La cuenta dueña del token. */
authRouter.get('/me', requireAuth, (_req, res) => {
  res.json({ user: getAuth(res).user });
});

/** Cierra la sesión del token: desde ahora ese token ya no sirve. */
authRouter.post('/logout', requireAuth, async (_req, res) => {
  await logout(getDb(), getAuth(res).token);
  res.status(204).end();
});
