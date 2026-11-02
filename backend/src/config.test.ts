import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

/** Entorno mínimo válido; cada test cambia solo lo que le importa. */
function env(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgres://rodando:rodando@localhost:5432/rodando',
    ...overrides,
  };
}

describe('loadConfig', () => {
  it('no permite ningún origen CORS si CORS_ORIGINS no está', () => {
    expect(loadConfig(env()).CORS_ORIGINS).toEqual([]);
  });

  it('separa por comas, normaliza y descarta entradas vacías', () => {
    const config = loadConfig(
      env({ CORS_ORIGINS: ' http://localhost:3000/ , ,HTTPS://Portal.Example.org ' }),
    );

    expect(config.CORS_ORIGINS).toEqual(['http://localhost:3000', 'https://portal.example.org']);
  });

  it('rechaza una entrada que no es un origen', () => {
    expect(() => loadConfig(env({ CORS_ORIGINS: 'localhost:3000' }))).toThrow(
      /CORS_ORIGINS/,
    );
    expect(() => loadConfig(env({ CORS_ORIGINS: 'http://localhost:3000/portal' }))).toThrow(
      /CORS_ORIGINS/,
    );
  });
});
