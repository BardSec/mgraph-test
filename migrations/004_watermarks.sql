-- Watermarks per Graph source to avoid duplicate ingestion.
CREATE TABLE IF NOT EXISTS ingest_watermarks (
  source_key TEXT PRIMARY KEY,
  last_success_at TIMESTAMPTZ NOT NULL,
  last_cursor TEXT
);

COMMENT ON TABLE ingest_watermarks IS 'Last successful ingest time per source (signInLogs, directoryAudits, etc.).';
