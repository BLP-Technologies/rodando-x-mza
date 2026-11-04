import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ObstacleReport,
  CreateObstacleInput,
  ObstacleType,
  ObstacleSeverity,
} from '@/types/reports';
import { USE_MOCK, apiFetch } from '@/services/apiClient';

const OBSTACLES_STORAGE_KEY = '@rodando_mza:obstacles_reports';

/**
 * Mapea el tipo local de la app móvil al código oficial del catálogo en PostgreSQL.
 */
function mapLocalTypeToBackendCode(type: ObstacleType): string {
  switch (type) {
    case 'POZO':
      return 'POTHOLE';
    case 'VEREDA_ROTA':
      return 'BROKEN_PAVEMENT';
    case 'FALTA_RAMPA':
      return 'MISSING_RAMP';
    case 'RAMPA_BLOQUEADA':
    case 'CRUCE_INACCESIBLE':
    case 'OBSTACULO_VEREDA':
    case 'ENTRADA_NO_ACCESIBLE':
      return 'BLOCKED_PASSAGE';
    case 'OTRO':
    default:
      return 'OTHER';
  }
}

/**
 * Convierte el código de la base de datos de vuelta al tipo local de la app.
 */
function mapBackendCodeToLocalType(code: string): ObstacleType {
  switch (code) {
    case 'POTHOLE':
      return 'POZO';
    case 'BROKEN_PAVEMENT':
    case 'MISSING_SIDEWALK':
      return 'VEREDA_ROTA';
    case 'MISSING_RAMP':
      return 'FALTA_RAMPA';
    case 'BLOCKED_PASSAGE':
    case 'CONSTRUCTION':
    case 'TREE':
    case 'STEP':
    case 'STEEP_SLOPE':
    case 'NARROWING':
      return 'OBSTACULO_VEREDA';
    case 'OTHER':
    default:
      return 'OTRO';
  }
}

export const resolveDefaultSeverity = (type: ObstacleType): ObstacleSeverity => {
  switch (type) {
    case 'VEREDA_ROTA':
    case 'FALTA_RAMPA':
    case 'RAMPA_BLOQUEADA':
    case 'CRUCE_INACCESIBLE':
    case 'POZO':
      return 'CRITICAL';
    case 'OBSTACULO_VEREDA':
    case 'ENTRADA_NO_ACCESIBLE':
      return 'MODERATE';
    case 'OTRO':
    default:
      return 'MINOR';
  }
};

// Contrato de respuesta GeoJSON de GET /api/reports
interface BackendReportFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [lon, lat]
  };
  properties: {
    id: number;
    status: 'PENDING' | 'APPROVED' | 'UNDER_REPAIR' | 'RESOLVED' | 'REJECTED';
    type: string;
    type_name: string;
    severity: 'MINOR' | 'MODERATE' | 'CRITICAL';
    description: string;
    image_url: string | null;
    obstacle_id: number | null;
    created_at: string;
  };
}

interface BackendReportsResponse {
  type: 'FeatureCollection';
  truncated: boolean;
  features: BackendReportFeature[];
}

function mapFeatureToObstacleReport(f: BackendReportFeature): ObstacleReport {
  const [lon, lat] = f.geometry.coordinates;
  return {
    id: f.properties.id,
    user_id: null,
    sidewalk_id: null,
    geom: {
      type: 'Point',
      coordinates: [lon, lat],
    },
    type: mapBackendCodeToLocalType(f.properties.type),
    severity: f.properties.severity as ObstacleSeverity,
    status: f.properties.status,
    is_resolved: f.properties.status === 'RESOLVED',
    created_at: f.properties.created_at,
    updated_at: f.properties.created_at,
    deleted_at: null,
    address: '',
    description: f.properties.description,
    photoUri: f.properties.image_url ?? undefined,
    image_url: f.properties.image_url ?? undefined,
  };
}

export const reportsService = {
  // GET /api/reports
  async getAll(): Promise<ObstacleReport[]> {
    if (!USE_MOCK) {
      try {
        const res = await apiFetch('/api/reports');
        const data = (await res.json()) as BackendReportsResponse;

        if (data.features && Array.isArray(data.features)) {
          return data.features.map(mapFeatureToObstacleReport);
        }
        return [];
      } catch (error) {
        console.error('Error al obtener reportes del backend, usando almacenamiento local:', error);
      }
    }

    try {
      const data = await AsyncStorage.getItem(OBSTACLES_STORAGE_KEY);
      if (!data) return [];
      return JSON.parse(data) as ObstacleReport[];
    } catch (error) {
      console.error('Error al recuperar reportes de obstáculos locales:', error);
      return [];
    }
  },

  // POST /api/reports
  async create(input: CreateObstacleInput): Promise<ObstacleReport> {
    const severity = input.severity || resolveDefaultSeverity(input.type);

    if (!USE_MOCK) {
      const rawDesc = input.description?.trim() || 'Obstáculo reportado';
      const fullDescription = input.address
        ? `${rawDesc} (${input.address})`.trim().slice(0, 300)
        : rawDesc.slice(0, 300);

      const isValidUrl = input.photoUri?.startsWith('http://') || input.photoUri?.startsWith('https://');

      // Validado contra createReportRequestSchema (strictObject)
      const payload: {
        type: string;
        severity: 'MINOR' | 'MODERATE' | 'CRITICAL';
        description: string;
        geom: { lon: number; lat: number };
        image_url?: string;
      } = {
        type: mapLocalTypeToBackendCode(input.type),
        severity: severity as 'MINOR' | 'MODERATE' | 'CRITICAL',
        description: fullDescription,
        geom: {
          lon: Number(input.longitude),
          lat: Number(input.latitude),
        },
      };

      if (isValidUrl && input.photoUri) {
        payload.image_url = input.photoUri;
      }

      try {
        const res = await apiFetch('/api/reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const created = (await res.json()) as {
          id: number;
          type: string;
          severity: 'MINOR' | 'MODERATE' | 'CRITICAL';
          status: 'PENDING' | 'APPROVED' | 'UNDER_REPAIR' | 'RESOLVED' | 'REJECTED';
        };

        const now = new Date().toISOString();
        const mappedCreated: ObstacleReport = {
          id: created.id,
          user_id: null,
          sidewalk_id: input.sidewalk_id ?? null,
          geom: {
            type: 'Point',
            coordinates: [Number(input.longitude), Number(input.latitude)],
          },
          type: mapBackendCodeToLocalType(created.type),
          severity: created.severity as ObstacleSeverity,
          status: created.status,
          is_resolved: false,
          created_at: now,
          updated_at: now,
          deleted_at: null,
          address: input.address,
          description: input.description,
          photoUri: input.photoUri,
          image_url: input.photoUri,
        };

        const existing = await this.getAll().catch(() => []);
        await AsyncStorage.setItem(OBSTACLES_STORAGE_KEY, JSON.stringify([mappedCreated, ...existing]));

        return mappedCreated;
      } catch (error) {
        console.error('Error al persistir reporte en el backend:', error);
        throw error;
      }
    }

    // Modo local / Mock con AsyncStorage
    try {
      const existing = await this.getAll();
      const now = new Date().toISOString();

      const newObstacle: ObstacleReport = {
        id: Date.now(),
        user_id: null,
        sidewalk_id: input.sidewalk_id ?? null,
        geom: {
          type: 'Point',
          coordinates: [input.longitude, input.latitude],
        },
        type: input.type,
        severity,
        status: 'PENDING',
        is_resolved: false,
        created_at: now,
        updated_at: now,
        deleted_at: null,
        address: input.address,
        description: input.description,
        photoUri: input.photoUri,
        image_url: input.photoUri,
      };

      const updated = [newObstacle, ...existing];
      await AsyncStorage.setItem(OBSTACLES_STORAGE_KEY, JSON.stringify(updated));
      return newObstacle;
    } catch (error) {
      console.error('Error al guardar el reporte localmente:', error);
      throw error;
    }
  },

  // DELETE local / fallback
  async delete(id: string | number): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(OBSTACLES_STORAGE_KEY);
      if (!data) return;
      const existing = JSON.parse(data) as ObstacleReport[];
      const updated = existing.filter((item) => item.id !== id);
      await AsyncStorage.setItem(OBSTACLES_STORAGE_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error(`Error al eliminar obstáculo con id ${id}:`, error);
      throw error;
    }
  },

  async clearAll(): Promise<void> {
    try {
      await AsyncStorage.removeItem(OBSTACLES_STORAGE_KEY);
    } catch (error) {
      console.error('Error al limpiar reportes locales:', error);
      throw error;
    }
  },
};