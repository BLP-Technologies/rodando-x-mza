"use client";

/**
 * La pantalla de obstáculos: el mapa, el detalle del seleccionado y el alta inline.
 *
 * Es una pantalla propia porque el obstáculo es un objeto de trabajo distinto del reporte
 * —ya está publicado y afecta al ruteo— y se piensa en el mapa: la pregunta es qué barreras
 * hay en la calle ([16 §8](../../docs/16-el-portal.md)).
 *
 * **El mapa no dibuja el grafo.** Veredas, cruces y cordones viven en `/`, con su control de
 * capas, que es de otra tarea; acá lo que se ve son los obstáculos y los tiles, que es también
 * el "grafo apagado por defecto" de la pantalla.
 *
 * El estado del filtro y la selección son estado de interfaz y no del servidor: el servidor
 * sólo recibe el estado que se quiere leer. La selección se guarda por `id` y no por objeto
 * para que sobreviva a un refetch.
 */

import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { describeApiError } from '@/api/error-messages';
import {
  obstacleQueryKey,
  readObstacles,
  type ObstacleFeature,
  type ObstacleStatusFilter,
} from '@/api/obstacles';
import { ObstacleDetails } from './obstacle-details';
import { ObstacleForm } from './obstacle-form';
import { OBSTACLE_STATUS_FILTERS, STATUS_FILTER_LABELS } from './obstacle-labels';
import { ObstaclesMap, type MapPoint } from './obstacles-map';

export default function ObstaclesScreen() {
  const [status, setStatus] = useState<ObstacleStatusFilter>('ACTIVE');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  /** Modo "elegí el punto": el próximo clic del mapa es el alta. */
  const [picking, setPicking] = useState(false);
  const [draftPoint, setDraftPoint] = useState<MapPoint | null>(null);

  const { data, error, isPending, refetch } = useQuery({
    queryKey: obstacleQueryKey(status),
    queryFn: () => readObstacles(status),
    // Al cambiar de estado el mapa anterior se queda hasta que llega la lectura nueva, en
    // vez de vaciarse en cada clic (mismo motivo que el mapa del grafo, [16 §5.4]).
    placeholderData: keepPreviousData,
    // Un reintento y no tres: con la API caída, el default espera ~7 s antes de mostrar el
    // error.
    retry: 1,
  });

  const obstacles = data?.features ?? [];
  const types = data?.obstacle_types ?? [];
  const truncated = data?.truncated ?? false;

  const selected = obstacles.find((obstacle) => obstacle.properties.id === selectedId) ?? null;

  /** Un alta en curso: el formulario está abierto y todavía no hay obstáculo publicado. */
  const isCreating = picking || draftPoint !== null;

  const startCreating = () => {
    setSelectedId(null);
    setDraftPoint(null);
    setPicking(true);
  };

  const cancelCreating = () => {
    setPicking(false);
    setDraftPoint(null);
  };

  const finishCreating = (obstacle: ObstacleFeature) => {
    setPicking(false);
    setDraftPoint(null);
    // El obstáculo nace activo: si se estaba mirando otra cosa, el filtro vuelve a donde
    // está lo que se acaba de publicar.
    if (status !== 'ACTIVE') setStatus('ACTIVE');
    setSelectedId(obstacle.properties.id);
  };

  return (
    <section aria-label="Obstáculos" className="flex h-[calc(100vh-4rem)] min-h-0 bg-white">
      <div className="relative min-w-0 flex-1">
        <ObstaclesMap
          obstacles={obstacles}
          selectedId={selectedId}
          onSelect={(id) => {
            // Un clic en el fondo mientras se elige el punto no suelta nada: el modo manda.
            if (!picking) setSelectedId(id);
          }}
          picking={picking}
          onPickPoint={(point) => {
            setDraftPoint(point);
            setPicking(false);
          }}
          draftPoint={draftPoint}
        />

        {picking && (
          <p
            role="status"
            className="absolute left-1/2 top-3 z-[1100] max-w-sm -translate-x-1/2 rounded bg-white/95 px-3 py-1.5 text-sm text-slate-700 shadow"
          >
            Hacé clic en el mapa para marcar el punto del obstáculo.
          </p>
        )}

        {isPending && (
          <p className="absolute left-1/2 top-3 z-[1100] -translate-x-1/2 rounded bg-white/95 px-3 py-1.5 text-sm text-slate-600 shadow">
            Cargando los obstáculos…
          </p>
        )}

        {error !== null && (
          <div
            role="alert"
            className="absolute left-1/2 top-3 z-[1100] flex max-w-md -translate-x-1/2 items-center gap-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 shadow"
          >
            <span>{describeApiError(error)}</span>
            <button
              type="button"
              onClick={() => void refetch()}
              className="shrink-0 rounded border border-red-400 px-2 py-1 text-xs hover:bg-red-100"
            >
              Reintentar
            </button>
          </div>
        )}

        {truncated && (
          <p
            role="status"
            className="absolute bottom-6 left-3 z-[1100] max-w-sm rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 shadow"
          >
            Hay más de 2000 obstáculos y la API devolvió los más nuevos.
          </p>
        )}
      </div>

      <aside className="flex w-80 shrink-0 flex-col border-l border-slate-200 bg-white">
        <div className="flex flex-col gap-2 border-b border-slate-200 p-3">
          <div className="flex items-center gap-2">
            <label htmlFor="obstacle-status" className="text-sm text-slate-600">
              Ver
            </label>
            <select
              id="obstacle-status"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as ObstacleStatusFilter);
                // La selección es de otra lista: el detalle no puede seguir mostrando un
                // obstáculo que ya no está en el mapa.
                setSelectedId(null);
              }}
              className="rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700"
            >
              {OBSTACLE_STATUS_FILTERS.map((value) => (
                <option key={value} value={value}>
                  {STATUS_FILTER_LABELS[value]}
                </option>
              ))}
            </select>

            <span className="ml-auto text-sm text-slate-500">
              {obstacles.length} {obstacles.length === 1 ? 'obstáculo' : 'obstáculos'}
            </span>
          </div>

          <button
            type="button"
            onClick={startCreating}
            disabled={isCreating}
            className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Nuevo obstáculo
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {draftPoint !== null ? (
            // `key` sobre el punto: elegir otro punto arranca un formulario nuevo y no
            // arrastra el tipo que se estaba eligiendo.
            <ObstacleForm
              key={`${draftPoint.lon},${draftPoint.lat}`}
              point={draftPoint}
              types={types}
              onCreated={finishCreating}
              onCancel={cancelCreating}
            />
          ) : (
            <ObstacleDetails obstacle={selected} />
          )}
        </div>
      </aside>
    </section>
  );
}
