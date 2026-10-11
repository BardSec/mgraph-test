# Security Pulse (mgraph-test)

A prototype security signal dashboard for a Microsoft 365 / Entra ID tenant. A background worker pulls sign-in logs, directory audit events, and identity risk detections from Microsoft Graph, normalizes them into one event schema, scores their severity, and stores them in PostgreSQL. A read-only API then serves summaries and drilldowns for a dashboard. It's aimed at a district IT or security team that wants a quick view of risky sign-ins, MFA failures, and new admin role grants.

## What's included

- **Worker** (`apps/worker`): polls Graph every 10 minutes with app-only (client credentials) auth.
  - Sources: `/auditLogs/signIns`, `/auditLogs/directoryAudits`, `/identityProtection/riskDetections`
  - Per-source watermarks for incremental fetches, pagination, and fingerprint-based deduplication
  - Optional Teams incoming-webhook post for CRITICAL events
  - Mock mode (`USE_GRAPH_MOCK=true`) that ingests built-in sample data so you can run without a tenant
  - External sharing ingest is a placeholder: it seeds a single synthetic event, and the Graph reports call isn't wired up
- **Shared package** (`packages/shared`): the canonical event type, Graph-to-event mappers (sign-in, directory, risk, sharing), event fingerprinting, and a single severity classifier (CRITICAL / HIGH / MEDIUM / LOW). Both the classifier and fingerprinting have Jest unit tests.
- **API** (`apps/api`): Express server that reads only from Postgres.

| Endpoint | Description |
|---|---|
| `GET /health` | Liveness check |
| `GET /metrics/summary?window=24h` | Counts by category and severity |
| `GET /events/recent?window=&severity=` | Recent events, filterable |
| `GET /events/user/:userId` | Events for one user |
| `GET /events/ip/:ip` | Events from one source IP |
| `GET /directory/admin-grants` | Recent admin role grants |
| `GET /sharing/spikes` | Sharing activity and deltas |
| `GET /dashboard/top-attacked-users`, `/top-ips`, `/recent-admin-grants`, `/recent-high-severity` | Dashboard tables |

- **Migrations** (`migrations/*.sql`): `events`, `event_entities`, `raw_events`, `ingest_watermarks`, `event_fingerprints`, applied in order by `npm run migrate`

See `PLAN.md` for the full design, including the planned dashboard UI.

## Tech stack

- Node.js 20, TypeScript, npm workspaces monorepo
- Express, `pg`, `@microsoft/microsoft-graph-client`
- PostgreSQL 16
- Jest (shared package tests)
- Docker / Docker Compose

## Setup

1. Create an Entra ID app registration with a client secret and grant **application** permissions with admin consent for: `AuditLog.Read.All` (sign-in and directory audit logs) and `IdentityRiskEvent.Read.All` (risk detections). Sign-in logs require Entra ID P1 or higher, and risk detections require P2.
2. Copy and fill in the environment file:
   ```bash
   cp .env.example .env
   ```
3. Start the stack:
   ```bash
   docker compose up -d --build postgres api worker
   ```
4. Run the migrations against the database (for example from your host, with `DATABASE_URL` pointing at `localhost:5432`):
   ```bash
   npm install
   npm run migrate
   ```
5. Smoke test:
   ```bash
   curl localhost:3001/health
   curl "localhost:3001/metrics/summary?window=24h"
   ```

To try it without a tenant, set `USE_GRAPH_MOCK=true`.

Local development without Docker: `npm run dev:api` and `npm run dev:worker`.

## Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `GRAPH_TENANT_ID` | Entra tenant ID for Graph app-only auth |
| `GRAPH_CLIENT_ID` | App registration client ID |
| `GRAPH_CLIENT_SECRET` | App registration client secret |
| `TEAMS_WEBHOOK_URL` | Optional Teams incoming webhook for CRITICAL alerts |
| `USE_GRAPH_MOCK` | `true` to ingest built-in sample data instead of calling Graph |
| `API_URL` / `NEXT_PUBLIC_API_URL` | API base URL for the (not yet built) web app |
| `NEXT_PUBLIC_ENTRA_CLIENT_ID`, `ENTRA_CLIENT_SECRET`, `ENTRA_TENANT_ID` | Planned Entra (MSAL) sign-in for the web UI |
| `SECURITY_ADMIN_GROUP_ID` | Planned: restrict the dashboard to this security group |
| `NODE_ENV` | Node environment |
| `PORT` | API port (default 3001) |
| `MIGRATIONS_DIR` | Override the migrations folder used by `npm run migrate` |

## Project structure

```
apps/
  api/          Express read API and SQL migration runner
  worker/       Graph ingestion loop, watermarks, dedup, Teams alerts, mock data
packages/
  shared/       Event types, mappers, severity classifier, fingerprinting (+ tests)
migrations/     Plain SQL schema files
docker/         Dockerfiles for api, worker, web
PLAN.md         Implementation plan
```

## Status

Unfinished prototype. The Next.js web dashboard (`apps/web`) described in `PLAN.md` and referenced by `docker-compose.yml` and `docker/Dockerfile.web` hasn't been committed, so the `web` service won't build. The API has no authentication and allows any CORS origin, so don't expose it publicly. The workspace packages use the `workspace:*` dependency syntax, which plain npm may reject, and there's no lockfile. Sharing ingest is a stub.
