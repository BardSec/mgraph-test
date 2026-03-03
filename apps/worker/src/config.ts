export const config = {
  databaseUrl: process.env.DATABASE_URL || 'postgres://securitypulse:secret@localhost:5432/securitypulse',
  graph: {
    tenantId: process.env.GRAPH_TENANT_ID!,
    clientId: process.env.GRAPH_CLIENT_ID!,
    clientSecret: process.env.GRAPH_CLIENT_SECRET!,
  },
  teamsWebhookUrl: process.env.TEAMS_WEBHOOK_URL || '',
  useMock: process.env.USE_GRAPH_MOCK === 'true',
  pollIntervalMs: 10 * 60 * 1000, // 10 minutes
};
