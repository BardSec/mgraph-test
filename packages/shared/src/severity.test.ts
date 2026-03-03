import { classifySeverity } from './severity';

describe('classifySeverity', () => {
  describe('RISK_DETECTION', () => {
    it('returns CRITICAL for high risk', () => {
      expect(
        classifySeverity(
          { category: 'RISK', type: 'RISK_DETECTION', actor: {}, target: {}, source: { riskLevel: 'high' } },
          { graphRiskLevel: 'high' }
        )
      ).toBe('CRITICAL');
    });
    it('returns HIGH for medium risk', () => {
      expect(
        classifySeverity(
          { category: 'RISK', type: 'RISK_DETECTION', actor: {}, target: {}, source: {} },
          { graphRiskLevel: 'medium' }
        )
      ).toBe('HIGH');
    });
    it('returns MEDIUM for low risk', () => {
      expect(
        classifySeverity(
          { category: 'RISK', type: 'RISK_DETECTION', actor: {}, target: {}, source: {} },
          { graphRiskLevel: 'low' }
        )
      ).toBe('MEDIUM');
    });
  });

  describe('ADMIN_ROLE_GRANTED', () => {
    it('returns CRITICAL for Global Administrator', () => {
      expect(
        classifySeverity(
          { category: 'DIRECTORY', type: 'ADMIN_ROLE_GRANTED', actor: {}, target: {}, source: {} },
          { roleName: 'Global Administrator' }
        )
      ).toBe('CRITICAL');
    });
    it('returns CRITICAL for Exchange Admin', () => {
      expect(
        classifySeverity(
          { category: 'DIRECTORY', type: 'ADMIN_ROLE_GRANTED', actor: {}, target: {}, source: {} },
          { roleName: 'Exchange Admin' }
        )
      ).toBe('CRITICAL');
    });
    it('returns HIGH for non-high-privilege role', () => {
      expect(
        classifySeverity(
          { category: 'DIRECTORY', type: 'ADMIN_ROLE_GRANTED', actor: {}, target: {}, source: {} },
          { roleName: 'User Administrator' }
        )
      ).toBe('HIGH');
    });
  });

  describe('MFA_FAILURE', () => {
    it('returns CRITICAL when threshold exceeded and unfamiliar geo', () => {
      expect(
        classifySeverity(
          { category: 'SIGNIN', type: 'MFA_FAILURE', actor: {}, target: {}, source: {} },
          { mfaFailureCountForUser: 6, unfamiliarGeo: true }
        )
      ).toBe('CRITICAL');
    });
    it('returns HIGH when same IP has many failures across users', () => {
      expect(
        classifySeverity(
          { category: 'SIGNIN', type: 'MFA_FAILURE', actor: {}, target: {}, source: {} },
          { mfaFailureCountForIp: 5 }
        )
      ).toBe('HIGH');
    });
    it('returns MEDIUM for single failure', () => {
      expect(
        classifySeverity(
          { category: 'SIGNIN', type: 'MFA_FAILURE', actor: {}, target: {}, source: {} },
          {}
        )
      ).toBe('MEDIUM');
    });
  });

  describe('SHARING', () => {
    it('returns HIGH for EXTERNAL_SHARE_SPIKE', () => {
      expect(
        classifySeverity(
          { category: 'SHARING', type: 'EXTERNAL_SHARE_SPIKE', actor: {}, target: {}, source: {} },
          undefined
        )
      ).toBe('HIGH');
    });
  });
});
