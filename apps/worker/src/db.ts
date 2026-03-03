import { Pool } from 'pg';
import { config } from './config';

export const pool = new Pool({ connectionString: config.databaseUrl, max: 5 });

export async function getWatermark(sourceKey: string): Promise<{ last_success_at: Date; last_cursor?: string } | null> {
  const r = await pool.query(
    'SELECT last_success_at, last_cursor FROM ingest_watermarks WHERE source_key = $1',
    [sourceKey]
  );
  if (r.rows.length === 0) return null;
  return { last_success_at: r.rows[0].last_success_at, last_cursor: r.rows[0].last_cursor };
}

export async function setWatermark(sourceKey: string, lastSuccessAt: Date, lastCursor?: string): Promise<void> {
  await pool.query(
    `INSERT INTO ingest_watermarks (source_key, last_success_at, last_cursor)
     VALUES ($1, $2, $3)
     ON CONFLICT (source_key) DO UPDATE SET last_success_at = $2, last_cursor = $3`,
    [sourceKey, lastSuccessAt, lastCursor]
  );
}

export async function hasFingerprint(fingerprint: string): Promise<boolean> {
  const r = await pool.query('SELECT 1 FROM event_fingerprints WHERE fingerprint = $1', [fingerprint]);
  return r.rows.length > 0;
}

export async function insertFingerprint(fingerprint: string): Promise<void> {
  await pool.query('INSERT INTO event_fingerprints (fingerprint) VALUES ($1) ON CONFLICT (fingerprint) DO NOTHING', [
    fingerprint,
  ]);
}

export async function insertEvent(
  event: {
    event_time: string;
    category: string;
    type: string;
    severity: string;
    actor: object;
    target: object;
    source: object;
    tags: string[];
    correlation_key: string | null;
    raw_ref: object;
    summary: string;
  },
  entities: { entity_type: string; entity_id: string; entity_label: string; attributes: object }[]
): Promise<string> {
  const client = await pool.connect();
  try {
    const idRes = await client.query(
      `INSERT INTO events (event_time, ingested_at, category, type, severity, actor, target, source, tags, correlation_key, raw_ref, summary)
       VALUES ($1, NOW(), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [
        event.event_time,
        event.category,
        event.type,
        event.severity,
        JSON.stringify(event.actor),
        JSON.stringify(event.target),
        JSON.stringify(event.source),
        event.tags,
        event.correlation_key,
        JSON.stringify(event.raw_ref),
        event.summary,
      ]
    );
    const id = idRes.rows[0].id;
    for (const e of entities) {
      await client.query(
        `INSERT INTO event_entities (event_id, entity_type, entity_id, entity_label, attributes)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, e.entity_type, e.entity_id, e.entity_label, JSON.stringify(e.attributes)]
      );
    }
    return id;
  } finally {
    client.release();
  }
}

/** MFA failure count for user in last 24h (for severity context) */
export async function getMfaFailureCountForUser(userId: string): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const r = await pool.query(
    `SELECT COUNT(*)::int as c FROM events WHERE event_time >= $1 AND type = 'MFA_FAILURE' AND correlation_key = $2`,
    [since, userId]
  );
  return r.rows[0]?.c ?? 0;
}

/** MFA failure count from IP in last 24h (for severity context) */
export async function getMfaFailureCountForIp(ip: string): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const r = await pool.query(
    `SELECT COUNT(*)::int as c FROM events WHERE event_time >= $1 AND type = 'MFA_FAILURE' AND source->>'ip' = $2`,
    [since, ip]
  );
  return r.rows[0]?.c ?? 0;
}
