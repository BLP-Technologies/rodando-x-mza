import { ApiError, NETWORK_ERROR } from '@/api/client';

const GENERIC_MESSAGE = 'No se pudo crear la cuenta.';

const MESSAGES: Record<string, string> = {
  [NETWORK_ERROR]: 'No se pudo conectar con la API. Revisá que el backend esté levantado.',
  CONFLICT: 'Ese correo ya está registrado.',
  VALIDATION_ERROR:
    'Revisá los datos: el nombre no puede estar vacío y la contraseña debe tener al menos 8 caracteres.',
  INTERNAL_ERROR: 'La API falló al crear la cuenta. Probá de nuevo.',
};

export function describeRegisterError(error: unknown): string {
  if (!(error instanceof ApiError)) return GENERIC_MESSAGE;

  return MESSAGES[error.code] ?? GENERIC_MESSAGE;
}
