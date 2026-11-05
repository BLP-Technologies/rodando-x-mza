import { apiFetch } from './apiClient';

export interface ServiceAreaFeature {
  type: 'Feature';
  geometry: {
    type: 'Polygon';
    coordinates: [number, number][][]; // [lon, lat]
  };
  properties: {
    id: number;
    name: string;
  };
}

export interface ServiceAreasCollection {
  type: 'FeatureCollection';
  features: ServiceAreaFeature[];
}

export const getServiceAreas = async (): Promise<ServiceAreasCollection> => {
  const response = await apiFetch('/api/service-areas');
  if (!response.ok) {
    throw new Error(`Error al obtener áreas de servicio: ${response.statusText}`);
  }
  return response.json();
};