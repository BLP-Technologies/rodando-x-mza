import { z } from 'zod';

export const OBSTACLE_SEVERITIES = ['MINOR', 'MODERATE', 'CRITICAL'] as const;
export type ObstacleSeverity = (typeof OBSTACLE_SEVERITIES)[number];

export const REPORT_STATUSES = [
  'PENDING',
  'APPROVED',
  'UNDER_REPAIR',
  'RESOLVED',
  'REJECTED',
] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const OBSTACLE_TYPES = [
  'VEREDA_ROTA',
  'FALTA_RAMPA',
  'RAMPA_BLOQUEADA',
  'CRUCE_INACCESIBLE',
  'POZO',
  'OBSTACULO_VEREDA',
  'ENTRADA_NO_ACCESIBLE',
  'OTRO',
] as const;
export type ObstacleType = (typeof OBSTACLE_TYPES)[number];



// Formato Point de PostGIS / GeoJSON
export interface GeoPoint {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

export interface ObstacleReport {
  id: string | number;
  user_id?: number | null;
  type_id?: number;
  type: ObstacleType;
  severity: ObstacleSeverity;
  description?: string;
  address?: string;
  geom: GeoPoint;
  image_url?: string | null;
  photoUri?: string | null;
  status?: ReportStatus;
  obstacle_id?: number | null;
  is_resolved?: boolean;
  sidewalk_id?: number | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  
}

export type CreateObstacleInput = {
  type: ObstacleType;
  severity?: ObstacleSeverity;
  description?: string;
  address?: string;
  latitude: number;
  longitude: number;
  photoUri?: string | null;
  sidewalk_id?: number | null;
};