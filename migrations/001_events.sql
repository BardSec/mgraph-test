-- Canonical events table: single durable model for all signals.
-- Indexes support: event_time range, category/type filters, correlation_key (user), source IP, severity.
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_time TIMESTAMPTZ NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  category TEXT NOT NULL,
  type TEXT NOT NULL,
  severity TEXT NOT NULL,
  actor JSONB NOT NULL DEFAULT '{}',
  target JSONB NOT NULL DEFAULT '{}',
  source JSONB NOT NULL DEFAULT '{}',
  tags TEXT[] NOT NULL DEFAULT '{}',
  correlation_key TEXT,
  raw_ref JSONB NOT NULL DEFAULT '{}',
  summary TEXT NOT NULL DEFAULT ''
);

CREATE INDEX idx_events_event_time ON events (event_time DESC);
CREATE INDEX idx_events_category_type ON events (category, type);
CREATE INDEX idx_events_severity ON events (severity);
CREATE INDEX idx_events_correlation_key ON events (correlation_key) WHERE correlation_key IS NOT NULL;
CREATE INDEX idx_events_source_ip ON events ((source->>'ip')) WHERE source ? 'ip';

COMMENT ON TABLE events IS 'Canonical event store; all Graph signals normalize here for correlation.';
