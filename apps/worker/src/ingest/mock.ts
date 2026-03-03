import { mapSignInToEvent } from '@security-pulse/shared';
import { mapDirectoryAuditToEvent } from '@security-pulse/shared';
import { mapRiskDetectionToEvent } from '@security-pulse/shared';
import { eventFingerprint } from '@security-pulse/shared';
import * as db from '../db';
import { notifyCritical } from '../teams';

const MOCK_SIGNINS: Array<Record<string, unknown>> = [
  {
    id: 'mock-signin-1',
    createdDateTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    userPrincipalName: 'user1@contoso.edu',
    userId: 'user-guid-1',
    userDisplayName: 'Test User 1',
    ipAddress: '192.168.1.10',
    status: { errorCode: 50126, failureReason: 'MFA required' },
    riskLevelDuringSignIn: 'none',
  },
  {
    id: 'mock-signin-2',
    createdDateTime: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    userPrincipalName: 'admin@contoso.edu',
    userId: 'admin-guid',
    userDisplayName: 'Admin User',
    ipAddress: '10.0.0.5',
    status: { errorCode: 0 },
    riskLevelDuringSignIn: 'high',
  },
];

const MOCK_DIRECTORY: Array<Record<string, unknown>> = [
  {
    id: 'mock-dir-1',
    activityDateTime: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    activityDisplayName: 'Add member to role',
    category: 'RoleManagement',
    actor: { user: { id: 'admin-guid', displayName: 'Admin', userPrincipalName: 'admin@contoso.edu' } },
    targetResources: [
      { type: 'Role', displayName: 'Global Administrator' },
      { type: 'User', id: 'user-guid-2', displayName: 'New Admin', userPrincipalName: 'newadmin@contoso.edu' },
    ],
  },
];

export async function runMockIngest(): Promise<number> {
  let total = 0;
  for (const raw of MOCK_SIGNINS) {
    const eventTime = (raw.createdDateTime as string) ?? new Date().toISOString();
    const fp = eventFingerprint(raw.id as string, eventTime, 'SIGNIN');
    if (await db.hasFingerprint(fp)) continue;
    const { event, entities } = mapSignInToEvent(raw as Parameters<typeof mapSignInToEvent>[0]);
    await db.insertFingerprint(fp);
    const id = await db.insertEvent(
      {
        event_time: event.event_time,
        category: event.category,
        type: event.type,
        severity: event.severity,
        actor: event.actor,
        target: event.target,
        source: event.source,
        tags: event.tags,
        correlation_key: event.correlation_key,
        raw_ref: event.raw_ref,
        summary: event.summary,
      },
      entities.map((e) => ({ entity_type: e.entity_type, entity_id: e.entity_id, entity_label: e.entity_label, attributes: e.attributes }))
    );
    total++;
    if (event.severity === 'CRITICAL') await notifyCritical(event.summary, id);
  }
  for (const raw of MOCK_DIRECTORY) {
    const eventTime = (raw.activityDateTime as string) ?? new Date().toISOString();
    const fp = eventFingerprint(raw.id as string, eventTime, 'ADMIN_ROLE_GRANTED');
    if (await db.hasFingerprint(fp)) continue;
    const { event, entities } = mapDirectoryAuditToEvent(raw as Parameters<typeof mapDirectoryAuditToEvent>[0]);
    await db.insertFingerprint(fp);
    const id = await db.insertEvent(
      {
        event_time: event.event_time,
        category: event.category,
        type: event.type,
        severity: event.severity,
        actor: event.actor,
        target: event.target,
        source: event.source,
        tags: event.tags,
        correlation_key: event.correlation_key,
        raw_ref: event.raw_ref,
        summary: event.summary,
      },
      entities.map((e) => ({ entity_type: e.entity_type, entity_id: e.entity_id, entity_label: e.entity_label, attributes: e.attributes }))
    );
    total++;
    if (event.severity === 'CRITICAL') await notifyCritical(event.summary, id);
  }
  return total;
}
