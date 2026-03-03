/**
 * Deterministic fingerprint for deduplication.
 * hash(sourceRecordId + eventTime + type) to prevent re-inserts.
 */

import { createHash } from 'crypto';

export function eventFingerprint(recordId: string, eventTime: string, type: string): string {
  const payload = [recordId, eventTime, type].filter(Boolean).join('|');
  return createHash('sha256').update(payload).digest('hex');
}
