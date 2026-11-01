/*
* Cliente base para decidir si responder
* con datos en memoria o hacer la llamada HTTP real
*/

import { Platform } from 'react-native';

// Cambiar a false cuando el backend esté listo
export const USE_MOCK = true;

// IP para emulador Android vs Web / Celular físico
const BASE_URL = Platform.select({
  android: 'http://10.0.2.2:3001',
  default: 'http://localhost:3001',
});

export const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
  if (USE_MOCK) {
    // Con json-server local:
    return fetch(`${BASE_URL}${endpoint}`, options);
  }

  // URL del backend real en producción o staging
  return fetch(`https://api.rodandoxmza.com.ar${endpoint}`, options);
};