import { Router } from 'express';
import { query } from '../db';

const router = Router();

function parseWindow(window?: string): number {
  const w = (window || '7d').toLowerCase();
  if (w.endsWith('h')) return parseInt(w, 10) || 24;
  if (w.endsWith('d')) return (parseInt(w, 10) || 7) * 24;
  return 7 * 24;
}

router.get('/spikes', async (req, res) => {
  try {
    const hours = parseWindow(req.query.window as string);
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    const [daily, recent] = await Promise.all([
      query<{ day: string; count: string }>(
        `SELECT date_trunc('day', event_time)::date::text as day, COUNT(*)::text as count
         FROM events
         WHERE event_time >= $1 AND category = 'SHARING'
         GROUP BY date_trunc('day', event_time)
         ORDER BY day DESC
         LIMIT 14`,
        [since]
      ),
      query(
        `SELECT id, event_time, type, severity, actor, target, summary
         FROM events
         WHERE event_time >= $1 AND category = 'SHARING'
         ORDER BY event_time DESC
         LIMIT 50`,
        [since]
      ),
    ]);

    const dailyDelta = daily.map((r) => ({ date: r.day, count: parseInt(r.count, 10) }));
    res.json({ window: `${hours}h`, daily: dailyDelta, recent });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;
