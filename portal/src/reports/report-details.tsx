'use client';

/**
 * El detalle del reporte seleccionado.
 *
 * Muestra el reporte entero —descripción completa, foto y minimapa— porque la tabla lo
 * recorta para que la cola se pueda leer de un vistazo ([16 §8](../../docs/16-el-portal.md)).
 * La severidad se presenta como lo que es: la percepción de quien reportó, no la
 * decisión del moderador ([09 §4.5](../../docs/09-modelo-de-datos.md)).
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { describeObstacleError } from '@/api/error-messages';
import {
  approveReport,
  obstacleQueryKey,
  readObstacles,
  rejectReport,
  OBSTACLES_QUERY_PREFIX,
  type ObstacleSeverity,
} from '@/api/obstacles';
import { REPORTS_QUERY_PREFIX, type ReportFeature } from '@/api/reports';
import {
  OBSTACLE_SEVERITIES,
  SEVERITY_LABELS as OBSTACLE_SEVERITY_LABELS,
} from '@/obstacles/obstacle-labels';
import { ReportMinimap } from './report-minimap';
import { SEVERITY_COLORS, SEVERITY_LABELS, STATUS_LABELS } from './report-labels';

/** El código del catálogo que el moderador no puede publicar ([09 §4.5]). */
const OTHER = 'OTHER';

/** La fecha completa del detalle: acá sí importan el día y la hora. */
const FULL_DATE = new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'long',
  timeStyle: 'short',
});

export function ReportDetails({ report }: { report: ReportFeature | null }) {
  const queryClient = useQueryClient();
  const [isApproving, setIsApproving] = useState(false);
  // `null` es "todavía no la toqué": la clasificación arranca en la del reporte.
  const [type, setType] = useState<string | null>(null);
  const [severity, setSeverity] = useState<ObstacleSeverity | null>(null);

  /**
   * El catálogo del formulario, que viene en la lectura de obstáculos.
   *
   * Es la misma clave que usa la pantalla de obstáculos con `ACTIVE`, así que las dos
   * comparten la entrada de caché y no hay un segundo catálogo en el cliente.
   */
  const { data: catalogue } = useQuery({
    queryKey: obstacleQueryKey('ACTIVE'),
    queryFn: () => readObstacles('ACTIVE'),
    retry: 1,
  });

  /** Aprobar o descartar mueve las dos listas: la cola de reportes y el mapa de obstáculos. */
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: REPORTS_QUERY_PREFIX });
    void queryClient.invalidateQueries({ queryKey: OBSTACLES_QUERY_PREFIX });
  };

  const approve = useMutation({
    mutationFn: (input: { id: number; type: string; severity: ObstacleSeverity }) =>
      approveReport(input.id, { type: input.type, severity: input.severity }),
    onSuccess: refresh,
  });

  const discard = useMutation({
    mutationFn: (id: number) => rejectReport(id),
    onSuccess: refresh,
  });

  if (report === null) {
    return (
      <p className="text-sm text-slate-500">
        Elegí un reporte de la lista para ver su detalle.
      </p>
    );
  }

  const detail = report.properties;
  // `OTHER` no se puede publicar: el moderador clasifica, y el select arranca sin elegir
  // ([09 §4.5](../../docs/09-modelo-de-datos.md)).
  const chosenType = type ?? (detail.type === OTHER ? '' : detail.type);
  const chosenSeverity = severity ?? detail.severity;
  const types = catalogue?.obstacle_types ?? [];
  const error = approve.error ?? discard.error;

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div>
        <h2 className="text-base font-semibold text-slate-800">{detail.type_name}</h2>
        <p className="text-xs text-slate-500">Reporte #{detail.id}</p>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt className="text-slate-500">Severidad</dt>
        <dd>
          <span
            className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${SEVERITY_COLORS[detail.severity]}`}
          >
            {SEVERITY_LABELS[detail.severity]}
          </span>
        </dd>
        <dt className="text-slate-500">Estado</dt>
        <dd className="text-slate-700">{STATUS_LABELS[detail.status]}</dd>
        <dt className="text-slate-500">Fecha</dt>
        <dd className="text-slate-700">
          {FULL_DATE.format(new Date(detail.created_at))}
        </dd>
      </dl>

      <p className="whitespace-pre-line text-slate-700">{detail.description}</p>

      {detail.image_url === null ? (
        <p className="text-slate-500">Sin foto.</p>
      ) : (
        // `<img>` y no `next/image`: la foto la sirve el backend en una URL arbitraria
        // que el build del portal no conoce (`UPLOAD_BASE_URL`), así que optimizarla
        // pediría configurar el host en cada entorno ([17 §4]).
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={detail.image_url}
          alt={`Foto del reporte: ${detail.description}`}
          className="h-48 w-full rounded border border-slate-200 object-cover"
        />
      )}

      <p className="text-xs text-slate-500">
        La severidad es la percepción de quien reportó, no la decisión del moderador.
      </p>

      {detail.status === 'PENDING' && (
        <section className="border-t border-slate-100 pt-3">
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            Moderación
          </h3>

          {isApproving ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                approve.mutate({
                  id: detail.id,
                  type: chosenType,
                  severity: chosenSeverity,
                });
              }}
            >
              <fieldset disabled={approve.isPending} className="flex flex-col gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-slate-500">Tipo del obstáculo</span>
                  <select
                    value={chosenType}
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
                  <span className="text-xs text-slate-500">Severidad</span>
                  <select
                    value={chosenSeverity}
                    onChange={(event) =>
                      setSeverity(event.target.value as ObstacleSeverity)
                    }
                    className="rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700"
                  >
                    {OBSTACLE_SEVERITIES.map((value) => (
                      <option key={value} value={value}>
                        {OBSTACLE_SEVERITY_LABELS[value]}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={chosenType === '' || approve.isPending}
                    className="flex-1 rounded border border-slate-300 bg-white px-2 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {approve.isPending ? 'Publicando…' : 'Crear obstáculo'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsApproving(false)}
                    className="rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
                  >
                    Cancelar
                  </button>
                </div>
              </fieldset>
            </form>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsApproving(true)}
                className="flex-1 rounded border border-slate-300 bg-white px-2 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Crear obstáculo
              </button>
              <button
                type="button"
                onClick={() => discard.mutate(detail.id)}
                disabled={discard.isPending}
                className="rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {discard.isPending ? 'Descartando…' : 'Descartar'}
              </button>
            </div>
          )}

          {error !== null && (
            <p role="alert" className="mt-2 text-xs text-red-700">
              {describeObstacleError(error)}
            </p>
          )}
        </section>
      )}

      {detail.status === 'APPROVED' && detail.obstacle_id !== null && (
        <p className="text-xs text-slate-500">Obstáculo #{detail.obstacle_id}</p>
      )}

      <ReportMinimap report={report} />
    </div>
  );
}
