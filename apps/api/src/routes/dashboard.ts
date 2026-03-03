import { Router } from 'express';
import { query } from '../db';

const router = Router();

const since24h = () => new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

router.get('/top-attacked-users', async (_req, res) => {
  try {
    const since = since24h();
    const rows = await query(
      `SELECT correlation_key as user_id, actor->>'userPrincipalName' as upn, actor->>'displayName' as display_name,
              COUNT(*)::int as failure_count
       FROM events
       WHERE event_time >= $1 AND type IN ('MFA_FAILURE', 'FAILED_SIGNIN') AND correlation_key IS NOT NULL
       GROUP BY correlation_key, actor->>'userPrincipalName', actor->>'displayName'
       ORDER BY failure_count DESC
       LIMIT 20`,
      [since]
    );
    res.json({ users: rows });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.get('/top-ips', async (_req, res) => {
  try {
    const since = since24h();
    const rows = await query(
      `SELECT source->>'ip' as ip, COUNT(*)::int as failure_count
       FROM events
       WHERE event_time >= $1 AND category = 'SIGNIN' AND (source->>'ip') IS NOT NULL
       GROUP BY source->>'ip'
       ORDER BY failure_count DESC
       LIMIT 20`,
      [since]
    );
    res.json({ ips: rows });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.get('/recent-admin-grants', async (_req, res) => {
  try {
    const since = since24h();
    const rows = await query(
      `SELECT id, event_time, severity, actor, target, summary
       FROM events
       WHERE event_time >= $1 AND type = 'ADMIN_ROLE_GRANTED'
       ORDER BY event_time DESC
       LIMIT 20`,
      [since]
    );
    res.json({ events: rows });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.get('/recent-high-severity', async (_req, res) => {
  try {
    const since = since24h();
    const rows = await query(
      `SELECT id, event_time, category, type, severity, actor, target, summary
       FROM events
       WHERE event_time >= $1 AND severity IN ('HIGH', 'CRITICAL')
       ORDER BY event_time DESC
       LIMIT 50`,
      [since]
    );
    res.json({ events: rows });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;
