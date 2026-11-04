'use client';

/**
 * La navegación del portal: una entrada por pantalla.
 *
 * Son dos —el mapa y los reportes—. El mapa es uno solo con tres herramientas adentro: las
 * pestañas no son secciones, así que no tienen entrada propia. La barra no anuncia lo que
 * falta, porque una sección que se clickea y no lleva a nada es peor que una que no está. El
 * estado activo se marca con `aria-current` y con el estilo, para que no dependa del color.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'Mapa' },
  { href: '/reports', label: 'Reportes' },
] as const;

export function Nav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Secciones del portal" className="flex items-center gap-1">
      {LINKS.map((link) => {
        // El mapa es la raíz exacta; los reportes, su rama entera.
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
