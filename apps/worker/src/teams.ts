import { config } from './config';

export async function notifyCritical(summary: string, eventId: string): Promise<void> {
  if (!config.teamsWebhookUrl) return;
  try {
    const body = {
      '@type': 'MessageCard',
      summary: 'Security Pulse: CRITICAL',
      title: 'CRITICAL event',
      text: summary,
      potentialAction: [{ '@type': 'OpenUri', name: 'View', targets: [{ os: 'default', uri: `#event/${eventId}` }] }],
    };
    await fetch(config.teamsWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (_) {
    // best-effort
  }
}
