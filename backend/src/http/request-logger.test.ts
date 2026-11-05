import { Writable } from 'node:stream';
import express from 'express';
import { pino } from 'pino';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createRequestLogger } from './request-logger.js';

/** Logger de prueba que guarda cada línea emitida en memoria. */
function captureLogger() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer | string, _encoding: BufferEncoding, callback: (error?: Error | null) => void) {
      lines.push(chunk.toString());
      callback();
    },
  });

  return { logger: pino({ level: 'info' }, stream), lines };
}

/** pino-http escribe al cerrar la respuesta; el `setImmediate` deja que termine. */
const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('request logger', () => {
  it('agrega x-request-id y loguea método, ruta y status', async () => {
    const { logger, lines } = captureLogger();
    const app = express();
    app.use(createRequestLogger({ logger, autoLogging: true }));
    app.get('/x', (_req, res) => {
      res.status(201).json({ ok: true });
    });

    const res = await request(app).get('/x');
    await flush();

    const id = res.headers['x-request-id'];
    expect(id).toBeTypeOf('string');

    const entry = lines
      .map((line) => JSON.parse(line) as { req?: { id?: string; method?: string; url?: string }; res?: { statusCode?: number } })
      .find((line) => line.res !== undefined);

    expect(entry?.req?.id).toBe(id);
    expect(entry?.req?.method).toBe('GET');
    expect(entry?.req?.url).toBe('/x');
    expect(entry?.res?.statusCode).toBe(201);
  });

  it('no loguea los health checks', async () => {
    const { logger, lines } = captureLogger();
    const app = express();
    app.use(createRequestLogger({ logger, autoLogging: true }));
    app.get('/api/health', (_req, res) => {
      res.json({ status: 'ok' });
    });

    await request(app).get('/api/health');
    await flush();

    expect(lines).toHaveLength(0);
  });

  it('redacta el encabezado Authorization', async () => {
    const { logger, lines } = captureLogger();
    const app = express();
    app.use(createRequestLogger({ logger, autoLogging: true }));
    app.get('/x', (_req, res) => {
      res.json({ ok: true });
    });

    await request(app).get('/x').set('Authorization', 'Bearer secreto');
    await flush();

    const output = lines.join('');
    expect(output).not.toContain('secreto');
    expect(output).toContain('[redacted]');
  });
});
