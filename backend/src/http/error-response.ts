import { z } from 'zod';

/**
 * La forma de la respuesta de error de la API, y la traducción de los problemas de Zod.
 *
 * Es de toda la API, no de una funcionalidad: la devuelve cualquier endpoint y la arma el
 * manejador de errores ([04 §3](../../../docs/04-errores-y-mensajes.md)). Vive en `http/`
 * junto a `error-codes.ts` (el vocabulario) y `errors.ts` (la clase que se tira).
 */
export const errorResponseSchema = z
  .object({
    error: z.object({
      code: z.string(),
      details: z.array(z.object({ field: z.string(), code: z.string() })).optional(),
    }),
  })
  .meta({ id: 'ErrorResponse' });

/**
 * Traduce los problemas de Zod a los `details` del catálogo de errores
 * ([04 §4](../../../docs/04-errores-y-mensajes.md)).
 *
 * `REQUIRED` e `INVALID` son los dos motivos genéricos de cualquier cuerpo: falta un
 * campo, o el valor no sirve. Distinguir "no es un número" de "está fuera de rango" no le
 * cambia nada al cliente, que en los dos casos pide revisar el dato. Una funcionalidad
 * agrega los suyos de dominio después de esta validación, no en lugar de ella.
 *
 * Si el campo falta se decide mirando el cuerpo, no el error: Zod v4 no dice si el valor
 * estaba ausente o presente pero inválido, y el `details` sí tiene que decirlo.
 */
export function validationDetails(
  error: z.ZodError,
  body: unknown,
): { field: string; code: string }[] {
  return error.issues.map((issue) => ({
    field: fieldOf(issue),
    code: valueAt(body, issue.path) === undefined ? 'REQUIRED' : 'INVALID',
  }));
}

/**
 * El campo que reporta Zod.
 *
 * Un campo de más (`strictObject`) llega con el path vacío y el nombre en
 * `issue.keys`: decir "body" ahí sería perder el único dato útil para el cliente, que es
 * cuál de sus campos no existe en el contrato.
 */
function fieldOf(issue: z.core.$ZodIssue): string {
  if (issue.code === 'unrecognized_keys' && issue.keys.length === 1) {
    return String(issue.keys[0]);
  }

  return issue.path.length === 0 ? 'body' : issue.path.map(String).join('.');
}

/** El valor del cuerpo en la ruta que reportó Zod, para saber si falta. */
function valueAt(body: unknown, path: readonly PropertyKey[]): unknown {
  let current = body;

  for (const key of path) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[String(key)];
  }

  return current;
}
