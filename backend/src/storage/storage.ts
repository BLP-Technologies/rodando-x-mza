/**
 * El puerto del almacenamiento de imágenes: qué necesita el resto del código del
 * lugar donde terminan los bytes.
 *
 * Nadie fuera de este directorio sabe que hoy hay un disco: la ruta de subida le
 * pasa los bytes y recibe una URL. Cambiar de disco a un gestor de archivos es
 * escribir otro adaptador, no tocar el endpoint ni la base
 * ([17 §4](../../../docs/17-la-api-de-reportes.md)).
 */

export type StoredImage = { url: string };

export type ImageStorage = {
  saveImage(image: { bytes: Buffer; mime: UploadMime }): Promise<StoredImage>;
};

/**
 * Los formatos que la API acepta.
 *
 * SVG queda afuera: puede llevar script y se sirve desde el mismo dominio que el
 * portal, así que abrirlo sería ejecutar código ajeno
 * ([17 §4](../../../docs/17-la-api-de-reportes.md)).
 */
export const ALLOWED_IMAGE_MIMES = [
  'image/png',
  'image/jpeg',
  'image/webp',
] as const;

export type UploadMime = (typeof ALLOWED_IMAGE_MIMES)[number];
