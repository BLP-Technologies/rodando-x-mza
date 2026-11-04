import AsyncStorage from '@react-native-async-storage/async-storage';
import { Place, CreatePlaceInput, UpdatePlaceInput } from '@/types/places';
import { USE_MOCK, apiFetch } from '@/services/apiClient';
import initialPlacesData from '@/data/mockPlaces.json';

const STORAGE_KEY = '@rodando_mza_places_v1';

const simulateNetworkDelay = (ms = 250) => 
  new Promise((resolve) => setTimeout(resolve, ms));

export const placesService = {
  // GET /places
  async getAll(): Promise<Place[]> {
    if (!USE_MOCK) {
      try {
        const res = await apiFetch('/api/places');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) return data;
          if (data && Array.isArray(data.data)) return data.data;
        }
      } catch (error) {
        console.warn('Fallo en /places, usando almacenamiento local:', error);
      }
    }

    await simulateNetworkDelay();
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (!stored) {
        const seedData = initialPlacesData as Place[];
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(seedData));
        return seedData;
      }
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error al obtener lugares:', error);
      return [];
    }
  },

  // GET /places/:id
  async getById(id: string | number): Promise<Place | null> {
    if (!USE_MOCK) {
      try {
        const res = await apiFetch(`/places/${id}`);
        if (res.ok) return await res.json();
      } catch (error) {
        console.warn(`Fallo al obtener lugar ${id} en backend:`, error);
      }
    }

    await simulateNetworkDelay();
    const places = await this.getAll();
    return places.find((p) => String(p.id) === String(id)) || null;
  },

  // POST /places
  async create(placeData: CreatePlaceInput): Promise<Place> {
    if (!USE_MOCK) {
      try {
        const res = await apiFetch('/api/places', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: placeData.name,
            address: placeData.address, // <-- Enviamos 'address' como espera Zod
            category: placeData.category,
            latitude: placeData.latitude,
            longitude: placeData.longitude,
          }),
        });

        if (res.ok) {
          const savedPlace = await res.json();
          console.log('✅ Lugar persistido en PostgreSQL:', savedPlace);
          return savedPlace;
        } else {
          const errorBody = await res.json().catch(() => ({}));
          console.error('❌ Error del backend al crear lugar:', res.status, errorBody);
        }
      } catch (error) {
        console.warn('Fallo de red en POST /places, recurriendo a local:', error);
      }
    }

    // Fallback local solo si USE_MOCK es true o falló el backend
    await simulateNetworkDelay();
    const places = await this.getAll();
    
    const newPlace: Place = {
      ...placeData,
      id: `place_${Date.now()}`,
    };

    const updatedList = [...places, newPlace];
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
    return newPlace;
  },

  // PATCH /places/:id
  async update(id: string | number, placeData: UpdatePlaceInput): Promise<Place> {
    if (!USE_MOCK) {
      try {
        const res = await apiFetch(`/api/places/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(placeData),
        });
        if (res.ok) return await res.json();
      } catch (error) {
        console.warn(`Fallo al actualizar lugar ${id} en backend:`, error);
      }
    }

    await simulateNetworkDelay();
    const places = await this.getAll();
    const index = places.findIndex((p) => String(p.id) === String(id));

    if (index === -1) {
      throw new Error('Lugar no encontrado en la base de datos');
    }

    const updatedPlace: Place = {
      ...places[index],
      ...placeData,
    };

    places[index] = updatedPlace;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(places));
    return updatedPlace;
  },

  // DELETE /places/:id
  async delete(id: string | number): Promise<void> {
    if (!USE_MOCK) {
      try {
        const res = await apiFetch(`/api/places/${id}`, { method: 'DELETE' });
        if (res.ok) return;
      } catch (error) {
        console.warn(`Fallo al eliminar lugar ${id} en backend:`, error);
      }
    }

    await simulateNetworkDelay();
    const places = await this.getAll();
    const filtered = places.filter((p) => String(p.id) !== String(id));
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  },

  async resetToDefault(): Promise<Place[]> {
    const seedData = initialPlacesData as Place[];
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(seedData));
    return seedData;
  },
};