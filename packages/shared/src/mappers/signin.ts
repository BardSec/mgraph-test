import type { CanonicalEvent, EventEntity } from '../types';
import { classifySeverity } from '../severity';
import type { SeverityContext } from '../severity';

/** Graph SignIn schema (subset we use) */
export interface GraphSignIn {
  id: string;
  createdDateTime?: string;
  userDisplayName?: string;
  userPrincipalName?: string;
  userId?: string;
  appDisplayName?: string;
  appId?: string;
  ipAddress?: string;
  clientAppUsed?: string;
  location?: string;
  riskLevelDuringSignIn?: string;
  riskDetail?: string;
  status?: { errorCode?: number; failureReason?: string };
  conditionalAccessStatus?: string;
  deviceDetail?: { displayName?: string; deviceId?: string };
}

export function mapSignInToEvent(
  raw: GraphSignIn,
  context?: SeverityContext
): { event: Omit<CanonicalEvent, 'id' | 'ingested_at'>; entities: EventEntity[] } {
  const eventTime = raw.createdDateTime ?? new Date().toISOString();
  const userId = raw.userId ?? raw.userPrincipalName ?? '';
  const isFailure = (raw.status?.errorCode ?? 0) !== 0;
  const isMfaFailure =
    isFailure &&
    (raw.status?.failureReason?.toLowerCase().includes('mfa') ||
      raw.status?.failureReason?.toLowerCase().includes('multi-factor'));
  const isRisky = ['high', 'medium'].includes((raw.riskLevelDuringSignIn ?? '').toLowerCase());

  let type = 'SIGNIN';
  if (isRisky) type = 'RISKY_SIGNIN';
  else if (isMfaFailure || isFailure) type = isMfaFailure ? 'MFA_FAILURE' : 'FAILED_SIGNIN';

  const category = 'SIGNIN';
  const severity = classifySeverity(
    {
      category,
      type,
      actor: { userId, userPrincipalName: raw.userPrincipalName, displayName: raw.userDisplayName },
      target: {},
      source: {
        ip: raw.ipAddress,
        userAgent: raw.clientAppUsed,
        appId: raw.appId,
        appDisplayName: raw.appDisplayName,
        riskLevel: raw.riskLevelDuringSignIn,
        location: raw.location,
      },
    },
    context
  );

  const entities: EventEntity[] = [];
  if (userId) {
    entities.push({
      event_id: '', // filled by worker
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
  if (raw.appId) {
    entities.push({
      event_id: '',
      entity_type: 'APP',
      entity_id: raw.appId,
      entity_label: raw.appDisplayName ?? raw.appId,
      attributes: {},
    });
  }
  if (raw.deviceDetail?.deviceId) {
    entities.push({
      event_id: '',
      entity_type: 'DEVICE',
      entity_id: raw.deviceDetail.deviceId,
      entity_label: raw.deviceDetail.displayName ?? raw.deviceDetail.deviceId,
      attributes: {},
    });
  }

  const summary =
    type === 'MFA_FAILURE'
      ? `MFA failure for ${raw.userPrincipalName ?? userId} from ${raw.ipAddress ?? 'unknown IP'}`
      : type === 'RISKY_SIGNIN'
        ? `Risky sign-in (${raw.riskLevelDuringSignIn}) for ${raw.userPrincipalName ?? userId}`
        : isFailure
          ? `Failed sign-in for ${raw.userPrincipalName ?? userId}: ${raw.status?.failureReason ?? 'unknown'}`
          : `Sign-in by ${raw.userPrincipalName ?? userId} from ${raw.ipAddress ?? 'unknown'}`;

  const event: Omit<CanonicalEvent, 'id' | 'ingested_at'> = {
    event_time: eventTime,
    category,
    type,
    severity,
    actor: {
      userId,
      userPrincipalName: raw.userPrincipalName,
      displayName: raw.userDisplayName,
    },
    target: {},
    source: {
      ip: raw.ipAddress,
      userAgent: raw.clientAppUsed,
      appId: raw.appId,
      appDisplayName: raw.appDisplayName,
      riskLevel: raw.riskLevelDuringSignIn,
      location: raw.location,
    },
    tags: isFailure ? ['failed'] : [],
    correlation_key: userId || null,
    raw_ref: {
      graphEndpoint: 'signInLogs',
      graphId: raw.id,
      graphResource: `signInLogs/${raw.id}`,
    },
    summary,
  };

  return { event, entities };
}
