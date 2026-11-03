'use client';

/**
 * El montaje de la pantalla de reportes: la frontera entre los dos mundos.
 *
 * Es el molde de `map-panel.tsx` y existe por la misma razón: el build del portal corre
 * en CI, donde no hay backend, y una `useQuery` prerenderizada lee el reloj y puede
 * romper el build (`cacheComponents`). Con `ssr: false` la pantalla se pide desde el
 * navegador y `/reports` queda estática ([16 §8](../../docs/16-el-portal.md)).
 *
 * El `ssr: false` **sólo se admite dentro de un componente de cliente**
 * (`node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md`), y por eso este
 * archivo existe aunque no tenga estado: es el borde.
 */

import dynamic from 'next/dynamic';

const ReportsScreen = dynamic(() => import('./reports-screen'), {
  ssr: false,
  loading: () => (
    <p className="flex h-[calc(100vh-4rem)] items-center justify-center bg-white text-sm text-slate-500">
      Cargando los reportes…
    </p>
  ),
});

export function ReportsPanel() {
  return <ReportsScreen />;
}
