import { config } from './config';
import * as db from './db';
import { ingestSignIns } from './ingest/signin';
import { ingestDirectoryAudits } from './ingest/directory';
import { ingestRiskDetections } from './ingest/risk';
import { ingestSharingReports } from './ingest/sharing';
import { runMockIngest } from './ingest/mock';

async function runCycle(): Promise<void> {
  if (config.useMock) {
    const n = await runMockIngest();
    console.log(`[mock] Ingested ${n} events`);
    return;
  }
  if (!config.graph.tenantId || !config.graph.clientId || !config.graph.clientSecret) {
    console.warn('Graph credentials not set; skipping real ingest. Set USE_GRAPH_MOCK=true to use fixtures.');
    return;
  }
  try {
    const [s, d, r, sh] = await Promise.all([
      ingestSignIns(),
      ingestDirectoryAudits(),
      ingestRiskDetections(),
      ingestSharingReports(),
    ]);
    console.log(`Ingested: signIns=${s} directory=${d} risk=${r} sharing=${sh}`);
  } catch (e) {
    console.error('Ingest cycle failed:', e);
  }
}

async function main(): Promise<void> {
  const pool = db.pool;
  try {
    await pool.query('SELECT 1');
  } catch (e) {
    console.error('DB not ready:', e);
    process.exit(1);
  }
  console.log('Security Pulse worker started; interval=', config.pollIntervalMs, 'ms');
  await runCycle();
  setInterval(runCycle, config.pollIntervalMs);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
