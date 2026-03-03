-- Entity link table for correlation: users, roles, IPs, apps, resources.
-- Enables "all events for user X" and "all events from IP Y" without schema changes.
CREATE TABLE IF NOT EXISTS event_entities (
  id SERIAL PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  entity_label TEXT NOT NULL DEFAULT '',
  attributes JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_event_entities_event_id ON event_entities (event_id);
CREATE INDEX idx_event_entities_type_id ON event_entities (entity_type, entity_id);

COMMENT ON TABLE event_entities IS 'Links events to actors/targets for correlation queries.';
