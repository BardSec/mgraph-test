import { Router } from 'express';
import { pool } from '../db';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch (e) {
    res.status(503).json({ status: 'error', error: String(e) });
  }
});

export default router;
