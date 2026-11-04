"use client";

/**
 * El aside de la pestaña Obstáculos: el filtro, el alta y el detalle del seleccionado.
 *
 * Es presentacional. El filtro, la selección y el borrador son estado de `map-screen.tsx`, que
 * los conserva al cambiar de pestaña: si vivieran acá, entrar y salir de la pestaña empezaría
 * un alta de cero.
 *
 * El mapa donde se marcan los puntos no está acá: es la única instancia de Leaflet de la
 * pantalla, y solo cambia qué capas dibuja.
 */

import type { ObstacleFeature, ObstacleStatusFilter, ObstacleType } from '@/api/obstacles';
import type { MapPoint } from '@/map/layer-draw';
import { ObstacleDetails } from './obstacle-details';
import { ObstacleForm } from './obstacle-form';
import { OBSTACLE_STATUS_FILTERS, STATUS_FILTER_LABELS } from './obstacle-labels';

type ObstaclesToolsProps = {
  /** Los obstáculos de la lectura vigente, para el conteo y para resolver la selección. */
  obstacles: readonly ObstacleFeature[];
  /** El catálogo que viene con la lectura. */
  types: readonly ObstacleType[];
  status: ObstacleStatusFilter;
  /** La lectura está en curso: el conteo todavía no es el definitivo. */
  isPending: boolean;
  selected: ObstacleFeature | null;
  /** El punto elegido en el mapa, mientras el formulario del alta está abierto. */
  draftPoint: MapPoint | null;
  /** Hay un alta en curso: se está eligiendo el punto o ya se eligió. */
  isCreating: boolean;
  onStatusChange: (status: ObstacleStatusFilter) => void;
  onStartCreating: () => void;
  onCancelCreating: () => void;
  onCreated: (obstacle: ObstacleFeature) => void;
};

export function ObstaclesTools({
  obstacles,
  types,
  status,
  isPending,
  selected,
  draftPoint,
  isCreating,
  onStatusChange,
  onStartCreating,
  onCancelCreating,
  onCreated,
}: ObstaclesToolsProps) {
  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-2 border-b border-slate-200 p-3">
        <div className="flex items-center gap-2">
          <label htmlFor="obstacle-status" className="text-sm text-slate-600">
            Ver
          </label>
          <select
            id="obstacle-status"
            value={status}
            onChange={(event) =>
              onStatusChange(event.target.value as ObstacleStatusFilter)
            }
            className="rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700"
          >
            {OBSTACLE_STATUS_FILTERS.map((value) => (
              <option key={value} value={value}>
                {STATUS_FILTER_LABELS[value]}
              </option>
            ))}
          </select>

          <span className="ml-auto text-sm text-slate-500">
            {isPending
              ? 'Cargando…'
              : `${obstacles.length} ${obstacles.length === 1 ? 'obstáculo' : 'obstáculos'}`}
          </span>
        </div>

        <button
          type="button"
          onClick={onStartCreating}
          disabled={isCreating}
          className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Nuevo obstáculo
        </button>
      </div>

      <div className="p-4">
        {draftPoint !== null ? (
          // `key` sobre el punto: elegir otro punto arranca un formulario nuevo y no arrastra
          // el tipo que se estaba eligiendo.
          <ObstacleForm
            key={`${draftPoint.lon},${draftPoint.lat}`}
            point={draftPoint}
            types={types}
            onCreated={onCreated}
            onCancel={onCancelCreating}
          />
        ) : (
          <ObstacleDetails obstacle={selected} />
        )}
      </div>
    </div>
  );
}
