import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import { ERROR_CODES } from '../http/error-codes.js';
import { HttpError } from '../http/errors.js';
import { configuredImageStorage } from '../storage/local-disk.js';
import { ALLOWED_IMAGE_MIMES, type UploadMime } from '../storage/storage.js';
import { reportImageSchema } from './reports.schemas.js';

/**
 * La subida de una imagen de reporte, en `POST /api/reports/images`.
 *
 * **Es un paso aparte del reporte** y no un multipart del `POST /api/reports`
 * porque el archivo y la fila no comparten vida: la imagen se sube primero y el
 * reporte viaja después con su URL. Así el contrato del reporte sigue siendo JSON
 * —lo que el cliente tipado ya sabe mandar—, y una foto huérfana es un archivo sin
 * referencias en vez de una transacción que hay que deshacer
 * ([17 §4](../../../docs/17-la-api-de-reportes.md)).
 */
export const reportsImagesRouter = Router();

/** El tope del archivo. Se sirve tal cual, porque no se recomprime. */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * Recibe el archivo en memoria, sin tocarlo hasta saber que sirve: son 5 MB como
 * mucho, así que no hace falta un temporal en disco.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
});

/**
 * Guarda los bytes y devuelve su URL. Nada más: el reporte se manda después con
 * esa URL en `image_url`.
 */
reportsImagesRouter.post('/', async (req, res) => {
  const file = await receiveImage(req, res);

  // Sin archivo no hay nada que guardar: falta el campo, que es otra cosa que un
  // archivo que no sirve ([04 §4](../../../docs/04-errores-y-mensajes.md)).
  if (file === undefined) {
    throw invalidFile('the image file is missing', 'REQUIRED');
  }

  const mime = asUploadMime(file.mimetype);
  if (mime === undefined) {
    throw invalidFile(`unsupported image type ${file.mimetype}`);
  }

  const stored = await configuredImageStorage().saveImage({
    bytes: file.buffer,
    mime,
  });

  res.status(201).json(reportImageSchema.parse(stored));
});

/**
 * Corre el middleware de multipart y devuelve el archivo, si vino.
 *
 * Multer informa por su callback, así que se envuelve en una promesa: así un
 * error suyo —archivo demasiado grande, campo desconocido, multipart roto— sale
 * como el mismo 400 de validación y no como un 500
 * ([17 §5](../../../docs/17-la-api-de-reportes.md)).
 */
function receiveImage(
  req: Request,
  res: Response,
): Promise<Express.Multer.File | undefined> {
  return new Promise((resolve, reject) => {
    upload.single('file')(req, res, (error: unknown) => {
      if (error !== undefined) {
        reject(invalidFile('the image could not be received'));
        return;
      }

      resolve(req.file);
    });
  });
}

/**
 * El `file` del pedido que no sirve, con el motivo genérico del catálogo.
 *
 * No se inventan motivos nuevos: para el cliente, "no es un PNG, JPEG o WebP" y
 * "pesa más de 5 MB" se resuelven igual, eligiendo otro archivo.
 */
function invalidFile(message: string, code = 'INVALID'): HttpError {
  return new HttpError(400, ERROR_CODES.VALIDATION_ERROR, message, [
    { field: 'file', code },
  ]);
}

/** El MIME del archivo dentro de los aceptados, o `undefined` si no lo es. */
function asUploadMime(mimetype: string): UploadMime | undefined {
  return ALLOWED_IMAGE_MIMES.find((allowed) => allowed === mimetype);
}
