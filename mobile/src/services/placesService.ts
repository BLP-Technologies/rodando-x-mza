import AsyncStorage from '@react-native-async-storage/async-storage';
import { Place } from '@/types/places';
import initialPlacesData from '@/data/mockPlaces.json';

const STORAGE_KEY = '@rodando_mza_places_v1';

// Simula la latencia de red de una API real
const simulateNetworkDelay = (ms = 250) => 
  new Promise((resolve) => setTimeout(resolve, ms));

export const placesService = {
  // GET /api/places
  async getAll(): Promise<Place[]> {
    await simulateNetworkDelay();
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (!stored) {
        // Inicializa la base local con el archivo JSON semilla
        const seedData = initialPlacesData as Place[];
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(seedData));
        return seedData;
      }
      return JSON.parse(stored) as Place[];
    } catch (error) {
      console.error('Error al obtener lugares:', error);
      return initialPlacesData as Place[];
    }
  },

  // GET /api/places/:id
  async getById(id: string): Promise<Place | null> {
    await simulateNetworkDelay();
    const places = await this.getAll();
    return places.find((p) => p.id === id) || null;
  },

  // POST /api/places
  async create(placeData: Omit<Place, 'id'>): Promise<Place> {
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

  // PUT /api/places/:id
  async update(id: string, placeData: Partial<Place>): Promise<Place> {
    await simulateNetworkDelay();
    const places = await this.getAll();
    const index = places.findIndex((p) => p.id === id);

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

  // DELETE /api/places/:id
  async delete(id: string): Promise<void> {
    await simulateNetworkDelay();
    const places = await this.getAll();
    const filtered = places.filter((p) => p.id !== id);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  },

  // Utilidad para pruebas: restablecer a los datos iniciales del JSON
  async resetToDefault(): Promise<Place[]> {
    const seedData = initialPlacesData as Place[];
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(seedData));
    return seedData;
  },
};