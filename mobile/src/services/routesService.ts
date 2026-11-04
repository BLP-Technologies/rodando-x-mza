import AsyncStorage from '@react-native-async-storage/async-storage';
import { Route, CreateRouteInput, UpdateRouteInput, RouteSchema } from '@/types/routes';
import { USE_MOCK, apiFetch } from '@/services/apiClient';
import initialRoutesData from '@/data/mockRoutes.json';


//Tipos
export interface RouteCalculationRequest {
  origin: { lat: number; lon: number };
  destination: { lat: number; lon: number };
}

export interface RouteLeg {
  element_kind: 'sidewalk' | 'crossing' | string;
  element_id: number;
  level: 'ACCESSIBLE' | 'PARTIAL' | 'NOT_ACCESSIBLE' | null;
  is_verified: boolean;
  meters: number;
  geometry: {
    type: 'LineString';
    coordinates: [number, number][]; // [lon, lat]
  };
}

export interface RouteCalculationResponse {
  found: boolean;
  origin: {
    node: { id: number; lat: number; lon: number };
    distance_m: number;
  };
  destination: {
    node: { id: number; lat: number; lon: number };
    distance_m: number;
  };
  summary: {
    meters: number;
    cost: number;
    crossings: number;
    unverified_meters: number;
  };
  legs: RouteLeg[];
}





const ROUTES_STORAGE_KEY = '@rodando_mza_routes_v1';

const simulateNetworkDelay = (ms = 250) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const routesService = {
  
  // GET /api/saved-routes (SAVED_ROUTES)
  async getAll(): Promise<Route[]> {

    if (!USE_MOCK) {
      try {
        const res = await apiFetch('/api/saved-routes');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) return data;
          if (data && Array.isArray(data.data)) return data.data;
          if (data && Array.isArray(data.routes)) return data.routes;
        } else {
          console.warn(`GET /api/saved-routes devolvió ${res.status}. Usando almacenamiento local como respaldo.`);
        }
      } catch (error) {
        console.warn('Fallo de red en /api/saved-routes. Usando respaldo local:', error);
      }
    }  

    await simulateNetworkDelay();
    try {
      const stored = await AsyncStorage.getItem(ROUTES_STORAGE_KEY);
      if (!stored) {
        const seed = initialRoutesData as Route[];
        await AsyncStorage.setItem(ROUTES_STORAGE_KEY, JSON.stringify(seed));
        return seed;
      }
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return initialRoutesData as Route[];
    }
  },

  // GET /api/routes/:id
  async getById(id: string): Promise<Route | null> {

    if (!USE_MOCK) {
      const res = await apiFetch(`/api/saved-routes/${id}`);
      return res.ok ? res.json() : null;
    }
    await simulateNetworkDelay();
    const routes = await this.getAll();
    return routes.find((r) => r.id === id) || null;
  },

  // POST /api/saved-routes
  async create(routeInput: CreateRouteInput): Promise<Route> {
    const now = new Date().toISOString();
    const newRoute: Route = {
      ...routeInput,
      id: `route_${Date.now()}`,
      createdAt: now,
      updatedAt: now,
    };

    if (!USE_MOCK) {
      // Formato compatible con SAVED_ROUTES en PostgreSQL / PostGIS
      try {
        const payload = {
        name: routeInput.name,
        start_point: {
          latitude: routeInput.origin.latitude,
          longitude: routeInput.origin.longitude,
          name: routeInput.origin.name,
        },
        end_point: {
          latitude: routeInput.destination.latitude,
          longitude: routeInput.destination.longitude,
          name: routeInput.destination.name,
        },
        distanceMeters: routeInput.distanceMeters,
        durationMinutes: routeInput.durationMinutes,
        coordinates: routeInput.coordinates,
      };

      const res = await apiFetch('/api/saved-routes', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (res.ok) {
          return await res.json();
        }
        console.warn(`POST /api/saved-routes devolvió ${res.status}. Guardando en almacenamiento local.`);
      } catch (err) {
        console.warn('Error en POST /api/saved-routes. Guardando en almacenamiento local:', err);
      }
    }

    await simulateNetworkDelay();
    const routes = await this.getAll();
    RouteSchema.parse(newRoute);
    const updatedRoutes = [newRoute, ...routes];
    await AsyncStorage.setItem(ROUTES_STORAGE_KEY, JSON.stringify(updatedRoutes));
    return newRoute;
  },

  // PUT /api/routes/:id
  async update(id: string, updateData: UpdateRouteInput): Promise<Route> {
    
    if (!USE_MOCK) {
      const res = await apiFetch(`/api/saved-routes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });
      return res.json();
    }
    await simulateNetworkDelay();
    const routes = await this.getAll();
    const index = routes.findIndex((r) => r.id === id);

    if (index === -1) {
      throw new Error(`Recorrido con id ${id} no encontrado`);
    }

    const updatedRoute: Route = {
      ...routes[index],
      ...updateData,
      updatedAt: new Date().toISOString(),
    };

    RouteSchema.parse(updatedRoute);

    routes[index] = updatedRoute;
    await AsyncStorage.setItem(ROUTES_STORAGE_KEY, JSON.stringify(routes));
    return updatedRoute;
  },

  // DELETE /api/routes/:id
  async delete(id: string): Promise<void> {

    if (!USE_MOCK) {
      await apiFetch(`/api/saved-routes/${id}`, { method: 'DELETE' });
      return;
    }
    await simulateNetworkDelay();
    const routes = await this.getAll();
    const filtered = routes.filter((r) => r.id !== id);
    await AsyncStorage.setItem(ROUTES_STORAGE_KEY, JSON.stringify(filtered));
  },

  // Restablecer a los datos iniciales
  async resetToDefault(): Promise<Route[]> {
    const seed = initialRoutesData as Route[];
    await AsyncStorage.setItem(ROUTES_STORAGE_KEY, JSON.stringify(seed));
    return seed;
  },

  async calculateRoute(params: RouteCalculationRequest): Promise<RouteCalculationResponse> {
    const res = await apiFetch('/api/routes/calculate', {
      method: 'POST',
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      const errorBody = await res.text().catch(() => '');
      throw new Error(`Error en el cálculo de ruta (${res.status}): ${errorBody}`);
    }

    const data: RouteCalculationResponse = await res.json();
    return data;
  },




};