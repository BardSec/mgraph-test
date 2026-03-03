import type { CanonicalEvent, EventEntity } from '../types';
import { classifySeverity } from '../severity';

/** Graph Directory Audit (subset for role assignments) */
export interface GraphDirectoryAudit {
  id: string;
  activityDateTime?: string;
  activityDisplayName?: string;
  category?: string;
  result?: string;
  actor?: { user?: { id?: string; displayName?: string; userPrincipalName?: string }; applicationId?: string };
  targetResources?: Array<{
    id?: string;
    displayName?: string;
    type?: string;
    userPrincipalName?: string;
    modifiedProperties?: Array<{ displayName?: string; newValue?: string; oldValue?: string }>;
  }>;
  additionalDetails?: Array<{ key?: string; value?: string }>;
}

export function mapDirectoryAuditToEvent(raw: GraphDirectoryAudit): {
  event: Omit<CanonicalEvent, 'id' | 'ingested_at'>;
  entities: EventEntity[];
} {
  const eventTime = raw.activityDateTime ?? new Date().toISOString();
  const isRoleAssignment =
    raw.activityDisplayName?.toLowerCase().includes('add member to role') ||
    raw.activityDisplayName?.toLowerCase().includes('role') ||
    raw.category === 'RoleManagement';

  const targetRole = raw.targetResources?.find((t) => t.type === 'Role');
  const roleName =
    targetRole?.displayName ??
    raw.additionalDetails?.find((a) => a.key === 'RoleName' || a.key === 'Role')?.value ??
    '';

  const targetUser = raw.targetResources?.find((t) => t.type === 'User' || t.userPrincipalName);
  const targetUserId = targetUser?.id ?? targetUser?.userPrincipalName ?? '';
  const targetDisplayName = targetUser?.displayName ?? targetUser?.userPrincipalName ?? '';

  const actorId = raw.actor?.user?.id ?? raw.actor?.applicationId ?? '';
  const actorName = raw.actor?.user?.displayName ?? raw.actor?.user?.userPrincipalName ?? '';

  const type = isRoleAssignment ? 'ADMIN_ROLE_GRANTED' : 'DIRECTORY_CHANGE';
  const category = 'DIRECTORY';

  const eventPayload = {
    category,
    type,
    actor: { userId: actorId, displayName: actorName },
    target: { roleName, targetUserId, targetDisplayName },
    source: {},
  };
  const severity = classifySeverity(eventPayload, { roleName });

  const entities: EventEntity[] = [];
  if (actorId) {
    entities.push({
      event_id: '',
      entity_type: 'USER',
      entity_id: actorId,
      entity_label: actorName ?? actorId,
      attributes: {},
    });
  }
  if (targetUserId) {
    entities.push({
      event_id: '',
      entity_type: 'USER',
      entity_id: targetUserId,
      entity_label: targetDisplayName ?? targetUserId,
      attributes: {},
    });
  }
  if (roleName) {
    entities.push({
      event_id: '',
      entity_type: 'ROLE',
      entity_id: roleName,
      entity_label: roleName,
      attributes: {},
    });
  }

  const summary = isRoleAssignment
    ? `Admin role "${roleName}" granted to ${targetDisplayName || targetUserId} by ${actorName || actorId}`
    : `Directory change: ${raw.activityDisplayName ?? 'unknown'}`;

  const event: Omit<CanonicalEvent, 'id' | 'ingested_at'> = {
    event_time: eventTime,
    category,
    type,
    severity,
    actor: { userId: actorId, displayName: actorName },
    target: { roleName, targetUserId, targetDisplayName },
    source: {},
    tags: isRoleAssignment ? ['admin-grant'] : [],
    correlation_key: targetUserId || actorId || null,
    raw_ref: {
      graphEndpoint: 'directoryAudits',
      graphId: raw.id,
      graphResource: `auditLogs/directoryAudits/${raw.id}`,
    },
    summary,
  };

  return { event, entities };
}
