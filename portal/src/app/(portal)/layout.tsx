/**
 * El portal de moderación: barra con la sesión y el contenido de cada página.
 *
 * **Es el único consumidor de la sesión.** Llama a `getSession()` una vez, y ese
 * `if` es la única guarda del portal: cuando `getSession` llame al auth real, el
 * resto del portal no se entera ([16 §4](../../docs/16-el-portal.md)).
 */

import { redirect } from 'next/navigation';
import { getSession } from '@/session/session';
import { Providers } from './providers';

export default async function PortalLayout({ children }: LayoutProps<'/'>) {
  const session = await getSession();

  if (!session) redirect('/login');

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">Portal de moderación</h1>
          <p className="text-xs text-slate-500">Grafo peatonal del microcentro</p>
        </div>

        <div className="flex items-center gap-3 text-sm text-slate-600">
          <span>{session.name}</span>
          {/* La marca de sesión simulada no es adorno: mientras no haya auth,
              nadie tiene que confundir este moderador con un login real. */}
          <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
            sesión simulada
          </span>
        </div>
      </header>

      <main className="min-h-0 flex-1">
        <Providers>{children}</Providers>
      </main>
    </div>
  );
}
