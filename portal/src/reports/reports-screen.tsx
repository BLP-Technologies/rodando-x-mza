'use client';

/**
 * La pantalla de reportes: la tabla de un estado y el detalle del seleccionado.
 *
 * Es la segunda pantalla del portal y una pantalla por objeto de trabajo: el grafo es
 * un mapa porque la pregunta es dónde está el paso, y los reportes son una lista porque
 * la pregunta es cuál miro ahora ([16 §8](../../docs/16-el-portal.md)).
 *
 * El estado, el orden y la selección son estado de interfaz y no del servidor: el
 * servidor sólo recibe el estado que se quiere leer. La selección se guarda por `id` y
 * no por objeto para que sobreviva a un refetch de la misma cola.
 */

import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { describeApiError } from '@/api/error-messages';
import { readReports, reportQueryKey, type ReportStatus } from '@/api/reports';
import { ReportDetails } from './report-details';
import {
  REPORT_STATUSES,
  SEVERITY_COLORS,
  SEVERITY_LABELS,
  STATUS_LABELS,
} from './report-labels';

/** El orden por fecha de la tabla; la API siempre devuelve descendente. */
type SortOrder = 'desc' | 'asc';

/**
 * La fecha de la tabla, corta. Es componente de cliente, así que formatear acá no
 * produce desajuste de hidratación, y el servidor no tiene que saber en qué zona lee
 * la persona.
 */
const SHORT_DATE = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: '2-digit',
});

export default function ReportsScreen() {
  const [status, setStatus] = useState<ReportStatus>('PENDING');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [order, setOrder] = useState<SortOrder>('desc');

  const { data, error, isPending, refetch } = useQuery({
    queryKey: reportQueryKey(status),
    queryFn: () => readReports(status),
    // Al cambiar de estado la tabla anterior se queda hasta que llega la nueva, en
    // vez de vaciarse en cada clic.
    placeholderData: keepPreviousData,
    // Un reintento y no tres: con la API caída, el default espera ~7 s antes de
    // mostrar el error (mismo motivo que el mapa, [16 §5.4]).
    retry: 1,
  });

  const features = data?.features ?? [];
  const truncated = data?.truncated ?? false;

  // El servidor ordena por fecha descendente; el ascendente es el reverso de un orden
  // total, así que no hace falta volver a pedir ni reordenar con una fecha que el
  // cliente tendría que interpretar.
  const rows = order === 'desc' ? features : [...features].reverse();

  const selected = features.find((feature) => feature.properties.id === selectedId) ?? null;

  return (
    <section
      aria-label="Reportes ciudadanos"
      className="flex h-[calc(100vh-4rem)] min-h-0 bg-white"
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-3 py-2">
          <label htmlFor="report-status" className="text-sm text-slate-600">
            Estado
          </label>
          <select
            id="report-status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as ReportStatus);
              // La selección es de otra lista: el detalle no puede seguir mostrando un
              // reporte que ya no está en la tabla.
              setSelectedId(null);
            }}
            className="rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700"
          >
            {REPORT_STATUSES.map((value) => (
              <option key={value} value={value}>
                {STATUS_LABELS[value]}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setOrder(order === 'desc' ? 'asc' : 'desc')}
            className="rounded border border-slate-300 px-2 py-1 text-sm text-slate-700 hover:bg-slate-50"
          >
            {order === 'desc' ? 'Más recientes primero' : 'Más antiguos primero'}
          </button>

          <span className="ml-auto text-sm text-slate-500">
            {features.length} {features.length === 1 ? 'reporte' : 'reportes'}
          </span>
        </div>

        {truncated && (
          <p
            role="status"
            className="border-b border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
          >
            Hay más de 2000 reportes en este estado y la API devolvió los más nuevos.
          </p>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {isPending ? (
            <p className="p-4 text-sm text-slate-500">Cargando los reportes…</p>
          ) : error !== null ? (
            <div
              role="alert"
              className="m-3 flex max-w-md items-center gap-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
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
          ) : rows.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">
              No hay reportes con estado {STATUS_LABELS[status].toLowerCase()}.
            </p>
          ) : (
            <table className="w-full table-fixed border-collapse text-left text-sm">
              <caption className="sr-only">
                Reportes con estado {STATUS_LABELS[status]}
              </caption>
              <colgroup>
                <col className="w-[24%]" />
                <col className="w-[14%]" />
                <col className="w-[16%]" />
                <col />
                <col className="w-[14%]" />
              </colgroup>
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">Tipo</th>
                  <th scope="col" className="px-3 py-2 font-medium">Severidad</th>
                  <th scope="col" className="px-3 py-2 font-medium">Estado</th>
                  <th scope="col" className="px-3 py-2 font-medium">Descripción</th>
                  <th scope="col" className="px-3 py-2 font-medium">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((feature) => {
                  const report = feature.properties;
                  const isSelected = report.id === selectedId;

                  return (
                    <tr
                      key={report.id}
                      className={`border-t border-slate-100 ${
                        isSelected ? 'bg-sky-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="px-3 py-2 align-top">
                        {/* La fila no puede ser un botón —una tabla no admite un control
                            que abarque celdas— así que el botón de la primera celda es la
                            acción de la fila, y el fondo marca cuál está seleccionada. */}
                        <button
                          type="button"
                          onClick={() => setSelectedId(report.id)}
                          aria-current={isSelected ? 'true' : undefined}
                          className="truncate text-left font-medium text-sky-800 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500"
                        >
                          {report.type_name}
                        </button>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <span
                          className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${SEVERITY_COLORS[report.severity]}`}
                        >
                          {SEVERITY_LABELS[report.severity]}
                        </span>
                      </td>
                      <td className="px-3 py-2 align-top text-slate-700">
                        {STATUS_LABELS[report.status]}
                      </td>
                      {/* `truncate` recorta al dibujar y no en el dato: el texto
                          completo sigue en el DOM y en el detalle. */}
                      <td className="px-3 py-2 align-top">
                        <span className="block truncate text-slate-700">
                          {report.description}
                        </span>
                      </td>
                      <td className="px-3 py-2 align-top whitespace-nowrap text-slate-700">
                        {SHORT_DATE.format(new Date(report.created_at))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <aside className="w-80 shrink-0 overflow-y-auto border-l border-slate-200 bg-white p-4">
        <ReportDetails report={selected} />
      </aside>
    </section>
  );
}
