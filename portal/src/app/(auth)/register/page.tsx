'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { register } from '@/session/actions';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [result, formAction, pending] = useActionState(register, null);
  const error = result && 'error' in result ? result.error : null;

  if (result && 'ok' in result) {
    return (
      <div className="space-y-4 text-center">
        <p role="status" className="text-sm text-slate-700">
          Cuenta creada. Ya podés iniciar sesión.
        </p>
        {/* Carga completa: con `Link`, Next conserva esta pantalla y al volver seguiría este cartel. */}
        <a href="/login" className="text-xs text-blue-600 font-medium hover:underline">
          Ir a iniciar sesión
        </a>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Nombre completo
        </label>
        <input
          name="name"
          type="text"
          required
          maxLength={50}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tu nombre"
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Correo electrónico
        </label>
        <input
          name="email"
          type="email"
          required
          maxLength={200}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu-correo@ejemplo.com"
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Contraseña
        </label>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          maxLength={128}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mínimo 8 caracteres"
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
        disabled={pending}
        className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium rounded-lg text-sm transition-colors"
      >
        {pending ? 'Creando cuenta…' : 'Registrarme'}
      </button>

      <div className="text-center mt-4">
        <span className="text-xs text-slate-500">¿Ya tenés cuenta? </span>
        <Link href="/login" className="text-xs text-blue-600 font-medium hover:underline">
          Iniciá sesión
        </Link>
      </div>
    </form>
  );
}
