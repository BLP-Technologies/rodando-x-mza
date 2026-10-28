import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ObstacleReport,
  CreateObstacleInput,
  ObstacleType,
  ObstacleSeverity,
} from '@/types/reports';

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

//getAll
export const reportsService = {
  async getAll(): Promise<ObstacleReport[]> {
    try {
      const data = await AsyncStorage.getItem(OBSTACLES_STORAGE_KEY);
      if (!data) return [];
      return JSON.parse(data) as ObstacleReport[];
    } catch (error) {
      console.error('Error al recuperar reportes de obstáculos:', error);
      return [];
    }
  },

  //create
  async create(input: CreateObstacleInput): Promise<ObstacleReport> {
    try {
      const existing = await this.getAll();
      const now = new Date().toISOString();

      const newObstacle: ObstacleReport = {
        id: Date.now(),
        sidewalk_id: input.sidewalk_id ?? null,
        geom: {
          type: 'Point',
          coordinates: [input.longitude, input.latitude],
        },
        type: input.type,
        severity: input.severity || resolveDefaultSeverity(input.type),
        is_resolved: false,
        created_at: now,
        updated_at: now,
        deleted_at: null,
        address: input.address,
        description: input.description,
        photoUri: input.photoUri,
      };

      const updated = [newObstacle, ...existing];
      await AsyncStorage.setItem(OBSTACLES_STORAGE_KEY, JSON.stringify(updated));
      return newObstacle;
    } catch (error) {
      console.error('Error al guardar el reporte de obstáculo:', error);
      throw error;
    }
  },
//delete
  async delete(id: string | number): Promise<void> {
    try {
      const existing = await this.getAll();
      const updated = existing.filter((item) => item.id !== id);
      await AsyncStorage.setItem(OBSTACLES_STORAGE_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error(`Error al eliminar el obstáculo con id ${id}:`, error);
      throw error;
    }
  },

  //clearAll
  async clearAll(): Promise<void> {
    try {
      await AsyncStorage.removeItem(OBSTACLES_STORAGE_KEY);
    } catch (error) {
      console.error('Error al limpiar reportes locales:', error);
      throw error;
    }
  },
};