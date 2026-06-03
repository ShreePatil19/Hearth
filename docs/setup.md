# Local Setup

Get Hearth running on your machine from zero: install dependencies, configure environment variables, apply the database schema, then run the Next.js app and the Python scrapers.

> See also: [architecture.md](architecture.md) · [database.md](database.md) · [data-pipeline.md](data-pipeline.md) · [community-dashboard.md](community-dashboard.md) · [auth-and-access.md](auth-and-access.md) · [api-and-actions.md](api-and-actions.md) · [frontend.md](frontend.md) · [deployment.md](deployment.md) · [contributing.md](contributing.md) · [CLAUDE.md](../CLAUDE.md)

## 1. Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 20 | CI runs Node 20 (`.github/workflows/ci.yml`). `package.json` devDeps pin `@types/node@^20`. |
| npm | bundled with Node 20 | CI installs with `npm ci`. |
| Python | 3.11 **or** 3.12 | The CI `scrapers` job uses **3.11** (`.github/workflows/ci.yml`); the daily refresh workflow uses **3.12** (`.github/workflows/refresh.yml`). Either works locally; the scraper deps are pinned to exact versions (`scrapers/requirements.txt`). |
| Supabase project | — | Provides Postgres + Auth + RLS. Create one at [supabase.com](https://supabase.com); you'll need its URL and API keys (see [§3](#3-environment-variables)). |

> Note: the CI `scrapers` job runs on Python 3.11 while the daily `refresh.yml` runs on 3.12 — keep scraper code compatible with both. See [data-pipeline.md](data-pipeline.md).

## 2. Install dependencies

```bash
# 1. Node / Next.js dependencies (from repo root)
npm install

# 2. Python scraper dependencies (from repo root)
pip install -r scrapers/requirements.txt
```

Python packages installed by `scrapers/requirements.txt` (pinned to exact versions for reproducible CI):

| Package | Version | Used for |
|---|---|---|
| `requests` | 2.33.0 | HTTP requests to source sites |
| `beautifulsoup4` | 4.14.3 | HTML parsing / scraping |
| `httpx` | 0.28.1 | HTTP client (async-capable) |
| `python-dotenv` | 1.2.1 | Loading env vars from `.env` files |
| `pydantic` | 2.12.5 | Data validation / models |
| `pytest` | 9.0.2 | Scraper test runner |

> Tip: To isolate the Python deps, create a virtualenv first (in `scrapers/`): `python -m venv venv`, then activate it — `.\venv\Scripts\Activate.ps1` (Windows PowerShell) or `source venv/bin/activate` (macOS/Linux). See [README.md](../README.md).

## 3. Environment variables

Copy the template and fill in your values:

```bash
cp .env.example .env.local
```

Every variable from `.env.example`:

| Variable | Purpose | Required? | Where to obtain |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (client + server). | **Required** | Supabase dashboard → Project Settings → API. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key for browser/SSR clients (RLS-scoped). | **Required** | Supabase dashboard → Project Settings → API. |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key — bypasses RLS. Used by seed + RLS scripts and admin server paths. Keep secret. | **Required** | Supabase dashboard → Project Settings → API (service_role). |
| `ANTHROPIC_API_KEY` | Anthropic API key for scraper tagging/classification. | Optional for app; needed for scraper tagging. | [console.anthropic.com](https://console.anthropic.com). |
| `NEXT_PUBLIC_SITE_URL` | Public site origin (defaults to `http://localhost:3000` in the template). Used for OAuth redirects / share links. | Required (Phase 2 / OAuth) | Set to your local or deployed origin. |
| `TOKEN_ENCRYPTION_KEY` | Key for encrypting Slack OAuth tokens at rest via `pgcrypto`. | Required for Slack/Dashboard | Generate a strong random key yourself. See [community-dashboard.md](community-dashboard.md). |
| `SLACK_CLIENT_ID` | Slack OAuth app client ID. | Required for Slack/Dashboard | Slack API → your app → Basic Information. |
| `SLACK_CLIENT_SECRET` | Slack OAuth app client secret. | Required for Slack/Dashboard | Slack API → your app → Basic Information. |
| `SLACK_SIGNING_SECRET` | Verifies inbound Slack request signatures. | Required for Slack/Dashboard | Slack API → your app → Basic Information. |
| `CRON_SECRET` | Bearer token guarding `/api/cron/*` endpoints (checked in `src/middleware.ts`). | Required for cron endpoints | Generate a strong random value yourself. See [api-and-actions.md](api-and-actions.md). |
| `ALERT_WEBHOOK_URL` | Webhook URL for operational alerts/notifications. | Optional | Your incoming-webhook provider (e.g. Slack). |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry DSN for client/server error tracking. **When empty, Sentry init is a no-op** (graceful). | Optional | Sentry project settings. |
| `SENTRY_ORG` | Sentry org slug — only for build-time source-map upload (CI only). | Optional | Sentry settings. |
| `SENTRY_PROJECT` | Sentry project slug — only for build-time source-map upload (CI only). | Optional | Sentry settings. |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL for rate limiting. **When unset, rate limiting allows all requests** (graceful). | Optional for local dev | [Upstash](https://upstash.com) free tier. |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token (pairs with the URL above). | Optional for local dev | Upstash console. |

> Secrets are referenced by name only — never commit real values. `.env.local` is the local-only file; do not check it in.

**Graceful-degradation summary:** with `NEXT_PUBLIC_SENTRY_DSN` unset, Sentry does nothing; with `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` unset, the rate limiter allows all requests. The minimum to boot the app and run the RLS/seed scripts is the three Supabase variables.

## 4. Database setup

Hearth has no migration CLI. The schema is a set of **numbered SQL files** in [`supabase/migrations/`](../supabase/migrations) that you run **in the Supabase Dashboard SQL Editor**, in order. The migration headers confirm this — e.g. `001_create_opportunities.sql` and `003_user_profiles_with_approval.sql` both start with `-- Run this in the Supabase Dashboard SQL Editor`.

Apply the `NNN_*.sql` files (skip the `.down.sql` rollback files) in numeric order:

| Order | File |
|---|---|
| 1 | `001_create_opportunities.sql` |
| 2 | `002_phase2_community_dashboard.sql` |
| 3 | `003_user_profiles_with_approval.sql` |
| 4 | `004_tagger_extended_fields.sql` |
| 5 | `005_fix_user_profiles_rls.sql` |
| 6 | `005_user_profiles_rls_hardening.sql` |

> Note: there are **two** migrations numbered `005` (`005_fix_user_profiles_rls.sql` and `005_user_profiles_rls_hardening.sql`). Apply both; the seed/RLS scripts reference migration 005 hardening behaviour (`scripts/test-rls.ts`, Test 8). Confirm intended order in [database.md](database.md).

Each migration also ships a matching `*.down.sql` for rollback. Full schema and RLS detail: **[database.md](database.md)**.

## 5. Running the app

### Next.js dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). (`dev` → `next dev`, `package.json`.)

### Scrapers

```bash
cd scrapers
python run_all.py
```

`run_all.py` is the scraper orchestrator (10 sources). Tagging uses `ANTHROPIC_API_KEY` if set. See [data-pipeline.md](data-pipeline.md).

## 6. Seeding & tests

| Command | What it does | Requires |
|---|---|---|
| `npm run db:seed` | Runs `scripts/seed-demo-data.ts` (via `tsx`): creates a demo Slack community, channels, and ~90 days of synthetic metadata-only `message_events`. Also creates/approves a demo login `demo@hearth.community`. | `.env.local` with `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`; migrations 002 + 003 applied. |
| `npm run db:test-rls` | Runs `scripts/test-rls.ts`: verifies anon users cannot read tenant tables (communities, message_events, integrations, channels, ingest_log) but can read public `opportunities`, and exercises `user_profiles` RLS hardening (migration 005). | `.env.local` with anon key + `SUPABASE_SERVICE_ROLE_KEY`. |
| `npm test` | Runs Vitest once (`vitest run`). Config in `vitest.config.ts`: `happy-dom` environment, includes `src/**/*.test.{ts,tsx}`, excludes `node_modules`, `.next`, `scripts`. | — |
| `python -m pytest scrapers/tests -q` | Runs the Python scraper test suite. | Scraper deps installed (`scrapers/requirements.txt`). |

Extra Vitest scripts (`package.json`): `npm run test:watch` (watch mode), `npm run test:coverage` (text + HTML coverage in `coverage/`).

> Both scripts load `.env.local` via `dotenv` (`scripts/seed-demo-data.ts`, `scripts/test-rls.ts`). The README also documents the raw form `npx tsx scripts/<file>.ts`; the `npm run db:*` wrappers above are equivalent.

## 7. Match CI locally

CI is defined in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml). It has two jobs.

**`build` job (Node 20)** runs these steps in order — replicate them before pushing:

```bash
npm ci            # CI uses a clean install; locally `npm install` is fine
npm run typecheck # tsc --noEmit
npm run lint      # next lint
npm test          # vitest run
npm run build     # next build
npm run db:test-rls   # RLS test — CI runs `npx tsx scripts/test-rls.ts`,
                      # gated on SUPABASE_SERVICE_ROLE_KEY being set
```

**`scrapers` job (Python 3.11)**:

```bash
pip install -r scrapers/requirements.txt
python -m pytest scrapers/tests -q
```

> The RLS step in CI only runs when `SUPABASE_SERVICE_ROLE_KEY` is present (`if: env.SUPABASE_SERVICE_ROLE_KEY != ''`). Locally it needs your `.env.local` configured. CI build env also sets `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `NEXT_PUBLIC_SITE_URL` from repository secrets.

For deployment specifics see [deployment.md](deployment.md); for contribution workflow and commit/PR conventions see [contributing.md](contributing.md).
