import { Tutorial } from '@/types/tutorials';
import { USE_MOCK, apiFetch } from '@/services/apiClient';
import mockTutorialsData from '@/data/mockTutoriales.json';

const simulateNetworkDelay = (ms = 200) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const tutorialsService = {
  
    // GET /api/tutorials
  async getAll(): Promise<Tutorial[]> {
    if (!USE_MOCK) {
      const response = await apiFetch('/api/tutorials');
      if (!response.ok) {
        throw new Error('Error al obtener la lista de tutoriales');
      }
      return response.json();
    }

    await simulateNetworkDelay();
    return mockTutorialsData as Tutorial[];
  },

  // GET /api/tutorials/:id
  async getById(id: number | string): Promise<Tutorial | null> {
    if (!USE_MOCK) {
      const response = await apiFetch(`/api/tutorials/${id}`);
      return response.ok ? response.json() : null;
    }

    await simulateNetworkDelay();
    const tutorials = mockTutorialsData as Tutorial[];
    return tutorials.find((t) => String(t.id) === String(id)) || null;
  },

  // Filtrado por categoría en memoria o parámetro de búsqueda
  async getByCategory(categoryName: string): Promise<Tutorial[]> {
    const list = await this.getAll();
    if (!categoryName || categoryName === 'TODOS') {
      return list;
    }
    return list.filter(
      (item) => item.category.toLowerCase() === categoryName.toLowerCase()
    );
  },
};