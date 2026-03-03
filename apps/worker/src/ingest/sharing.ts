import { eventFingerprint } from '@security-pulse/shared';
import { mapSharingReportToEvent } from '@security-pulse/shared';
import * as db from '../db';

const SOURCE_KEY = 'sharingReports';

/** V1: synthesize sharing events from a simple check (e.g. report or mock). Full report API can be wired later. */
export async function ingestSharingReports(): Promise<number> {
  const watermark = await db.getWatermark(SOURCE_KEY);
  const since = watermark
    ? new Date(watermark.last_success_at)
    : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Placeholder: in production, call Graph reports API (e.g. getSharePointActivityPages with report period).
  // For now we don't call Graph reports to avoid extra scope; schema is ready for when we add it.
  let ingested = 0;
  const now = new Date();
  if (!watermark) {
    // Seed one synthetic event so sharing/spikes has data for demo
    const payload = {
      id: `share-${since.getTime()}`,
      eventTime: since.toISOString(),
      ownerDisplayName: 'System',
      sharedExternally: 0,
      isSpike: false,
    };
    const fp = eventFingerprint(payload.id, payload.eventTime, 'EXTERNAL_SHARE_CREATED');
    if (!(await db.hasFingerprint(fp))) {
      const { event, entities } = mapSharingReportToEvent(payload);
      await db.insertFingerprint(fp);
      await db.insertEvent(
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
    }
    await db.setWatermark(SOURCE_KEY, now);
  }
  return ingested;
}
