'use client';

/**
 * El detalle del reporte seleccionado.
 *
 * Muestra el reporte entero —descripción completa, foto y minimapa— porque la tabla lo
 * recorta para que la cola se pueda leer de un vistazo ([16 §8](../../docs/16-el-portal.md)).
 * La severidad se presenta como lo que es: la percepción de quien reportó, no la
 * decisión del moderador ([09 §4.5](../../docs/09-modelo-de-datos.md)).
 */

import type { ReportFeature } from '@/api/reports';
import { ReportMinimap } from './report-minimap';
import { SEVERITY_COLORS, SEVERITY_LABELS, STATUS_LABELS } from './report-labels';

/** La fecha completa del detalle: acá sí importan el día y la hora. */
const FULL_DATE = new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'long',
  timeStyle: 'short',
});

export function ReportDetails({ report }: { report: ReportFeature | null }) {
  if (report === null) {
    return (
      <p className="text-sm text-slate-500">
        Elegí un reporte de la lista para ver su detalle.
      </p>
    );
  }

  const detail = report.properties;

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

      <ReportMinimap report={report} />
    </div>
  );
}
