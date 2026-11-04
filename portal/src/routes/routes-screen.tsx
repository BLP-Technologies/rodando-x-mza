"use client";

/**
 * La pantalla de ruta: el mapa y el panel desde donde se piden las dos puntas y se lee el
 * recorrido.
 *
 * **El pedido es una mutación y no una query.** El disparador es un botón —"Calcular"— y no
 * un cambio de estado, el resultado no se cachea y no hay comparación con el pedido anterior:
 * el operador compara a ojo ([16 §8.3](../../docs/16-el-portal.md)).
 *
 * **El estado de las puntas es del cliente.** `origin` y `destination` guardan la coordenada
 * que se marcó, no el nodo al que la API se la pegó: la diferencia entre las dos es justamente
 * lo que la pantalla tiene para mostrar ([13 §4.2](../../docs/13-api-de-ruteo.md)).
 *
 * **El área de servicio es contexto, no requisito.** Se lee una sola vez la caja del piloto
 * —sin refetch al panear— y sólo se usan sus `service_areas` para dibujar el borde: si esa
 * lectura falla, el recorrido se pide y se dibuja igual, porque el grafo no entra en esta
 * pantalla.
 */

import { useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import { describeRouteError } from "@/api/error-messages";
import { graphQueryKey, readGraph } from "@/api/graph";
import {
  calculateRoute,
  type RoutePoint,
  type RouteRequest,
} from "@/api/routes";
import { PILOT_BOUNDS } from "@/config";
import { RouteDetails } from "./route-details";
import { RoutesMap, type PickingMode } from "./routes-map";

/** El rótulo de cada punta, para no repetir el texto de los botones en el panel. */
const PUNTA_LABELS: Record<"origin" | "destination", string> = {
  origin: "origen",
  destination: "destino",
};

const PUNTA_BUTTON_CLASS =
  "rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

/** Cómo se escribe una coordenada en el panel: cinco decimales es ~1 m, como el bbox. */
function formatPoint(point: RoutePoint): string {
  return `${point.lat.toFixed(5)}, ${point.lon.toFixed(5)}`;
}

export default function RoutesScreen() {
  const [origin, setOrigin] = useState<RoutePoint | null>(null);
  const [destination, setDestination] = useState<RoutePoint | null>(null);
  /** El modo de clic activo: el próximo clic en el mapa fija esa punta. */
  const [picking, setPicking] = useState<PickingMode>(null);
  const centerRef = useRef<RoutePoint | null>(null);

  const { data: graph } = useQuery({
    queryKey: graphQueryKey(PILOT_BOUNDS),
    queryFn: () => readGraph(PILOT_BOUNDS),
    // Sin refetch al panear: el mapa encuadra en la caja del piloto y no se mueve con los
    // datos. Un reintento y no tres, para no quedarse esperando el borde en vano.
    retry: 1,
  });

  const serviceAreas = graph?.service_areas.features ?? [];

  const calculate = useMutation({
    mutationFn: (request: RouteRequest) => calculateRoute(request),
  });

  const canCalculate = origin !== null && destination !== null;

  const setPoint = (
    punta: "origin" | "destination",
    point: RoutePoint | null,
  ) => {
    if (punta === "origin") setOrigin(point);
    else setDestination(point);
  };

  const requestRoute = () => {
    if (origin === null || destination === null) return;
    calculate.mutate({ origin, destination });
  };

  return (
    <section
      aria-label="Recorrido"
      className="flex h-[calc(100vh-4rem)] min-h-0 bg-white"
    >
      <div className="relative min-w-0 flex-1">
        <RoutesMap
          serviceAreas={serviceAreas}
          route={calculate.data ?? null}
          origin={origin}
          destination={destination}
          picking={picking}
          onPick={(point) => {
            if (picking !== null) setPoint(picking, point);
            setPicking(null);
          }}
          centerRef={centerRef}
        />

        {picking !== null && (
          <p
            role="status"
            className="absolute left-1/2 top-3 z-[1100] max-w-sm -translate-x-1/2 rounded bg-white/95 px-3 py-1.5 text-sm text-slate-700 shadow"
          >
            Hacé clic en el mapa para marcar el {PUNTA_LABELS[picking]}.
          </p>
        )}

        {calculate.error !== null && (
          <div
            role="alert"
            className="absolute left-1/2 top-3 z-[1100] max-w-md -translate-x-1/2 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 shadow"
          >
            {describeRouteError(calculate.error)}
          </div>
        )}
      </div>

      <aside className="flex w-80 shrink-0 flex-col border-l border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-3">
          {(["origin", "destination"] as const).map((punta) => {
            const point = punta === "origin" ? origin : destination;

            return (
              <div key={punta} className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    {punta === "origin" ? "Origen" : "Destino"}
                  </span>
                  <span className="text-right text-xs text-slate-600">
                    {point === null ? "Sin marcar" : formatPoint(point)}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    // Volver a apretarlo cancela el modo: el mismo botón entra y sale.
                    onClick={() => setPicking(picking === punta ? null : punta)}
                    aria-pressed={picking === punta}
                    className={PUNTA_BUTTON_CLASS}
                  >
                    Marcar {PUNTA_LABELS[punta]}
                  </button>

                  <button
                    type="button"
                    onClick={() => setPoint(punta, null)}
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
            onClick={requestRoute}
            disabled={!canCalculate || calculate.isPending}
            className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {calculate.isPending ? "Calculando…" : "Calcular"}
          </button>

          {!canCalculate && (
            <p className="text-xs text-slate-500">
              Marcá las dos puntas para habilitar el cálculo.
            </p>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <RouteDetails
            route={calculate.data ?? null}
            isPending={calculate.isPending}
          />
        </div>
      </aside>
    </section>
  );
}
