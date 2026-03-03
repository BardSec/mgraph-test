import { Router } from 'express';
import { query } from '../db';

const router = Router();

function parseWindow(window?: string): { hours: number } {
  const w = (window || '24h').toLowerCase();
  if (w.endsWith('h')) return { hours: parseInt(w, 10) || 24 };
  if (w.endsWith('d')) return { hours: (parseInt(w, 10) || 1) * 24 };
  return { hours: 24 };
}

router.get('/summary', async (req, res) => {
  try {
    const { hours } = parseWindow(req.query.window as string);
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    const [byCategory, bySeverity, riskySignIns, mfaFailures, adminGrants, sharingCount] = await Promise.all([
      query<{ category: string; count: string }>(
        `SELECT category, COUNT(*)::text as count FROM events WHERE event_time >= $1 GROUP BY category`,
        [since]
      ),
      query<{ severity: string; count: string }>(
        `SELECT severity, COUNT(*)::text as count FROM events WHERE event_time >= $1 GROUP BY severity`,
        [since]
      ),
      queryOne<{ count: string }>(
        `SELECT COUNT(*)::text as count FROM events WHERE event_time >= $1 AND category = 'SIGNIN' AND type = 'RISKY_SIGNIN'`,
        [since]
      ),
      queryOne<{ count: string }>(
        `SELECT COUNT(*)::text as count FROM events WHERE event_time >= $1 AND type = 'MFA_FAILURE'`,
        [since]
      ),
      queryOne<{ count: string }>(
        `SELECT COUNT(*)::text as count FROM events WHERE event_time >= $1 AND type = 'ADMIN_ROLE_GRANTED'`,
        [since]
      ),
      queryOne<{ count: string }>(
        `SELECT COUNT(*)::text as count FROM events WHERE event_time >= $1 AND category = 'SHARING'`,
        [since]
      ),
    ]);

    res.json({
      window: `${hours}h`,
      since,
      byCategory: Object.fromEntries(byCategory.map((r) => [r.category, parseInt(r.count, 10)])),
      bySeverity: Object.fromEntries(bySeverity.map((r) => [r.severity, parseInt(r.count, 10)])),
      riskySignIns: parseInt(riskySignIns?.count ?? '0', 10),
      mfaFailures: parseInt(mfaFailures?.count ?? '0', 10),
      adminGrants: parseInt(adminGrants?.count ?? '0', 10),
      sharingEvents: parseInt(sharingCount?.count ?? '0', 10),
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;
