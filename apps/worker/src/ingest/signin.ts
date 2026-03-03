import { eventFingerprint } from '@security-pulse/shared';
import { mapSignInToEvent } from '@security-pulse/shared';
import type { GraphSignIn } from '@security-pulse/shared';
import * as db from '../db';
import { graphPaginate } from '../graph';
import { notifyCritical } from '../teams';

const SOURCE_KEY = 'signInLogs';

export async function ingestSignIns(): Promise<number> {
  const watermark = await db.getWatermark(SOURCE_KEY);
  const since = watermark
    ? new Date(watermark.last_success_at)
    : new Date(Date.now() - 24 * 60 * 60 * 1000);
  const filter = `createdDateTime ge ${since.toISOString()}`;

  let ingested = 0;
  let latestTime = since.getTime();

  await graphPaginate<GraphSignIn>(
    '/auditLogs/signIns',
    { $filter: filter, $top: '100', $orderby: 'createdDateTime asc' },
    async (items) => {
      for (const raw of items) {
        const eventTime = raw.createdDateTime ?? new Date().toISOString();
        const fp = eventFingerprint(raw.id, eventTime, 'SIGNIN');
        if (await db.hasFingerprint(fp)) continue;

        const userId = raw.userId ?? raw.userPrincipalName ?? '';
        const ip = raw.ipAddress ?? '';
        const [mfaUser, mfaIp] = await Promise.all([
          userId ? db.getMfaFailureCountForUser(userId) : 0,
          ip ? db.getMfaFailureCountForIp(ip) : 0,
        ]);
        const { event, entities } = mapSignInToEvent(raw as GraphSignIn, {
          mfaFailureCountForUser: mfaUser,
          mfaFailureCountForIp: mfaIp,
        });

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
