'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log({ email });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-xs text-slate-600">
        Ingresá tu correo electrónico para recibir las instrucciones de recuperación.
      </p>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Correo electrónico
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu-correo@ejemplo.com"
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <button
        type="submit"
        className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm transition-colors"
      >
        Enviar enlace
      </button>

      <div className="text-center mt-2">
        <Link href="/login" className="text-xs text-slate-500 hover:underline">
          Cancelar y volver
        </Link>
      </div>
    </form>
  );
}