/**
 * El panel con las propiedades del elemento seleccionado.
 *
 * Las propiedades del grafo vienen en la respuesta de la lectura ([14 §7](../../docs/14-la-api-del-grafo.md)).
 * Lo único que se pide aparte son los obstáculos del elemento, que son otra lectura: la del
 * grafo no los trae ([18 §4](../../docs/18-la-api-de-obstaculos.md)).
 */

import { useQuery } from '@tanstack/react-query';

import type { GraphFeature } from '@/api/graph';
import { obstacleQueryKey, readObstacles } from '@/api/obstacles';
import { SEVERITY_COLORS, SEVERITY_LABELS, obstacleStateLabel } from '@/obstacles/obstacle-labels';
import { levelLabel } from './feature-style';
import { LevelForm } from './level-form';

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

/**
 * Los obstáculos que cuelgan de un elemento del grafo.
 *
 * Lee la misma query que la pantalla de `/obstacles` con `status='ALL'` —así comparte la
 * entrada de caché y ve también lo resuelto— y filtra en el cliente por
 * `element_kind`/`element_id`: el servidor no tiene un filtro por elemento y agregarlo sería
 * un parámetro para un caso que el cliente resuelve con lo que ya recibió.
 *
 * **No puede romper la ficha.** Mientras la lectura está en curso, o si falla, no se dibuja
 * nada: las propiedades del elemento y su nivel son la ficha, y esta lista es un agregado.
 */
function ElementObstacles({
  kind,
  id,
}: {
  kind: GraphFeature['properties']['element_kind'];
  id: number;
}) {
  const { data } = useQuery({
    queryKey: obstacleQueryKey('ALL'),
    queryFn: () => readObstacles('ALL'),
    retry: 1,
  });

  if (data === undefined) return null;

  const obstacles = data.features
    .filter(
      (obstacle) =>
        obstacle.properties.element_kind === kind && obstacle.properties.element_id === id,
    )
    // Los activos primero: lo que sigue en la calle es lo que importa, y lo resuelto queda
    // como historia del elemento ([09 §4.5](../../docs/09-modelo-de-datos.md)).
    .sort(
      (first, second) =>
        Number(first.properties.resolved_at !== null) -
        Number(second.properties.resolved_at !== null),
    );

  return (
    <section className="mt-4 border-t border-slate-100 pt-3">
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
        Obstáculos
      </h3>

      {obstacles.length === 0 ? (
        <p className="text-sm text-slate-500">Sin obstáculos registrados.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {obstacles.map((obstacle) => (
            <li
              key={obstacle.properties.id}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span className="truncate text-slate-700">{obstacle.properties.type_name}</span>
              <span className="flex shrink-0 items-center gap-1.5">
                <span
                  className={`rounded border px-2 py-0.5 text-xs font-medium ${SEVERITY_COLORS[obstacle.properties.severity]}`}
                >
                  {SEVERITY_LABELS[obstacle.properties.severity]}
                </span>
                <span className="text-xs text-slate-500">{obstacleStateLabel(obstacle)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
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

      <ElementObstacles
        kind={properties.element_kind}
        id={properties.element_id}
      />

      {/* `key` por elemento: al cambiar la selección el formulario arranca en el nivel
          del elemento nuevo y no en el que se estaba eligiendo. */}
      <LevelForm
        key={`${properties.element_kind}:${properties.element_id}`}
        feature={feature}
      />
    </div>
  );
}
