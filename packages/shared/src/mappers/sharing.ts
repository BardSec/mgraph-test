import type { CanonicalEvent, EventEntity } from '../types';
import { classifySeverity } from '../severity';

/** M365 usage report row or synthetic sharing event (coarse; schema extensible for deeper events later) */
export interface GraphSharingReportRow {
  reportId?: string;
  reportDate?: string;
  siteUrl?: string;
  ownerDisplayName?: string;
  sharedExternally?: number;
  sharedInternally?: number;
  lastActivityDate?: string;
}

/** Single external share event we normalize (e.g. from report aggregation or future webhook) */
export interface SharingEventPayload {
  id: string;
  eventTime: string;
  siteUrl?: string;
  ownerId?: string;
  ownerDisplayName?: string;
  sharedExternally?: number;
  delta?: number;
  isSpike?: boolean;
}

export function mapSharingReportToEvent(raw: SharingEventPayload): {
  event: Omit<CanonicalEvent, 'id' | 'ingested_at'>;
  entities: EventEntity[];
} {
  const category = 'SHARING';
  const type = raw.isSpike ? 'EXTERNAL_SHARE_SPIKE' : 'EXTERNAL_SHARE_CREATED';

  const severity = classifySeverity(
    {
      category,
      type,
      actor: { userId: raw.ownerId, displayName: raw.ownerDisplayName },
      target: { siteUrl: raw.siteUrl },
      source: {},
    },
    undefined
  );

  const entities: EventEntity[] = [];
  if (raw.ownerId) {
    entities.push({
      event_id: '',
      entity_type: 'USER',
      entity_id: raw.ownerId,
      entity_label: raw.ownerDisplayName ?? raw.ownerId,
      attributes: {},
    });
  }
  if (raw.siteUrl) {
    entities.push({
      event_id: '',
      entity_type: 'RESOURCE',
      entity_id: raw.siteUrl,
      entity_label: raw.siteUrl,
      attributes: {},
    });
  }

  const summary = raw.isSpike
    ? `External sharing spike: ${raw.sharedExternally ?? raw.delta ?? 0} shares for ${raw.ownerDisplayName ?? raw.siteUrl ?? 'unknown'}`
    : `External share activity: ${raw.sharedExternally ?? 0} for ${raw.ownerDisplayName ?? raw.siteUrl ?? 'unknown'}`;

  const event: Omit<CanonicalEvent, 'id' | 'ingested_at'> = {
    event_time: raw.eventTime,
    category,
    type,
    severity,
    actor: { userId: raw.ownerId, displayName: raw.ownerDisplayName },
    target: { siteUrl: raw.siteUrl, sharedExternally: raw.sharedExternally, delta: raw.delta },
    source: {},
    tags: raw.isSpike ? ['spike', 'sharing'] : ['sharing'],
    correlation_key: raw.ownerId ?? raw.siteUrl ?? null,
    raw_ref: {
      graphEndpoint: 'reports',
      graphId: raw.id,
    },
    summary,
  };

  return { event, entities };
}
