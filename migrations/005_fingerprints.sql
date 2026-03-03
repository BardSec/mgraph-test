-- Dedup: deterministic fingerprint (hash of source id + event_time + type).
CREATE TABLE IF NOT EXISTS event_fingerprints (
  fingerprint TEXT PRIMARY KEY
);

COMMENT ON TABLE event_fingerprints IS 'Prevents re-insert of same Graph record; fingerprint = hash(recordId|eventTime|type).';
