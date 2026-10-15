import { Router } from 'express';
import { sql } from 'kysely';
import { getDb } from '../db/index.js';

export const healthRouter = Router();

/** Liveness: el proceso responde. No toca la base. */
healthRouter.get('/', (_req, res) => {
  res.json({ status: 'ok' });
});

/** Readiness: además comprueba que la base responda. */
healthRouter.get('/ready', async (_req, res) => {
  try {
    await sql`select 1`.execute(getDb());
    res.json({ status: 'ok', db: 'up' });
  } catch {
    res.status(503).json({ status: 'unavailable', db: 'down' });
  }
});
