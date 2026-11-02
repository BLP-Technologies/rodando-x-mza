/**
 * El panel con las propiedades del elemento seleccionado.
 *
 * Todo lo que muestra viene en la respuesta del grafo: no hay pedido extra a la
 * API ([14 §7](../../docs/14-la-api-del-grafo.md)).
 */

import type { GraphFeature } from '@/api/graph';
import { levelLabel } from './feature-style';

const KIND_LABELS: Record<GraphFeature['properties']['element_kind'], string> = {
  sidewalk: 'Vereda',
  crossing: 'Cruce',
  kerb: 'Cordón',
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b border-slate-100 py-1.5 text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-800">{children}</dd>
    </div>
  );
}

export function FeatureDetails({
  feature,
  onClear,
}: {
  feature: GraphFeature | null;
  onClear: () => void;
}) {
  if (feature === null) {
    return (
      <p className="text-sm text-slate-500">
        Hacé clic en una vereda, un cruce o un cordón del mapa para ver sus propiedades.
      </p>
    );
  }

  const properties = feature.properties;
  // `street_name` sólo existe en la vereda: no es un dato que falte en las otras.
  const streetName = 'street_name' in properties ? properties.street_name : null;

  return (
    <div>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-800">
            {KIND_LABELS[properties.element_kind]} #{properties.element_id}
          </h2>
          <p className="text-xs text-slate-500">Elemento seleccionado</p>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
        >
          Limpiar
        </button>
      </div>

      <dl>
        <Row label="element_kind">{properties.element_kind}</Row>
        <Row label="element_id">{properties.element_id}</Row>
        <Row label="level">
          {levelLabel(properties.level)}
          <span className="ml-2 font-mono text-xs text-slate-500">
            {properties.level ?? 'null'}
          </span>
        </Row>
        <Row label="is_verified">{properties.is_verified ? 'Sí' : 'No'}</Row>
        {properties.element_kind === 'sidewalk' && (
          <Row label="street_name">{streetName ?? 'Sin nombre'}</Row>
        )}
      </dl>
    </div>
  );
}
