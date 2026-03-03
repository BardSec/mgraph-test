import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { pool } from './db';

const migrationsDir = process.env.MIGRATIONS_DIR || join(process.cwd(), 'migrations');

async function run() {
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), 'utf-8');
    console.log('Running', file);
    await pool.query(sql);
  }
  console.log('Migrations complete.');
  await pool.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
