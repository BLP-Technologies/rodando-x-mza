import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadConfig } from '../config.js';
import type { ImageStorage, StoredImage, UploadMime } from './storage.js';

/**
 * El adaptador de disco: un archivo por imagen en `UPLOAD_DIR`.
 *
 * El nombre lo pone el servidor —un UUID y la extensión que corresponde al
 * MIME— y nunca sale del nombre que manda el cliente: no hay forma de escribir
 * fuera del directorio ni de que dos pedidos se pisen
 * ([17 §4](../../../docs/17-la-api-de-reportes.md)).
 */

/** La extensión de cada formato aceptado. El MIME es lo que decide, no el nombre. */
const EXTENSIONS: Record<UploadMime, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

/**
 * Guarda las imágenes como archivos en `directory`, y devuelve su URL pública
 * bajo `baseUrl`.
 *
 * `baseUrl` llega sin barra final (la normaliza `config.ts`), así que la URL se
 * arma con una sola barra. Los bytes se escriben tal como llegaron: no se
 * comprimen ni se redimensionan, y por eso el tamaño aceptado es el que se sirve.
 */
export function createLocalDiskStorage(
  directory: string,
  baseUrl: string,
): ImageStorage {
  return {
    async saveImage({ bytes, mime }): Promise<StoredImage> {
      const fileName = `${randomUUID()}.${EXTENSIONS[mime]}`;

      // `recursive` es el `mkdir -p`: el directorio puede no existir todavía.
      await mkdir(directory, { recursive: true });
      await writeFile(join(directory, fileName), bytes);

      return { url: `${baseUrl}/${fileName}` };
    },
  };
}

/**
 * El adaptador que usa la API hoy, con lo que diga la configuración.
 *
 * Se arma por pedido y no al importar el módulo porque `loadConfig()` exige las
 * variables de entorno: así los tests pueden apuntar `UPLOAD_DIR` a un
 * directorio temporal sin tocar el arranque, igual que la conexión a la base es
 * lazy (`db/index.ts`).
 */
export function configuredImageStorage(): ImageStorage {
  const config = loadConfig();

  return createLocalDiskStorage(config.UPLOAD_DIR, config.UPLOAD_BASE_URL);
}
