import { ApiError, NETWORK_ERROR } from '@/api/client';

export const NOT_MODERATOR_MESSAGE = 'Esta cuenta no tiene permisos de moderación.';

const GENERIC_MESSAGE = 'No se pudo iniciar sesión.';

// El mismo texto para un correo que no existe y una clave incorrecta: la API no los distingue a propósito.
const MESSAGES: Record<string, string> = {
  [NETWORK_ERROR]: 'No se pudo conectar con la API. Revisá que el backend esté levantado.',
  UNAUTHENTICATED: 'El correo o la contraseña son incorrectos.',
  VALIDATION_ERROR: 'Revisá el correo y la contraseña.',
  INTERNAL_ERROR: 'La API falló al iniciar sesión. Probá de nuevo.',
};

export function describeLoginError(error: unknown): string {
  if (!(error instanceof ApiError)) return GENERIC_MESSAGE;

  return MESSAGES[error.code] ?? GENERIC_MESSAGE;
}
