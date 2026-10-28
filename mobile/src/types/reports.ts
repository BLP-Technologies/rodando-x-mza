export type ObstacleType =
  | 'VEREDA_ROTA'
  | 'FALTA_RAMPA'
  | 'RAMPA_BLOQUEADA'
  | 'OBSTACULO_VEREDA'
  | 'CRUCE_INACCESIBLE'
  | 'ENTRADA_NO_ACCESIBLE'
  | 'POZO'
  | 'OTRO';

export type ObstacleSeverity = 'CRITICAL' | 'MODERATE' | 'MINOR';

// Formato Point de PostGIS / GeoJSON
export interface GeoPoint {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

export interface ObstacleReport {
  id: string | number;
  sidewalk_id?: number | null;
  geom: GeoPoint;
  type: ObstacleType;
  severity: ObstacleSeverity;
  is_resolved: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;

  // Metadata adicional útil para la UI local (opcional)
  address?: string;
  description?: string;
  photoUri?: string | null;
}

export type CreateObstacleInput = {
  sidewalk_id?: number | null;
  latitude: number;
  longitude: number;
  type: ObstacleType;
  severity?: ObstacleSeverity;
  address?: string;
  description?: string;
  photoUri?: string | null;
};