import type { CanonicalEvent, EventEntity } from '../types';
import { classifySeverity } from '../severity';

/** Graph Identity Protection risk detection (subset) */
export interface GraphRiskDetection {
  id: string;
  requestId?: string;
  riskType?: string;
  riskLevel?: string;
  riskState?: string;
  riskDetail?: string;
  activity?: string;
  activityDateTime?: string;
  detectedDateTime?: string;
  userId?: string;
  userDisplayName?: string;
  userPrincipalName?: string;
  ipAddress?: string;
  location?: { city?: string; state?: string; countryOrRegion?: string };
}

export function mapRiskDetectionToEvent(raw: GraphRiskDetection): {
  event: Omit<CanonicalEvent, 'id' | 'ingested_at'>;
  entities: EventEntity[];
} {
  const eventTime = raw.activityDateTime ?? raw.detectedDateTime ?? new Date().toISOString();
  const userId = raw.userId ?? raw.userPrincipalName ?? '';
  const category = 'RISK';
  const type = 'RISK_DETECTION';

  const severity = classifySeverity(
    {
      category,
      type,
      actor: { userId, userPrincipalName: raw.userPrincipalName, displayName: raw.userDisplayName },
      target: {},
      source: { riskLevel: raw.riskLevel, ip: raw.ipAddress, location: raw.location },
    },
    { graphRiskLevel: (raw.riskLevel as 'low' | 'medium' | 'high') ?? 'medium' }
  );

  const entities: EventEntity[] = [];
  if (userId) {
    entities.push({
      event_id: '',
      entity_type: 'USER',
      entity_id: userId,
      entity_label: raw.userDisplayName ?? raw.userPrincipalName ?? userId,
      attributes: {},
    });
  }
  if (raw.ipAddress) {
    entities.push({
      event_id: '',
      entity_type: 'IP',
      entity_id: raw.ipAddress,
      entity_label: raw.ipAddress,
      attributes: {},
    });
  }

  const summary = `Risk detection (${raw.riskLevel ?? 'unknown'}): ${raw.riskType ?? 'unknown'} for ${raw.userPrincipalName ?? userId} at ${raw.ipAddress ?? 'unknown IP'}`;

  const event: Omit<CanonicalEvent, 'id' | 'ingested_at'> = {
    event_time: eventTime,
    category,
    type,
    severity,
    actor: { userId, userPrincipalName: raw.userPrincipalName, displayName: raw.userDisplayName },
    target: {},
    source: {
      riskLevel: raw.riskLevel,
      riskType: raw.riskType,
      ip: raw.ipAddress,
      location: raw.location,
    },
    tags: ['risk-detection'],
    correlation_key: userId || null,
    raw_ref: {
      graphEndpoint: 'identityProtection/riskDetections',
      graphId: raw.id,
      graphResource: `identityProtection/riskDetections/${raw.id}`,
    },
    summary,
  };

  return { event, entities };
}
