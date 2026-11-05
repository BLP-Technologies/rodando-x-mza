/**
 * Verifica si un punto [lat, lon] está dentro de un anillo 
 * de polígono [[lat, lon], ...]
 */
export function isPointInPolygon(
  point: { latitude: number; longitude: number },
  polygonCoords: [number, number][] // Array de pares [lat, lon]
): boolean {
  const { latitude: x, longitude: y } = point;
  let inside = false;

  for (let i = 0, j = polygonCoords.length - 1; i < polygonCoords.length; j = i++) {
    const [xi, yi] = polygonCoords[i];
    const [xj, yj] = polygonCoords[j];

    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
}