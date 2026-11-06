/**
 * La sesión del portal, en un solo módulo.
 *
 * El token de `POST /api/auth/login` vive en una cookie `httpOnly`
 * ([20](../../docs/20-autenticacion.md)): el JavaScript del navegador no lo puede
 * leer, y estos pedidos salen del servidor de Next, no del navegador.
 *
 * **Un solo consumidor.** `app/(portal)/layout.tsx` llama a `getSession()` una
 * vez y es la única guarda del portal. Ninguna otra parte del código consulta ni
 * deduce la sesión: si aparece otro consumidor, hay dos lugares que mantener (y
 * uno se olvida).
 */

import { cookies } from 'next/headers';
import { unstable_rethrow } from 'next/navigation';
import { API_URL } from '@/config';

export type Session = {
  id: number;
  name: string;
  email: string;
  isModerator: boolean;
};

/** Tipado a mano: las rutas de auth todavía no están en `schema.d.ts`. */
export type ApiUser = {
  id: number;
  name: string;
  email: string;
  is_moderator: boolean;
};

/** El nombre de la cookie que guarda el token. */
export const SESSION_COOKIE = 'rodando_session';

/** La sesión del pedido, o `null` si no hay una válida. */
export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  let response: Response;

  try {
    response = await fetch(new URL('/api/auth/me', API_URL), {
      headers: { accept: 'application/json', authorization: `Bearer ${token}` },
    });
  } catch (error) {
    // Next corta este fetch a propósito al prerenderizar: no es una API caída.
    unstable_rethrow(error);
    console.error('Could not reach the API to read the session', error);
    return null;
  }

  if (!response.ok) {
    if (response.status !== 401) {
      console.error(`Unexpected status reading the session: ${response.status}`);
    }
    return null;
  }
  
  const { user } = (await response.json()) as { user: ApiUser };
  if (!user.is_moderator) return null;

  return { id: user.id, name: user.name, email: user.email, isModerator: true };
}
