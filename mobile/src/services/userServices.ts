// src/services/userService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProfile, UpdateUserNameSchema } from '@/types/user';
import { USE_MOCK, apiFetch } from '@/services/apiClient';

const USER_STORAGE_KEY = '@rodando_mza_user';

export const userService = {
  
  // Obtener la sesión local o consultar datos propios
  async getCurrentUser(): Promise<UserProfile | null> {
    try {
      const data = await AsyncStorage.getItem(USER_STORAGE_KEY);
      return data ? (JSON.parse(data) as UserProfile) : null;
    } catch (error) {
      console.error('Error al recuperar usuario:', error);
      return null;
    }
  },

  // Actualizar únicamente el nombre del usuario autenticado
  async updateCurrentUserName(
    newName: string,
    fallbackUser?: { nombre?: string; email?: string } | null
  ): Promise<UserProfile> {
    const validated = UpdateUserNameSchema.parse({ name: newName });
    
    // 1. Buscamos en AsyncStorage o usamos los datos en memoria si existen
    let current = await this.getCurrentUser();

    if (!current) {
      if (fallbackUser && fallbackUser.email) {
        current = {
          id: 1,
          name: fallbackUser.nombre || validated.name,
          email: fallbackUser.email,
          is_moderator: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          deleted_at: null,
        };
      } else {
        // Mock por defecto para pruebas si no hubiera sesión previa
        current = {
          id: 1,
          name: 'Lu',
          email: 'lu@rodandomza.com',
          is_moderator: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          deleted_at: null,
        };
      }
    }

    if (!USE_MOCK) {
      const res = await apiFetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: validated.name }),
      });

      if (!res.ok) throw new Error('Error al actualizar nombre en el servidor');
      const updatedBackend = await res.json();
      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updatedBackend));
      return updatedBackend;
    }

    // Persistencia local
    const updated: UserProfile = {
      ...current,
      name: validated.name,
      updated_at: new Date().toISOString(),
    };

    await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  },

  // Eliminar su propia cuenta (si la app contempla la opción de "Dar de baja mi cuenta")
  async deleteAccount(): Promise<void> {
    if (!USE_MOCK) {
      await apiFetch('/api/users/me', { method: 'DELETE' });
    }
    await AsyncStorage.removeItem(USER_STORAGE_KEY);
  },
};