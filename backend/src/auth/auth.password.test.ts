import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './auth.password.js';

describe('hashPassword y verifyPassword', () => {
  it('acepta la contraseña correcta', async () => {
    const stored = await hashPassword('una-clave-larga');

    expect(await verifyPassword('una-clave-larga', stored)).toBe(true);
  });

  it('rechaza una contraseña distinta', async () => {
    const stored = await hashPassword('una-clave-larga');

    expect(await verifyPassword('otra-clave-larga', stored)).toBe(false);
  });

  it('no guarda la contraseña en texto plano', async () => {
    const stored = await hashPassword('una-clave-larga');

    expect(stored).not.toContain('una-clave-larga');
  });

  it('da un hash distinto cada vez, por la sal aleatoria', async () => {
    const first = await hashPassword('una-clave-larga');
    const second = await hashPassword('una-clave-larga');

    expect(first).not.toBe(second);
  });

  it('rechaza un valor guardado con otro formato', async () => {
    expect(await verifyPassword('una-clave-larga', 'no-es-un-hash')).toBe(false);
    expect(await verifyPassword('una-clave-larga', 'scrypt$16384$8$1$abc$')).toBe(false);
  });
});
