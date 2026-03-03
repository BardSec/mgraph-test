import { eventFingerprint } from './fingerprint';

describe('eventFingerprint', () => {
  it('produces deterministic hash from recordId + eventTime + type', () => {
    const a = eventFingerprint('rec-1', '2025-01-15T10:00:00Z', 'MFA_FAILURE');
    const b = eventFingerprint('rec-1', '2025-01-15T10:00:00Z', 'MFA_FAILURE');
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });
  it('differs when recordId changes', () => {
    const a = eventFingerprint('rec-1', '2025-01-15T10:00:00Z', 'MFA_FAILURE');
    const b = eventFingerprint('rec-2', '2025-01-15T10:00:00Z', 'MFA_FAILURE');
    expect(a).not.toBe(b);
  });
  it('differs when type changes', () => {
    const a = eventFingerprint('rec-1', '2025-01-15T10:00:00Z', 'MFA_FAILURE');
    const b = eventFingerprint('rec-1', '2025-01-15T10:00:00Z', 'RISK_DETECTION');
    expect(a).not.toBe(b);
  });
});
