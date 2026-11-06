'use client';

import { useActionState, useEffect, useState } from 'react';
import Link from 'next/link';
import { login } from '@/session/actions';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [result, formAction, pending] = useActionState(login, null);
  const error = result && 'error' in result ? result.error : null;
  const loggedIn = result !== null && 'ok' in result;

  // Carga completa a propósito: ver `login` en `session/actions.ts`.
  useEffect(() => {
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- ver arriba
    if (loggedIn) window.location.assign('/');
  }, [loggedIn]);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Correo electrónico</label>
        <input
          name="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="moderador@ejemplo.com"
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <div className="flex justify-between items-center mb-1">
          <label className="block text-sm font-medium text-slate-700">Contraseña</label>
          <Link href="/reset-password" className="text-xs text-blue-600 hover:underline">
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
        <input
          name="password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending || loggedIn}
        className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium rounded-lg text-sm transition-colors"
      >
        {pending || loggedIn ? 'Ingresando…' : 'Ingresar'}
      </button>

      <div className="text-center mt-4">
        <span className="text-xs text-slate-500">¿No tenés cuenta de moderador? </span>
        <Link href="/register" className="text-xs text-blue-600 font-medium hover:underline">
          Crear cuenta
        </Link>
      </div>
    </form>
  );
}
