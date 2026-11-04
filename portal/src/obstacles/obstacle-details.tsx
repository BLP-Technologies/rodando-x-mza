"use client";

/**
 * El detalle del obstáculo seleccionado, y su cierre (C013).
 *
 * Muestra lo que la lectura ya trajo —el tipo, la severidad, el elemento al que está
 * pegado, cuántos reportes lo apuntan y las fechas— y, si sigue activo, el botón que lo
 * resuelve. Resolver no borra: escribe `resolved_at`, y desde la consulta siguiente el
 * obstáculo deja de sumar en el ruteo ([09 §4.7](../../docs/09-modelo-de-datos.md)).
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { describeObstacleError } from "@/api/error-messages";
import {
  OBSTACLES_QUERY_PREFIX,
  resolveObstacle,
  type ObstacleFeature,
} from "@/api/obstacles";
import {
  ELEMENT_KIND_LABELS,
  SEVERITY_COLORS,
  SEVERITY_LABELS,
  obstacleStateLabel,
} from "./obstacle-labels";

/** La fecha completa del detalle: acá importan el día y la hora. */
const FULL_DATE = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "long",
  timeStyle: "short",
});

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex justify-between gap-3 border-b border-slate-100 py-1.5 text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-800">{children}</dd>
    </div>
  );
}

export function ObstacleDetails({
  obstacle,
}: {
  obstacle: ObstacleFeature | null;
}) {
  const queryClient = useQueryClient();

  const resolve = useMutation({
    mutationFn: (id: number) => resolveObstacle(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: OBSTACLES_QUERY_PREFIX });
    },
  });

  if (obstacle === null) {
    return (
      <p className="text-sm text-slate-500">
        Elegí un obstáculo del mapa para ver su detalle.
      </p>
    );
  }

  const detail = obstacle.properties;

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div>
        <h2 className="text-base font-semibold text-slate-800">
          {detail.type_name}
        </h2>
        <p className="text-xs text-slate-500">Obstáculo #{detail.id}</p>
      </div>

      <dl>
        <Row label="Severidad">
          <span
            className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${SEVERITY_COLORS[detail.severity]}`}
          >
            {SEVERITY_LABELS[detail.severity]}
          </span>
        </Row>
        <Row label="Estado">{obstacleStateLabel(obstacle)}</Row>
        <Row label="Pegado a">
          {ELEMENT_KIND_LABELS[detail.element_kind]} #{detail.element_id}
        </Row>
        <Row label="Reportes">{detail.reports_count}</Row>
        <Row label="Publicado">
          {FULL_DATE.format(new Date(detail.created_at))}
        </Row>
        {detail.resolved_at !== null && (
          <Row label="Resuelto">
            {FULL_DATE.format(new Date(detail.resolved_at))}
          </Row>
        )}
      </dl>

      {detail.resolved_at === null ? (
        <button
          type="button"
          onClick={() => resolve.mutate(detail.id)}
          disabled={resolve.isPending}
          className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {resolve.isPending ? "Resolviendo…" : "Marcar como resuelto"}
        </button>
      ) : (
        <p className="text-xs text-slate-500">
          Este obstáculo ya no impacta en el ruteo.
        </p>
      )}

      {resolve.error !== null && (
        <p role="alert" className="text-xs text-red-700">
          {describeObstacleError(resolve.error)}
        </p>
      )}
    </div>
  );
}
