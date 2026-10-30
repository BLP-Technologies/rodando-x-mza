export interface PlaceSuggestion {
  id: string;
  name: string;
  city?: string;
  state?: string;
  fullAddress: string;
  latitude: number;
  longitude: number;
}

// Coordenadas del Gran Mendoza para sesgar la búsqueda (lat: -32.89, lon: -68.84)
const MENDOZA_LAT = -32.8895;
const MENDOZA_LON = -68.8458;

export const searchAddressSuggestions = async (
  query: string
): Promise<PlaceSuggestion[]> => {
  if (!query || query.trim().length < 3) return [];

  try {
    const encodedQuery = encodeURIComponent(query.trim());
    // Photon API permite enviar lat y lon para priorizar resultados cercanos
    const url = `https://photon.komoot.io/api/?q=${encodedQuery}&lat=${MENDOZA_LAT}&lon=${MENDOZA_LON}&limit=6`;

    const response = await fetch(url);
    if (!response.ok) return [];

    const data = await response.json();

    return data.features.map((feature: any, index: number) => {
      const props = feature.properties;
      const [lon, lat] = feature.geometry.coordinates;

      // Construcción legible de la dirección
      const name = props.name || props.street || '';
      const streetNumber = props.housenumber ? ` ${props.housenumber}` : '';
      const city = props.city || props.district || props.locality || 'Mendoza';
      const state = props.state || '';

      const title = `${name}${streetNumber}`;
      const subtitle = [city, state].filter(Boolean).join(', ');
      const fullAddress = subtitle ? `${title}, ${subtitle}` : title;

      return {
        id: `${props.osm_id || index}-${lat}-${lon}`,
        name: title || fullAddress,
        city,
        state,
        fullAddress,
        latitude: lat,
        longitude: lon,
      };
    });
  } catch (error) {
    console.error('Error buscando direcciones con Photon:', error);
    return [];
  }
};


export const reverseGeocode = async (
  latitude: number,
  longitude: number
): Promise<string> => {
  try {
    const url = `https://photon.komoot.io/reverse?lat=${latitude}&lon=${longitude}`;
    const response = await fetch(url);
    if (!response.ok) return '';

    const data = await response.json();
    if (!data.features || data.features.length === 0) return '';

    const props = data.features[0].properties;

    // Construcción consistente con searchAddressSuggestions
    // 1. Extrae calle
    const street = props.street || props.name || '';
    //2. Extraer número buscando en diferentes propiedades posibles de OSM/Photon
    const rawNumber = props.housenumber || props.street_number || props.house_number || '';
    const streetNumber = rawNumber ? ` ${rawNumber}` : '';
    //3. Localidad/departamento
    const city = props.city || props.district || props.locality || 'Mendoza';
    const state = props.state || '';

    const title = `${street}${streetNumber}`.trim();
    const subtitle = [city, state].filter(Boolean).join(', ');

    return subtitle ? `${title}, ${subtitle}` : title;
  } catch (error) {
    console.error('Error en geocodificación inversa con Photon:', error);
    return '';
  }
};