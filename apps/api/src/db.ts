import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL || 'postgres://securitypulse:secret@localhost:5432/securitypulse';

export const pool = new Pool({
  connectionString,
  max: 10,
});

export async function query<T = unknown>(text: string, params?: unknown[]): Promise<T[]> {
  const client = await pool.connect();
  try {
    const res = await client.query(text, params);
    return (res.rows as T[]) ?? [];
  } finally {
    client.release();
  }
}

export async function queryOne<T = unknown>(text: string, params?: unknown[]): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}
