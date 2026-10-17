import React from 'react';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-md border border-slate-200 p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-slate-800">Portal de Moderación</h1>
          <p className="text-sm text-slate-500 mt-1">Gestión y control de reportes urbanos</p>
        </div>
        {children}
      </div>
    </div>
  );
}