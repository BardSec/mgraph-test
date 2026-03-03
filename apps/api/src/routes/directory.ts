import { Router } from 'express';
import { query } from '../db';

const router = Router();

function parseWindow(window?: string): number {
  const w = (window || '24h').toLowerCase();
  if (w.endsWith('h')) return parseInt(w, 10) || 24;
  if (w.endsWith('d')) return (parseInt(w, 10) || 1) * 24;
  return 24;
}

router.get('/admin-grants', async (req, res) => {
  try {
    const hours = parseWindow(req.query.window as string);
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    const rows = await query(
      `SELECT id, event_time, type, severity, actor, target, summary
       FROM events
       WHERE event_time >= $1 AND category = 'DIRECTORY' AND type = 'ADMIN_ROLE_GRANTED'
       ORDER BY event_time DESC
       LIMIT 100`,
      [since]
    );
    res.json({ events: rows });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;
