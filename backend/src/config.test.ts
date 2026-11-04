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

  it('usa un directorio de subidas relativo si UPLOAD_DIR no está', () => {
    expect(loadConfig(env()).UPLOAD_DIR).toBe('uploads');
  });

  it('normaliza UPLOAD_BASE_URL sin barra final', () => {
    const config = loadConfig(env({ UPLOAD_BASE_URL: 'https://api.example.org/uploads/' }));

    // La URL se concatena con el nombre del archivo: con barra final saldría con
    // dos barras ([17 §4]).
    expect(config.UPLOAD_BASE_URL).toBe('https://api.example.org/uploads');
  });

  it('rechaza una UPLOAD_BASE_URL que no es una URL', () => {
    expect(() => loadConfig(env({ UPLOAD_BASE_URL: 'uploads' }))).toThrow(/UPLOAD_BASE_URL/);
  });
});
