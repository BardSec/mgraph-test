import { eventFingerprint } from '@security-pulse/shared';
import { mapDirectoryAuditToEvent } from '@security-pulse/shared';
import type { GraphDirectoryAudit } from '@security-pulse/shared';
import * as db from '../db';
import { graphPaginate } from '../graph';
import { notifyCritical } from '../teams';

const SOURCE_KEY = 'directoryAudits';

export async function ingestDirectoryAudits(): Promise<number> {
  const watermark = await db.getWatermark(SOURCE_KEY);
  const since = watermark
    ? new Date(watermark.last_success_at)
    : new Date(Date.now() - 24 * 60 * 60 * 1000);
  const filter = `activityDateTime ge ${since.toISOString()}`;

  let ingested = 0;
  let latestTime = since.getTime();

  await graphPaginate<GraphDirectoryAudit>(
    '/auditLogs/directoryAudits',
    { $filter: filter, $top: '100', $orderby: 'activityDateTime asc' },
    async (items) => {
      for (const raw of items) {
        const eventTime = raw.activityDateTime ?? new Date().toISOString();
        const type = raw.activityDisplayName?.toLowerCase().includes('role') ? 'ADMIN_ROLE_GRANTED' : 'DIRECTORY_CHANGE';
        const fp = eventFingerprint(raw.id, eventTime, type);
        if (await db.hasFingerprint(fp)) continue;

        const { event, entities } = mapDirectoryAuditToEvent(raw as GraphDirectoryAudit);

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
        ingested++;
        if (event.severity === 'CRITICAL') await notifyCritical(event.summary, id);
        const t = new Date(event.event_time).getTime();
        if (t > latestTime) latestTime = t;
      }
      return true;
    }
  );

  if (ingested > 0 || watermark) {
    await db.setWatermark(SOURCE_KEY, new Date(latestTime));
  }
  return ingested;
}
