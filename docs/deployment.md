# Deployment & CI/CD

How Hearth is hosted, scheduled, tested in CI, and monitored. For local setup see [setup.md](setup.md); for the env-var catalog see [setup.md](setup.md) and [CLAUDE.md](../CLAUDE.md).

## Hosting (Vercel)

The Next.js app deploys to Vercel (production domain: `hearth.fishburners.com.au`). Pushes to `main` deploy to production; pull requests get preview deployments.

Environment variables are configured in the Vercel project settings (Production + Preview). The same keys from `.env.example` apply. Secrets must **never** be committed; set them in Vercel and in GitHub Actions secrets (see below).

## Scheduled jobs (Vercel Cron)

Defined in `vercel.json`:

| Path | Schedule (UTC) | Purpose |
|---|---|---|
| `/api/cron/ingest-slack` | `0 2 * * *` (02:00) | Pull metadata-only Slack activity into `message_events` |
| `/api/cron/compute-cohorts` | `30 2 * * *` (02:30) | Recompute cohort retention into `cohort_snapshots` |

**Auth:** these routes are gated in `src/middleware.ts`, which requires `Authorization: Bearer $CRON_SECRET`. Set `CRON_SECRET` in the Vercel project — Vercel attaches this header to cron invocations automatically when the env var is present. A missing/incorrect secret returns `401`. See [api-and-actions.md](api-and-actions.md) and [community-dashboard.md](community-dashboard.md).

## CI (GitHub Actions — `.github/workflows/ci.yml`)

Runs on push and PR to `main`. Two jobs:

**`build`** (Node 20):
1. `npm ci`
2. `npm run typecheck` (`tsc --noEmit`)
3. `npm run lint` (`next lint`)
4. `npm test` (`vitest run`)
5. `npm run build`
6. `npx tsx scripts/test-rls.ts` — **only if** `SUPABASE_SERVICE_ROLE_KEY` secret is present

**`scrapers`** (Python 3.11): `pip install -r scrapers/requirements.txt` then `python -m pytest scrapers/tests -q`.

Required CI secrets: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. (`NEXT_PUBLIC_SITE_URL` is hardcoded to production in the workflow.)

## Daily scraper refresh (`.github/workflows/refresh.yml`)

| Trigger | Detail |
|---|---|
| Schedule | `0 18 * * *` UTC (≈ 4am AEST) |
| Manual | `workflow_dispatch` |
| Runtime | Python 3.12, `pip` cache |
| Command | `python run_all.py` (working dir `scrapers/`) |

Secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`.

> Note: `ANTHROPIC_API_KEY` is passed here but the tagger (`scrapers/shared/tagger.py`) is rule-based and does not call an LLM — the key is currently unused. See [data-pipeline.md](data-pipeline.md).

> Note: CI runs the scraper job on Python 3.11 while the refresh job uses 3.12. Keep scraper code compatible with both.

## Error monitoring (Sentry)

`@sentry/nextjs` wraps the build in `next.config.mjs` (`withSentryConfig`) and initializes in `sentry.client.config.ts`, `sentry.server.config.ts`, and `sentry.edge.config.ts`.

- All three init blocks are **gated on `NEXT_PUBLIC_SENTRY_DSN`** (`enabled: !!dsn`) — Sentry is a no-op when the DSN is unset (e.g. local dev).
- `tracesSampleRate: 0.1` (10%); session replays disabled.
- Source maps upload only in CI (`silent: !process.env.CI`), using `SENTRY_ORG` / `SENTRY_PROJECT`.

## Security headers

`next.config.mjs` sets baseline headers on every response: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security` (2-year, includeSubDomains), and a restrictive `Permissions-Policy`. A nonce-based Content-Security-Policy is intentionally deferred (noted in the config).

## Deploy checklist

- [ ] Env vars set in Vercel (Production + Preview)
- [ ] `CRON_SECRET` set so Vercel Cron is authorized
- [ ] CI secrets set in GitHub (Supabase keys; `ANTHROPIC_API_KEY` for refresh)
- [ ] New migrations applied to the Supabase project (see [database.md](database.md))
- [ ] `NEXT_PUBLIC_SENTRY_DSN` + `SENTRY_ORG`/`SENTRY_PROJECT` set if monitoring is wanted
