import AsyncStorage from '@react-native-async-storage/async-storage';
import { Route, CreateRouteInput, UpdateRouteInput, RouteSchema } from '@/types/routes';
import initialRoutesData from '@/data/mockRoutes.json';

const ROUTES_STORAGE_KEY = '@rodando_mza_routes_v1';

const simulateNetworkDelay = (ms = 250) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const routesService = {
  // GET /api/routes
  async getAll(): Promise<Route[]> {
    await simulateNetworkDelay();
    try {
      const stored = await AsyncStorage.getItem(ROUTES_STORAGE_KEY);
      if (!stored) {
        const seed = initialRoutesData as Route[];
        await AsyncStorage.setItem(ROUTES_STORAGE_KEY, JSON.stringify(seed));
        return seed;
      }
      return JSON.parse(stored) as Route[];
    } catch (error) {
      console.error('Error al recuperar recorridos:', error);
      return initialRoutesData as Route[];
    }
  },

  // GET /api/routes/:id
  async getById(id: string): Promise<Route | null> {
    await simulateNetworkDelay();
    const routes = await this.getAll();
    return routes.find((r) => r.id === id) || null;
  },

  // POST /api/routes
  async create(routeInput: CreateRouteInput): Promise<Route> {
    await simulateNetworkDelay();
    const routes = await this.getAll();

    const now = new Date().toISOString();
    const newRoute: Route = {
      ...routeInput,
      id: `route_${Date.now()}`,
      createdAt: now,
      updatedAt: now,
    };

    RouteSchema.parse(newRoute);

    const updatedRoutes = [newRoute, ...routes];
    await AsyncStorage.setItem(ROUTES_STORAGE_KEY, JSON.stringify(updatedRoutes));
    return newRoute;
  },

  // PUT /api/routes/:id
  async update(id: string, updateData: UpdateRouteInput): Promise<Route> {
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
};