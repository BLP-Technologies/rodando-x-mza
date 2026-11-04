"use client";

/**
 * El aside de la pestaña Ruta: las dos puntas, el botón de calcular y el recorrido.
 *
 * Es presentacional. Las puntas, el modo de clic y el resultado viven en `map-screen.tsx`, que
 * los conserva al cambiar de pestaña: el recorrido no se vuelve a pedir por moverse de
 * herramienta, y el pedido sigue siendo una mutación —un botón, sin caché— aunque el estado
 * que lo rodea viva en otra parte.
 *
 * El error del cálculo se muestra acá, en el panel, y no como cartel central: el cartel del
 * mapa es del grafo, que es la lectura que sostiene la pantalla.
 */

import type { RoutePoint, RouteResponse } from '@/api/routes';
import { RouteDetails } from './route-details';

/** Las dos puntas del recorrido, en el orden en que se leen. */
export type RouteEnd = 'origin' | 'destination';

/** Qué punta se está marcando con el próximo clic, o ninguna. */
export type PickingMode = RouteEnd | null;

type RoutesToolsProps = {
  origin: RoutePoint | null;
  destination: RoutePoint | null;
  picking: PickingMode;
  /** El último recorrido pedido, o `null` si todavía no se pidió ninguno. */
  route: RouteResponse | null;
  isCalculating: boolean;
  /** El error del último cálculo, ya traducido; `null` si no hubo. */
  error: string | null;
  /** Entra o sale del modo de clic de una punta. */
  onPick: (picking: PickingMode) => void;
  onSetPoint: (end: RouteEnd, point: RoutePoint | null) => void;
  /** Marca la punta con el centro de la vista: es el camino con teclado. */
  onUseCenter: (end: RouteEnd) => void;
  onCalculate: () => void;
};

/** El rótulo de cada punta, para no repetir el texto de los botones. */
const PUNTA_LABELS: Record<RouteEnd, string> = {
  origin: 'origen',
  destination: 'destino',
};

const PUNTA_BUTTON_CLASS =
  'rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50';

/** Cómo se escribe una coordenada: cinco decimales es ~1 m, como el bbox. */
function formatPoint(point: RoutePoint): string {
  return `${point.lat.toFixed(5)}, ${point.lon.toFixed(5)}`;
}

export function RoutesTools({
  origin,
  destination,
  picking,
  route,
  isCalculating,
  error,
  onPick,
  onSetPoint,
  onUseCenter,
  onCalculate,
}: RoutesToolsProps) {
  const canCalculate = origin !== null && destination !== null;

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-3">
        {(['origin', 'destination'] as const).map((punta) => {
          const point = punta === 'origin' ? origin : destination;

          return (
            <div key={punta} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  {punta === 'origin' ? 'Origen' : 'Destino'}
                </span>
                <span className="text-right text-xs text-slate-600">
                  {point === null ? 'Sin marcar' : formatPoint(point)}
                </span>
              </div>

              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  // Volver a apretarlo cancela el modo: el mismo botón entra y sale.
                  onClick={() => onPick(picking === punta ? null : punta)}
                  aria-pressed={picking === punta}
                  className={PUNTA_BUTTON_CLASS}
                >
                  Marcar {PUNTA_LABELS[punta]}
                </button>

                {/* Un clic en el mapa no se puede hacer con el teclado: el centro de la vista
                    es la otra forma de elegir un punto. */}
                <button
                  type="button"
                  onClick={() => onUseCenter(punta)}
                  className={PUNTA_BUTTON_CLASS}
                >
                  Usar el centro
                </button>

                <button
                  type="button"
                  onClick={() => onSetPoint(punta, null)}
                  disabled={point === null}
                  className={PUNTA_BUTTON_CLASS}
                >
                  Limpiar
                </button>
              </div>
            </div>
          );
        })}

        <button
          type="button"
          onClick={onCalculate}
          disabled={!canCalculate || isCalculating}
          className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isCalculating ? 'Calculando…' : 'Calcular'}
        </button>

        {!canCalculate && (
          <p className="text-xs text-slate-500">
            Marcá las dos puntas para habilitar el cálculo.
          </p>
        )}

        {error !== null && (
          <p
            role="alert"
            className="rounded border border-red-300 bg-red-50 px-2 py-1.5 text-xs text-red-800"
          >
            {error}
          </p>
        )}
      </div>

      <div className="p-4">
        <RouteDetails route={route} isPending={isCalculating} />
      </div>
    </div>
  );
}
