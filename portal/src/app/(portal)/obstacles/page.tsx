/**
 * `/obstacles`: el mapa de los obstáculos publicados.
 *
 * Orquesta y no implementa: la pantalla vive en `src/obstacles/`, la API en `src/api/`
 * ([16 §8](../../docs/16-el-portal.md)).
 */

import { ObstaclesPanel } from '@/obstacles/obstacles-panel';

export default function ObstaclesPage() {
  return <ObstaclesPanel />;
}
