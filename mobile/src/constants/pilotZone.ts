/**
 * Polígono del Área de Servicio Piloto - Ciudad de Mendoza
 * Delimitada por el cuadrilátero de las 4 plazas:
 * Plaza Chile (NO) -> Plaza San Martín (NE) -> Plaza España (SE) -> Plaza Italia (SO)
 *
 * Formato: [latitud, longitud] en orden perimetral cerrado
 */
export const MENDOZA_PILOT_ZONE: [number, number][] = [
  [-32.8870, -68.8485], // Vértice Noroeste (Plaza Chile - límite Perú / Necochea)
  [-32.8870, -68.8375], // Vértice Noreste  (Plaza San Martín - límite 9 de Julio / Necochea)
  [-32.8940, -68.8375], // Vértice Sureste  (Plaza España - límite 9 de Julio / Montevideo)
  [-32.8940, -68.8485], // Vértice Suroeste (Plaza Italia - límite Perú / Montevideo)
];

/**
 * Coordenadas de referencia de los centros de cada plaza por si las necesitás como puntos de interés
 */
export const PILOT_ZONE_LANDMARKS = {
  plazaChile: { lat: -32.8885, lon: -68.8470, name: 'Plaza Chile' },
  plazaSanMartin: { lat: -32.8885, lon: -68.8390, name: 'Plaza San Martín' },
  plazaEspana: { lat: -32.8925, lon: -68.8390, name: 'Plaza España' },
  plazaItalia: { lat: -32.8925, lon: -68.8470, name: 'Plaza Italia' },
  plazaIndependencia: { lat: -32.8895, lon: -68.8440, name: 'Plaza Independencia (Centro)' },
};