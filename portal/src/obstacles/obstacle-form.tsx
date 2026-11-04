"use client";

/**
 * El formulario de un obstáculo nuevo: el alta inline del panel (C012).
 *
 * No hay diálogo: el punto se elige en el mapa y el formulario vive en el costado, como el
 * del nivel ([16 §5.6](../../docs/16-el-portal.md)). El cuerpo no manda el elemento del grafo
 * —lo decide el servidor, pegando el punto al más cercano— y no manda `OTHER`, que es la
 * percepción del ciudadano y no la clasificación del moderador
 * ([09 §4.5](../../docs/09-modelo-de-datos.md)).
 *
 * Después de publicar se invalida el prefijo de obstáculos: el marcador nuevo entra en la
 * próxima lectura y el ruteo ya lo cobra, porque el costo se deriva de la vista.
 */

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { describeObstacleError } from '@/api/error-messages';
import {
  createObstacle,
  OBSTACLES_QUERY_PREFIX,
  type ObstacleFeature,
  type ObstacleSeverity,
  type ObstacleType,
} from '@/api/obstacles';
import { OBSTACLE_SEVERITIES, SEVERITY_LABELS } from './obstacle-labels';
import type { MapPoint } from '@/map/layer-draw';

type ObstacleFormProps = {
  point: MapPoint;
  /** El catálogo que viene en la lectura: activo y sin `OTHER`. */
  types: readonly ObstacleType[];
  onCreated: (obstacle: ObstacleFeature) => void;
  onCancel: () => void;
};

export function ObstacleForm({ point, types, onCreated, onCancel }: ObstacleFormProps) {
  const queryClient = useQueryClient();
  const [type, setType] = useState('');
  const [severity, setSeverity] = useState<ObstacleSeverity>('MODERATE');

  const save = useMutation({
    mutationFn: () =>
      createObstacle({
        type,
        severity,
        geom: { lon: point.lon, lat: point.lat },
      }),
    onSuccess: (obstacle) => {
      void queryClient.invalidateQueries({ queryKey: OBSTACLES_QUERY_PREFIX });
      onCreated(obstacle);
    },
  });

  return (
    <form
      className="flex flex-col gap-3 text-sm"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <div>
        <h2 className="text-base font-semibold text-slate-800">Nuevo obstáculo</h2>
        <p className="text-xs text-slate-500">
          Punto elegido: {point.lat.toFixed(5)}, {point.lon.toFixed(5)}
        </p>
      </div>

      <fieldset disabled={save.isPending} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Tipo
          </span>
          <select
            value={type}
            onChange={(event) => setType(event.target.value)}
            required
            className="rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700"
          >
            <option value="">Elegí un tipo</option>
            {types.map((candidate) => (
              <option key={candidate.code} value={candidate.code}>
                {candidate.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Severidad
          </span>
          <select
            value={severity}
            onChange={(event) => setSeverity(event.target.value as ObstacleSeverity)}
            className="rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700"
          >
            {OBSTACLE_SEVERITIES.map((value) => (
              <option key={value} value={value}>
                {SEVERITY_LABELS[value]}
              </option>
            ))}
          </select>
        </label>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={type === '' || save.isPending}
            className="flex-1 rounded border border-slate-300 bg-white px-2 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {save.isPending ? 'Guardando…' : 'Publicar'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
          >
            Cancelar
          </button>
        </div>
      </fieldset>

      {save.error !== null && (
        <p role="alert" className="text-xs text-red-700">
          {describeObstacleError(save.error)}
        </p>
      )}
    </form>
  );
}
