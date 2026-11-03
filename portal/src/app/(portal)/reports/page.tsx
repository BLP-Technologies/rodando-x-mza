/**
 * `/reports`: la cola de reportes ciudadanos.
 *
 * Orquesta y no implementa: la pantalla vive en `src/reports/`, la API en `src/api/`
 * ([16 §8](../../docs/16-el-portal.md)).
 */

import { ReportsPanel } from '@/reports/reports-panel';

export default function ReportsPage() {
  return <ReportsPanel />;
}
