/**
 * Configuración del portal.
 *
 * Es el único lugar donde viven los valores que cambian entre entornos y la
 * geografía fija del piloto: ningún componente hardcodea una URL ni una
 * coordenada ([15 §3](../../docs/15-integracion-con-el-cliente.md)).
 */

/**
 * URL base de la API, sin barra final.
 *
 * Sale de `NEXT_PUBLIC_API_URL` (`portal/.env.example`). El valor por defecto es
 * el backend de desarrollo porque el portal se construye en CI, donde no hay
 * `.env` y el build no puede depender de que la variable esté definida.
 */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/** Las cuatro esquinas de un área, en el orden de la API: oeste,sur,este,norte. */
export type BBox = {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
};

/**
 * La caja que envuelve la zona piloto, que es la vista inicial del mapa.
 *
 * Son los cuatro vértices de `data/pilot-zone.geojson` (la zona que define
 * [10 §2](../../docs/10-datos-y-zona-piloto.md)), reducidos a mínimos y máximos.
 * La API no expone `service_areas`, así que las coordenadas viajan como
 * constante: ver [16](../docs/16-el-portal.md) para el porqué.
 */
export const PILOT_BOUNDS: BBox = {
  minLon: -68.849165,
  minLat: -32.893626,
  maxLon: -68.839872,
  maxLat: -32.885789,
};
