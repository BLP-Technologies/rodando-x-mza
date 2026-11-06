'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { apiPost } from '@/api/client';
import { API_URL } from '@/config';
import { describeLoginError, NOT_MODERATOR_MESSAGE } from './login-errors';
import { describeRegisterError } from './register-errors';
import { SESSION_COOKIE, type ApiUser } from './session';

// Lo mismo que dura la sesión en el backend.
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

type ActionResult = { error: string } | { ok: true };

async function closeApiSession(token: string): Promise<void> {
  try {
    await fetch(new URL('/api/auth/logout', API_URL), {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
    });
  } catch (error) {
    console.error('Could not close the session in the API', error);
  }
}

// No redirige: con `redirect`, Next repite la redirección oculta de `/` a `/login`.
// Si sale bien, el formulario hace una carga completa de `/`.
export async function login(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  let result: { token: string; user: ApiUser };

  try {
    result = await apiPost('/api/auth/login', {
      email: formData.get('email'),
      password: formData.get('password'),
    });
  } catch (error) {
    return { error: describeLoginError(error) };
  }

  // El backend acepta cualquier cuenta: que sea moderadora lo exige el portal.
  if (!result.user.is_moderator) {
    await closeApiSession(result.token);
    return { error: NOT_MODERATOR_MESSAGE };
  }

  (await cookies()).set(SESSION_COOKIE, result.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return { ok: true };
}

// El registro no abre sesión ni da permisos de moderación: eso lo define el backend.
export async function register(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await apiPost('/api/auth/register', {
      name: formData.get('name'),
      email: formData.get('email'),
      password: formData.get('password'),
    });
  } catch (error) {
    return { error: describeRegisterError(error) };
  }

  return { ok: true };
}

export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) await closeApiSession(token);

  cookieStore.delete(SESSION_COOKIE);
  redirect('/login');
}
