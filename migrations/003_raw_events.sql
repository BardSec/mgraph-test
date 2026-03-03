-- Optional raw payload storage for traceability (minimal or pointer).
CREATE TABLE IF NOT EXISTS raw_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  source_system TEXT NOT NULL,
  external_id TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_raw_events_event_id ON raw_events (event_id);
CREATE UNIQUE INDEX idx_raw_events_external ON raw_events (source_system, external_id);
