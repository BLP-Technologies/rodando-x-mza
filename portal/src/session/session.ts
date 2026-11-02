/**
 * La sesión del portal, en un solo módulo.
 *
 * Hoy devuelve un moderador fijo: no hay auth real todavía
 * ([15 §4](../../docs/15-integracion-con-el-cliente.md)). Cuando lo haya, se
 * reemplaza el cuerpo de `getSession` y ningún llamador cambia: por eso ya es
 * `async` y ya puede devolver `null`.
 *
 * **Un solo consumidor.** `app/(portal)/layout.tsx` llama a `getSession()` una
 * vez y es la única guarda del portal. Ninguna otra parte del código consulta ni
 * deduce la sesión: si aparece otro consumidor, el día del auth real hay dos
 * lugares que arreglar (y uno se olvida).
 */

/**
 * El moderador logueado. Es la forma que va a tener la tabla `users`
 * ([09 §4.1](../../docs/09-modelo-de-datos.md)).
 */
export type Session = {
  id: number;
  name: string;
  email: string;
  isModerator: boolean;
};

/** El moderador de mentira que devuelve `getSession` mientras no haya auth. */
const MOCK_SESSION: Session = {
  id: 1,
  name: 'Moderador de prueba',
  email: 'moderador@ejemplo.com',
  isModerator: true,
};

/**
 * La sesión del pedido, o `null` si no hay nadie logueado.
 *
 * El mock nunca devuelve `null`; el tipo y el `async` ya son los definitivos
 * para que el reemplazo sea sólo el cuerpo de esta función.
 */
export async function getSession(): Promise<Session | null> {
  return MOCK_SESSION;
}
