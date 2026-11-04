"use client";

/**
 * El panel del recorrido: el resumen, el aviso de tramos sin relevar y la lista de tramos.
 *
 * **Los tres estados de la respuesta se muestran distinto, y ninguno se confunde con una
 * falla** ([13 §6](../../docs/13-api-de-ruteo.md),
 * [15 §5](../../docs/15-integracion-con-el-cliente.md)):
 *
 * - `found: true` con tramos: el recorrido y su resumen.
 * - `found: true` con `legs` vacío: las dos puntas se pegaron al mismo cordón, y eso es un
 *   recorrido de cero metros, no un error.
 * - `found: false`: no hay camino. Es un cartel informativo, sin rojo y sin reintentar,
 *   porque volver a pedirlo va a devolver lo mismo mientras el dato no cambie.
 *
 * El costo se explica en pantalla y no sólo se muestra: los metros ponderados por el nivel
 * son la unidad con la que el motor eligió este camino, y sin la línea que lo dice el número
 * parece un error de cuenta ([09 §4.7](../../docs/09-modelo-de-datos.md)).
 */

import type { RouteResponse } from "@/api/routes";
import { levelLabel, lineStyle } from "@/map/feature-style";
import {
  DESTINATION_COLOR,
  formatMeters,
  LEG_KIND_LABELS,
  ORIGIN_COLOR,
  verificationLabel,
} from "./route-labels";

type RouteDetailsProps = {
  /** El último recorrido pedido, o `null` si todavía no se pidió ninguno. */
  route: RouteResponse | null;
  isPending: boolean;
};

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

/**
 * Una punta pegada: a qué nodo se pegó y cuánto se movió respecto del punto marcado.
 *
 * La distancia no es un detalle de implementación: el recorrido empieza en el cordón y no
 * donde está el pin, y sin este número la ruta parece nacer en una esquina ajena
 * ([13 §4.2](../../docs/13-api-de-ruteo.md)).
 */
function Endpoint({
  label,
  color,
  nodeId,
  distance,
}: {
  label: string;
  color: string;
  nodeId: number;
  distance: number;
}) {
  return (
    <p className="flex items-center gap-2 text-xs text-slate-600">
      <span
        aria-hidden
        className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-white"
        style={{ backgroundColor: color }}
      />
      <span>
        <span className="font-medium text-slate-700">{label}</span> en el nodo #
        {nodeId}, a {formatMeters(distance)} del punto marcado
      </span>
    </p>
  );
}

export function RouteDetails({ route, isPending }: RouteDetailsProps) {
  if (route === null) {
    return (
      <p className="text-sm text-slate-500">
        {isPending
          ? "Calculando…"
          : "Marcá origen y destino y pedí el recorrido."}
      </p>
    );
  }

  const endpoints = (
    <div className="flex flex-col gap-1">
      <Endpoint
        label="Origen"
        color={ORIGIN_COLOR}
        nodeId={route.origin.node.id}
        distance={route.origin.distance_m}
      />
      <Endpoint
        label="Destino"
        color={DESTINATION_COLOR}
        nodeId={route.destination.node.id}
        distance={route.destination.distance_m}
      />
    </div>
  );

  if (!route.found) {
    return (
      <div className="flex flex-col gap-3 text-sm">
        {endpoints}
        <div
          role="status"
          className="rounded border border-slate-300 bg-slate-50 px-3 py-2"
        >
          <p className="font-medium text-slate-800">
            No hay recorrido accesible entre esos puntos.
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Las dos puntas se pegaron al grafo, pero no quedaron conectadas por
            ningún camino que no pase por un tramo marcado como no accesible.
            Probá con otros puntos.
          </p>
        </div>
      </div>
    );
  }

  const { summary, legs } = route;

  return (
    <div className="flex flex-col gap-3 text-sm">
      {endpoints}

      <dl>
        <Row label="Distancia">{formatMeters(summary.meters)}</Row>
        <Row label="Costo">{formatMeters(summary.cost)}</Row>
        <Row label="Sin relevar">{formatMeters(summary.unverified_meters)}</Row>
        <Row label="Cruces">{summary.crossings}</Row>
      </dl>

      {summary.unverified_meters > 0 && (
        <p
          role="status"
          className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900"
        >
          {formatMeters(summary.unverified_meters)} de{" "}
          {formatMeters(summary.meters)} se apoyan en tramos sin relevar.
        </p>
      )}

      {legs.length === 0 ? (
        <p className="rounded border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Las dos puntas se pegaron al mismo cordón: el recorrido es de cero
          metros.
        </p>
      ) : (
        <ol className="flex flex-col">
          {legs.map((leg, index) => (
            <li
              // El par `element_kind` + `element_id` se repite si un recorrido pasa dos veces
              // por el mismo tramo, así que el orden entra en la clave.
              key={`${index}-${leg.element_kind}-${leg.element_id}`}
              className="border-b border-slate-100 py-1.5"
            >
              <div className="flex justify-between gap-2">
                <span className="flex items-center gap-2 font-medium text-slate-800">
                  <span
                    aria-hidden
                    className="inline-block h-1.5 w-4 shrink-0"
                    style={{
                      backgroundColor: lineStyle(leg.level, false).color,
                    }}
                  />
                  {LEG_KIND_LABELS[leg.element_kind]} #{leg.element_id}
                </span>
                <span className="shrink-0 text-slate-700">
                  {formatMeters(leg.meters)}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {levelLabel(leg.level)} · {verificationLabel(leg.is_verified)}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
