"use client";

/**
 * El montaje de la pantalla de obstáculos: la frontera entre los dos mundos.
 *
 * Es el molde de `reports-panel.tsx` y existe por la misma razón: el build del portal corre
 * en CI, donde no hay backend, y una `useQuery` prerenderizada lee el reloj y puede romper
 * el build. Con `ssr: false` la pantalla se pide desde el navegador, Leaflet no se evalúa en
 * el servidor y `/obstacles` queda estática ([16 §8](../../docs/16-el-portal.md)).
 *
 * El `ssr: false` **sólo se admite dentro de un componente de cliente**, y por eso este
 * archivo existe aunque no tenga estado: es el borde.
 */

import dynamic from 'next/dynamic';

const ObstaclesScreen = dynamic(() => import('./obstacles-screen'), {
  ssr: false,
  loading: () => (
    <p className="flex h-[calc(100vh-4rem)] items-center justify-center bg-white text-sm text-slate-500">
      Cargando los obstáculos…
    </p>
  ),
});

export function ObstaclesPanel() {
  return <ObstaclesScreen />;
}
