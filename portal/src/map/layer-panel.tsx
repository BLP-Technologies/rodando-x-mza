"use client";

/**
 * El panel de capas: sólo la interfaz.
 *
 * Qué capa está prendida, qué datos hay y cuándo se piden lo decide `map-screen.tsx`; acá
 * sólo se dibujan las casillas y se avisa de un cambio. Sin Leaflet y sin queries, para que
 * se pueda leer de un vistazo y no dependa del mapa.
 *
 * Flota sobre el mapa como hermano del `<div>` de Leaflet —igual que los carteles— y no
 * adentro: así el clic en el panel no llega al mapa y no hace falta envolver nada con
 * `L.DomEvent`. El `z-[1100]` lo pone arriba de los panes de Leaflet.
 */

import { useRef } from "react";

import { LAYER_IDS, LAYER_LABELS, type LayerId } from "./layer-config";

/** El id del cuerpo, que es lo que abre y cierra el encabezado. */
const BODY_ID = "layer-panel-body";

type LayerPanelProps = {
  open: boolean;
  onToggle: () => void;
  layers: Record<LayerId, boolean>;
  onChange: (id: LayerId, value: boolean) => void;
  /** Las capas cuya lectura falló: se avisa en la fila, sin cartel central. */
  failed: Partial<Record<LayerId, boolean>>;
  /** El nombre del área activa, al lado de la capa que la dibuja. */
  areaNames: string;
  /** En la pestaña Obstáculos la pantalla depende de su capa: la casilla queda fija. */
  obstaclesLocked: boolean;
};

export function LayerPanel({
  open,
  onToggle,
  layers,
  onChange,
  failed,
  areaNames,
  obstaclesLocked,
}: LayerPanelProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  /**
   * Colapsa sin perder el foco.
   *
   * Se hace acá y no en un efecto a propósito: el cuerpo se oculta en el mismo commit que
   * cambia `open`, y el navegador saca el foco del control en cuanto deja de estar visible, así
   * que un efecto ya corre con `activeElement` en el `<body>` y el foco se pierde. Leyendo el
   * foco antes de avisar, el salto al botón lo hace el usuario y el efecto no tiene que adivinar.
   */
  const handleToggle = () => {
    if (open && bodyRef.current?.contains(document.activeElement) === true) {
      buttonRef.current?.focus();
    }

    onToggle();
  };

  return (
    <div className="absolute right-3 top-3 z-[1100] w-56 overflow-hidden rounded border border-slate-200 bg-white/95 shadow">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={BODY_ID}
        onClick={handleToggle}
        className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
      >
        Capas
        <svg
          aria-hidden
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M5 8l5 5 5-5" />
        </svg>
      </button>

      {/* `max-h` propio con scroll interno: el panel no se estira hasta la atribución de OSM,
          que vive abajo a la derecha. */}
      <div
        id={BODY_ID}
        ref={bodyRef}
        hidden={!open}
        className="max-h-56 overflow-y-auto border-t border-slate-200 p-2"
      >
        <fieldset>
          <legend className="sr-only">Capas</legend>

          {LAYER_IDS.map((id) => {
            const locked = id === "obstaculos" && obstaclesLocked;
            const noteId = `layer-${id}-note`;

            return (
              <div key={id} className="py-0.5">
                <div className="flex items-start gap-2">
                  <input
                    id={`layer-${id}`}
                    type="checkbox"
                    checked={locked || layers[id]}
                    disabled={locked}
                    onChange={(event) => onChange(id, event.target.checked)}
                    aria-describedby={locked ? noteId : undefined}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
                  />
                  <label
                    htmlFor={`layer-${id}`}
                    className="flex-1 cursor-pointer text-sm text-slate-700"
                  >
                    {LAYER_LABELS[id]}
                    {id === "zona" && areaNames !== "" && (
                      <span className="block text-xs text-slate-500">{areaNames}</span>
                    )}
                  </label>
                </div>

                {locked && (
                  <p id={noteId} className="ml-6 text-xs text-slate-500">
                    En esta pestaña la capa está siempre visible.
                  </p>
                )}

                {failed[id] === true && (
                  <p className="ml-6 text-xs text-red-700">No se pudo cargar</p>
                )}
              </div>
            );
          })}
        </fieldset>
      </div>
    </div>
  );
}
