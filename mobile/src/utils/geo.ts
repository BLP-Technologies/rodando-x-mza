import { ServiceAreasCollection } from '@/services/serviceAreasService';

/**
 * Valida si [lat, lon] cae dentro del polígono del área de servicio.
 * Coordenadas de GeoJSON vienen en [lon, lat].
 */
export function isPointInServiceArea(
  lat: number,
  lon: number,
  serviceAreas: ServiceAreasCollection | null
): boolean {
  if (!serviceAreas || !serviceAreas.features || serviceAreas.features.length === 0) {
    // Si no cargó aún el área de servicio, por defecto no bloqueamos
    return true;
  }

  // Comprobamos contra cualquiera de los polígonos activos
  return serviceAreas.features.some((feature) => {
    const ring = feature.geometry.coordinates[0]; // Exterior ring
    let inside = false;

    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0]; // lon
      const yi = ring[i][1]; // lat
      const xj = ring[j][0]; // lon
      const yj = ring[j][1]; // lat

      const intersect =
        yi > lat !== yj > lat &&
        lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;

      if (intersect) inside = !inside;
    }

    return inside;
  });
}