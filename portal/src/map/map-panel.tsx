'use client';

/**
 * El montaje del mapa: la única pieza que sabe que Leaflet no existe en el
 * servidor.
 *
 * Leaflet lee `window` al importarse, así que su módulo revienta si Next lo
 * evalúa al prerenderizar (y el prerender corre en el build de CI, sin
 * navegador). La salida documentada en Next 16 es `next/dynamic` con
 * `ssr: false`, y ese `ssr: false` **sólo se admite dentro de un componente de
 * cliente** (`node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md`): en
 * un componente de servidor Next tira un error de build. Por eso este archivo es
 * `'use client'` aunque no tenga estado: es el borde entre los dos mundos.
 *
 * El contenedor y la atribución sí van en el HTML del servidor, así que la
 * página se lee y se audita sin JavaScript.
 */

import dynamic from 'next/dynamic';

const GraphMap = dynamic(() => import('./graph-map'), {
  ssr: false,
  loading: () => (
    <p className="flex h-full items-center justify-center text-sm text-slate-500">
      Cargando el mapa…
    </p>
  ),
});

export function MapPanel() {
  return (
    <section
      aria-label="Mapa del grafo peatonal"
      className="flex h-[calc(100vh-4rem)] min-h-0 flex-col"
    >
      <div id="graph-map" className="min-h-0 flex-1 bg-slate-100">
        <GraphMap />
      </div>

      {/* Atribución obligatoria (ODbL 1.0, [10 §3](docs/10-datos-y-zona-piloto.md)).
          Va también acá además del control de Leaflet para que esté en el HTML
          aunque el mapa todavía no haya cargado. */}
      <p className="border-t border-slate-200 bg-white px-3 py-1 text-right text-xs text-slate-500">
        Datos del mapa: ©{' '}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
          className="underline hover:text-slate-700"
        >
          OpenStreetMap contributors
        </a>{' '}
        (ODbL 1.0)
      </p>
    </section>
  );
}
