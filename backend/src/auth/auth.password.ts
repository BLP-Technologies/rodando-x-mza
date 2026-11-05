import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

/**
 * Hash de contraseñas con scrypt, que viene con Node: no suma dependencias.
 *
 * Lo que se guarda en `users.password_hash` lleva todo lo necesario para verificar:
 * `scrypt$N$r$p$sal$hash`, con la sal y el hash en base64url. Guardar los parámetros
 * permite endurecerlos más adelante sin invalidar las contraseñas ya guardadas.
 */
const PARAMS = { N: 16384, r: 8, p: 1 } as const;
const SALT_BYTES = 16;
const KEY_BYTES = 64;

/** `scrypt` es de callback; se envuelve en una promesa para usarlo con `await`. */
function deriveKey(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, options, (error, key) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(key);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await deriveKey(password, salt, KEY_BYTES, PARAMS);

  return [
    'scrypt',
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString('base64url'),
    key.toString('base64url'),
  ].join('$');
}

/**
 * Compara una contraseña con lo guardado. Un valor guardado con otro formato no
 * coincide nunca: se responde `false`, no se lanza.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algorithm, n, r, p, saltText, keyText] = stored.split('$');
  if (
    algorithm !== 'scrypt' ||
    n === undefined ||
    r === undefined ||
    p === undefined ||
    saltText === undefined ||
    keyText === undefined
  ) {
    return false;
  }

  const expected = Buffer.from(keyText, 'base64url');
  // Un hash de otro largo no lo generó hashPassword: sin esto, uno vacío daría true.
  if (expected.length !== KEY_BYTES) return false;

  const actual = await deriveKey(password, Buffer.from(saltText, 'base64url'), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });

  // Comparación en tiempo constante: no revela cuántos bytes coincidieron.
  return timingSafeEqual(actual, expected);
}
