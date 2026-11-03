'use client';

/**
 * La navegación del portal: una entrada por objeto de trabajo.
 *
 * Hoy son dos —el grafo y los reportes— porque son las dos pantallas que existen: los
 * obstáculos y el cálculo de ruta entran cuando tengan su pantalla, no antes
 * ([16 §8](../../docs/16-el-portal.md)). El estado activo se marca con `aria-current`
 * y con el estilo, para que no dependa del color.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'Grafo' },
  { href: '/reports', label: 'Reportes' },
] as const;

export function Nav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Secciones del portal" className="flex items-center gap-1">
      {LINKS.map((link) => {
        // El grafo es la raíz exacta; el resto, su rama entera.
        const isActive =
          link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={isActive ? 'page' : undefined}
            className={
              isActive
                ? 'rounded bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-900'
                : 'rounded px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
