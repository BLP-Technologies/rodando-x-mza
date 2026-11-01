import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ObstacleReport,
  CreateObstacleInput,
  ObstacleType,
  ObstacleSeverity,
} from '@/types/reports';
import { USE_MOCK, apiFetch } from '@/services/apiClient';

const OBSTACLES_STORAGE_KEY = '@rodando_mza:obstacles_reports';

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


export const reportsService = {
  
  // GET /api/reports
  async getAll(): Promise<ObstacleReport[]> {
    if (!USE_MOCK) {
      const res = await apiFetch('/api/reports');
      return res.json();
    }
    try {
      const data = await AsyncStorage.getItem(OBSTACLES_STORAGE_KEY);
      if (!data) return [];
      return JSON.parse(data) as ObstacleReport[];
    } catch (error) {
      console.error('Error al recuperar reportes de obstáculos:', error);
      return [];
    }
  },

  //POST /api/reports
  async create(input: CreateObstacleInput): Promise<ObstacleReport> {
    const severity = input.severity || resolveDefaultSeverity(input.type);

    if (!USE_MOCK) {
      // Estructura que espera la tabla REPORTS en el backend
      const payload = {
        type_code: input.type,
        severity,
        description: input.description,
        address: input.address,
        latitude: input.latitude,
        longitude: input.longitude,
        image_url: input.photoUri,
        sidewalk_id: input.sidewalk_id ?? null,
      };

      const res = await apiFetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return res.json();
    }
    
    //Modo local / Mock con AsyncStorage
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
      console.error('Error al guardar el reporte de obstáculo:', error);
      throw error;
    }
  },

  // DELETE /api/reports/:id
  async delete(id: string | number): Promise<void> {

    if (!USE_MOCK) {
      await apiFetch(`/api/reports/${id}`, { method: 'DELETE' });
      return;
    }
    try {
      const existing = await this.getAll();
      const updated = existing.filter((item) => item.id !== id);
      await AsyncStorage.setItem(OBSTACLES_STORAGE_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error(`Error al eliminar el obstáculo con id ${id}:`, error);
      throw error;
    }
  },

  //clearAll: Reset / Limpieza local
  async clearAll(): Promise<void> {
    try {
      await AsyncStorage.removeItem(OBSTACLES_STORAGE_KEY);
    } catch (error) {
      console.error('Error al limpiar reportes locales:', error);
      throw error;
    }
  },
};