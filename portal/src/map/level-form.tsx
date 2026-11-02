'use client';

/**
 * El formulario del nivel de accesibilidad de un elemento: la edición manual (C014).
 *
 * Escribe **una sola tabla** y no recalcula nada: el costo del ruteo se deriva de la
 * vista, así que cambia en la próxima consulta ([09 §4.7](../../docs/09-modelo-de-datos.md)).
 * Después de guardar se invalida el grafo, que vuelve a pedir el área visible y repinta
 * la arista con su color nuevo.
 *
 * `is_verified` no se manda: el servidor lo deriva del nivel. Un clic en "sin dato" deja
 * el elemento como recién importado, para que el relevamiento lo complete
 * ([12 §8.2](../../docs/12-relevamiento-de-accesibilidad.md)).
 */

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { describeSaveError } from '@/api/error-messages';
import {
  GRAPH_QUERY_PREFIX,
  updateElementLevel,
  type GraphFeature,
  type GraphLevel,
} from '@/api/graph';

/** Las cuatro opciones, en el orden de menos a más restrictiva, con "sin dato" al final. */
const OPTIONS: { value: GraphLevel; label: string }[] = [
  { value: 'FULL', label: 'Accesible' },
  { value: 'PARTIAL', label: 'Accesible con dificultad' },
  { value: 'NONE', label: 'No accesible' },
  { value: null, label: 'Sin dato' },
];

export function LevelForm({ feature }: { feature: GraphFeature }) {
  const queryClient = useQueryClient();
  const [level, setLevel] = useState<GraphLevel>(feature.properties.level);

  const { element_kind: kind, element_id: id } = feature.properties;

  const save = useMutation({
    mutationFn: (next: GraphLevel) => updateElementLevel(kind, id, next),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: GRAPH_QUERY_PREFIX });
    },
  });

  const changed = level !== feature.properties.level;

  return (
    <form
      className="mt-4 border-t border-slate-100 pt-4"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate(level);
      }}
    >
      <fieldset disabled={save.isPending}>
        <legend className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
          Cambiar el nivel
        </legend>

        <div className="flex flex-col gap-1.5">
          {OPTIONS.map((option) => (
            <label
              key={option.value ?? 'none'}
              className="flex cursor-pointer items-center gap-2 text-sm text-slate-700"
            >
              <input
                type="radio"
                name="level"
                checked={level === option.value}
                onChange={() => setLevel(option.value)}
              />
              {option.label}
            </label>
          ))}
        </div>

        <button
          type="submit"
          disabled={!changed || save.isPending}
          className="mt-3 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {save.isPending ? 'Guardando…' : 'Guardar'}
        </button>

        {level === null && (
          <p className="mt-2 text-xs text-slate-500">
            Queda sin verificar: el relevamiento lo va a poder completar.
          </p>
        )}

        {save.isSuccess && !changed && (
          <p role="status" className="mt-2 text-xs text-green-700">
            Nivel guardado. La arista ya se repintó y el ruteo lo toma en la próxima
            consulta.
          </p>
        )}

        {save.error !== null && (
          <p role="alert" className="mt-2 text-xs text-red-700">
            {describeSaveError(save.error)}
          </p>
        )}
      </fieldset>
    </form>
  );
}