/**
 * El portal de moderación: barra con la sesión y el contenido de cada página.
 *
 * **Es el único consumidor de la sesión.** Llama a `getSession()` una vez, y ese
 * `if` es la única guarda del portal: el resto del portal no sabe cómo se resuelve
 * la sesión ([16 §4](../../docs/16-el-portal.md)).
 */

import { redirect } from 'next/navigation';
import { getSession } from '@/session/session';
import { Nav } from './nav';
import { Providers } from './providers';
import { logout } from '@/session/actions';

// Sin sesión no hay nada que mostrar: el layout la resuelve antes de responder.
export const instant = false;

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

        <Nav />

        <div className="flex items-center gap-3 text-sm text-slate-600">
          <span>{session.name}</span>
          <form action={logout}>
            <button
              type="submit"
              className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              Salir
            </button>
          </form>
        </div>
      </header>

      <main className="min-h-0 flex-1">
        <Providers>{children}</Providers>
      </main>
    </div>
  );
}
