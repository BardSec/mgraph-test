import { Router } from 'express';
import { query } from '../db';

const router = Router();

function parseWindow(window?: string): number {
  const w = (window || '24h').toLowerCase();
  if (w.endsWith('h')) return parseInt(w, 10) || 24;
  if (w.endsWith('d')) return (parseInt(w, 10) || 1) * 24;
  return 24;
}

router.get('/recent', async (req, res) => {
  try {
    const hours = parseWindow(req.query.window as string);
    const severity = (req.query.severity as string) || null;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    let sql = `SELECT id, event_time, ingested_at, category, type, severity, actor, target, source, tags, correlation_key, raw_ref, summary
      FROM events WHERE event_time >= $1`;
    const params: unknown[] = [since];
    if (severity) {
      params.push(severity);
      sql += ` AND severity = $2`;
    }
    sql += ` ORDER BY event_time DESC LIMIT 100`;

    const rows = await query(sql, params);
    res.json({ events: rows });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.get('/user/:userId', async (req, res) => {
  try {
    const hours = parseWindow(req.query.window as string);
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    const userId = decodeURIComponent(req.params.userId);

    const rows = await query(
      `SELECT id, event_time, category, type, severity, actor, target, source, summary
       FROM events
       WHERE event_time >= $1 AND (correlation_key = $2 OR actor->>'userId' = $2)
       ORDER BY event_time DESC
       LIMIT 200`,
      [since, userId]
    );
    res.json({ events: rows });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.get('/ip/:ip', async (req, res) => {
  try {
    const hours = parseWindow(req.query.window as string);
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    const ip = decodeURIComponent(req.params.ip);

    const rows = await query(
      `SELECT id, event_time, category, type, severity, actor, target, source, summary
       FROM events
       WHERE event_time >= $1 AND source->>'ip' = $2
       ORDER BY event_time DESC
       LIMIT 200`,
      [since, ip]
    );
    res.json({ events: rows });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;
