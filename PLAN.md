# Security Pulse — Implementation Plan

## 1. Monorepo structure

```
mgraph-test/
├── apps/
│   ├── web/                 # Next.js 14 (App Router), TypeScript
│   ├── api/                 # Express (Node + TypeScript)
│   └── worker/              # Ingestion worker (Node + TypeScript)
├── packages/
│   └── shared/              # Event schema, severity, mappers, types
├── migrations/              # Postgres migrations (node-pg-migrate or raw SQL)
├── docker/
│   ├── Dockerfile.web
│   ├── Dockerfile.api
│   └── Dockerfile.worker
├── docker-compose.yml
├── .env.example
├── PLAN.md
└── README.md
```

- **shared**: Single source of truth for `Event` type, categories, severity rules, normalization (Graph → Event).
- **api**: Serves dashboard and drilldowns from Postgres only; no direct Graph calls from UI path.
- **worker**: Scheduled loop (every 10 min), Graph client credentials, watermarks, dedup, writes to `events` / `event_entities` / optional `raw_events`.

---

## 2. Docker

- **Dockerfiles**: Multi-stage for `web`, `api`, `worker` (Node 20, install deps, build, run).
- **docker-compose**: Services `postgres`, `api`, `worker`, `web`; env from `.env`; api/worker depend on postgres; web depends on api for proxy if needed.
- **.env.example**: `DATABASE_URL`, `GRAPH_TENANT_ID`, `GRAPH_CLIENT_ID`, `GRAPH_CLIENT_SECRET`, `TEAMS_WEBHOOK_URL`, `NODE_ENV`, etc.

---

## 3. Postgres schema and migrations

- **events**: Canonical table (id uuid, event_time timestamptz, ingested_at timestamptz, category, type, severity, actor jsonb, target jsonb, source jsonb, tags text[], correlation_key text, raw_ref jsonb, summary text). Indexes: event_time, (category, type), correlation_key, (source->>'ip'), severity.
- **event_entities**: event_id, entity_type, entity_id, entity_label, attributes jsonb. Index: (event_id), (entity_type, entity_id).
- **raw_events** (optional): id, event_id, source_system, external_id, payload jsonb. For traceability.
- **ingest_watermarks**: source_key text primary, last_success_at timestamptz, last_cursor text. One row per Graph source (e.g. signIns, directoryAudit, riskDetections, sharingReports).
- **event_fingerprints**: fingerprint text primary (hash of source id + event_time + type) to enforce dedup.

Migration order: 001_events, 002_event_entities, 003_raw_events, 004_watermarks, 005_fingerprints_index_or_table (or use unique constraint on a fingerprint column on events).

---

## 4. Canonical event normalization (shared package)

- **Event type**: Single TypeScript interface matching DB; category enum (SIGNIN | RISK | DIRECTORY | SHARING | MAIL), severity enum.
- **Mappers**: One function per signal type:
  - Graph sign-in → Event (SIGNIN, types: MFA_FAILURE, RISKY_SIGNIN, etc.)
  - Directory audit (role assignment) → Event (DIRECTORY, ADMIN_ROLE_GRANTED)
  - Risk detection → Event (RISK, RISK_DETECTION)
  - Usage/report (external sharing) → Event (SHARING, EXTERNAL_SHARE_*)
- **Entity extraction**: From each Graph payload, fill `event_entities` (USER, ROLE, IP, APP, etc.) and set `correlation_key` (e.g. user id).
- **Severity**: Single `classifySeverity(event, context?)` in shared, unit-tested (CRITICAL/HIGH/MEDIUM/LOW rules as specified).

---

## 5. Ingestion pipeline (worker)

- **Graph client**: `@microsoft/microsoft-graph-client` with client credentials (tenant, client id, secret); scopes: SignInLog.Read.All, AuditLog.Read.All, IdentityRiskEvent.Read.All (or equivalent), Reports.Read.All.
- **Loop**: Every 10 minutes; for each source (sign-ins, directory audit, risk detections, reports), read watermark, fetch from Graph (filter by time range), paginate with backoff on 429.
- **Normalize**: Map each record to Event + entities; compute fingerprint (e.g. hash(signInId + eventTime + type)); skip if fingerprint exists; insert events + event_entities (+ raw_events), then update watermark.
- **Alerts**: On insert, if severity === CRITICAL, POST to Teams webhook (optional payload schema).
- **Fixtures**: Optional JSON fixtures for sign-ins, directory audit, risk; worker can run in “mock” mode reading from files for dev without tenant.

---

## 6. API (reads from DB only)

- **Stack**: Express + TypeScript, `pg` or Drizzle/Prisma for Postgres.
- **Endpoints**:
  - `GET /health` — liveness.
  - `GET /metrics/summary?window=24h` — counts by category/severity, optional trends.
  - `GET /events/recent?window=24h&severity=HIGH` — list events with filters.
  - `GET /events/user/:userId?window=7d` — events by correlation_key or user entity.
  - `GET /events/ip/:ip?window=7d` — events by source.ip.
  - `GET /directory/admin-grants?window=24h` — events category=DIRECTORY, type=ADMIN_ROLE_GRANTED.
  - `GET /sharing/spikes?window=7d` — daily deltas + recent SHARING events.
- All queries use indexed columns (event_time, category, type, correlation_key, entity_type+entity_id, source->>'ip').

---

## 7. UI (Next.js)

- **Auth**: Entra ID (MSAL) with restriction to security-admin group (configurable group id in env); protect all dashboard routes.
- **Dashboard**: One main page with:
  - 4 KPI cards: risky sign-ins (24h), MFA failures (24h), new admin grants (24h), external sharing (delta + 24h).
  - Tables: top attacked users, top source IPs, recent admin grants, recent high severity events.
- **Drilldown**: User (last 20 events, by category, filters); IP (users targeted, event types). Data from API only.

---

## 8. README runbook

- Prerequisites: Docker, Node 20.
- `docker compose up` (and optional `-d`).
- Database: run migrations (e.g. `npm run migrate` in api or worker, or a dedicated migrate service).
- Graph: Set env vars (tenant, client id, secret); document app registration and required permissions.
- Smoke test: `curl` health, metrics/summary, events/recent; optional seed script with fixtures.

---

## Implementation order

1. Scaffold monorepo (packages/shared, apps/api, apps/worker, apps/web).
2. Dockerize (Dockerfiles + docker-compose + .env.example).
3. Schema + migrations.
4. Shared: Event type, severity classifier (with tests), normalization mappers.
5. Worker: Graph client, watermarks, dedup, fetchers for sign-in, directory, risk, reports; optional mock mode.
6. API: All read endpoints.
7. Web: Auth (Entra), dashboard layout, KPIs, tables, drilldowns.
8. README with runbook.
