/**
 * `/`: el mapa del grafo, que es la pantalla del portal.
 *
 * Orquesta y no implementa: el mapa vive en `src/map/`, la sesión en
 * `src/session/` y la API en `src/api/` ([16 §3](../../docs/16-el-portal.md)).
 */

import { MapPanel } from '@/map/map-panel';

export default function PortalPage() {
  return <MapPanel />;
}
