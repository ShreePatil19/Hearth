# CLAUDE.md

Guidance for AI assistants and new developers working in this repository. Keep this file current when conventions or architecture change.

## What Hearth is

A platform for women founders to find and win funding. Two products share one Next.js app + Supabase backend:

1. **Funding Radar** — a public, filterable directory of grants, accelerators, pitch competitions, and funds, refreshed daily by Python scrapers.
2. **Community Dashboard** — privacy-first analytics for Slack communities running women-founder groups. Metadata-only ingest, HMAC-hashed user IDs, per-channel opt-in.

**Live:** https://hearth.fishburners.com.au

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14.2 (App Router), React 18, TypeScript 5 |
| Styling/UI | Tailwind CSS 3.4, shadcn/ui (Radix primitives), `next-themes` (dark mode), `lucide-react` icons, `sonner` toasts |
| Backend | Supabase — Postgres + Auth + Row-Level Security + `pgcrypto` |
| Validation | `zod` |
| Data viz / tables | `recharts`, `@tanstack/react-table` |
| Integrations | Slack Web API, Upstash Redis (rate limiting), Sentry (errors), Vercel Analytics |
| Data pipeline | Python scrapers (`requests` / `BeautifulSoup` / `httpx`) |
| Tests | Vitest + happy-dom (TS); pytest (scrapers); custom RLS security test |
| Hosting / CI | Vercel + Vercel Cron; GitHub Actions (CI + daily scrape) |

## Repository layout

```
src/
  app/                  # Next.js App Router
    page.tsx            # Funding Radar homepage (public)
    opportunities/      # Full opportunity list (auth-gated)
    opp/[slug]/         # Opportunity detail pages
    dashboard/          # Community dashboard (auth) + share/[shareToken] (public)
    admin/              # Admin console (members, etc.) — is_admin gated
    auth/               # login, signup, callback, pending, signout
    api/                # cron/* (Bearer CRON_SECRET) + slack/* (OAuth)
  components/           # ui/ (shadcn) + dashboard/, auth/, tables
  lib/                  # supabase clients, dashboard-queries, slack, schemas (zod), filters, rate-limit, notifications, types, constants, utils
  middleware.ts         # Auth gate + cron auth + admin gate
supabase/migrations/    # Numbered SQL migrations (RLS, pgcrypto, RPCs)
scrapers/               # Python: 10 source scrapers + shared/ + tests + run_all.py
scripts/                # seed-demo-data.ts, test-rls.ts
.github/workflows/      # ci.yml (build/test/RLS) + refresh.yml (daily scrape)
docs/                   # Developer documentation (see docs/README.md)
```

## Common commands

```bash
npm run dev            # Next dev server (http://localhost:3000)
npm run build          # Production build
npm run lint           # next lint (ESLint)
npm run typecheck      # tsc --noEmit
npm test               # vitest run
npm run test:watch     # vitest (watch)
npm run test:coverage  # vitest run --coverage
npm run db:seed        # seed demo dashboard data
npm run db:test-rls    # RLS security test (needs .env.local)
```

Scrapers (from `scrapers/`): `python run_all.py`. Tests: `python -m pytest scrapers/tests -q`.

## Environment variables

Copy `.env.example` → `.env.local` and fill in. **Never commit real secret values; document keys by name only.**

- **Supabase:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- **Site:** `NEXT_PUBLIC_SITE_URL`
- **Dashboard / Slack:** `TOKEN_ENCRYPTION_KEY`, `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_SIGNING_SECRET`, `CRON_SECRET`, `ALERT_WEBHOOK_URL`
- **Scrapers:** `ANTHROPIC_API_KEY` (passed in CI but currently **unused** — the tagger in `scrapers/shared/tagger.py` is rule-based regex, no LLM)
- **Optional:** `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (graceful no-op / allow-all when unset)

## Privacy & security model (read before touching dashboard/auth/DB)

- **No message text is ever stored.** Slack ingest is metadata-only.
- **User IDs are HMAC-SHA256 hashed** with a per-community salt.
- **Per-channel opt-in**, default OFF.
- **OAuth tokens encrypted at rest** via `pgcrypto` (`TOKEN_ENCRYPTION_KEY`).
- **RLS everywhere.** Public share links go through a `SECURITY DEFINER` RPC, not direct table access.
- **Auth gate** (`src/middleware.ts`): gated routes require an authenticated user with an `approved` `user_profiles` row; `/admin/*` additionally requires `is_admin`.
- **Rate limiting** via Upstash on auth + Slack endpoints.
- Baseline security headers set in `next.config.mjs`.

When changing migrations, RLS policies, auth, or ingest, treat correctness as security-critical and run `npm run db:test-rls`.

## Conventions

- **Commits:** Conventional Commits — `type(scope): subject` (`feat`, `fix`, `perf`, `docs`, `chore`). Reference issues with `Closes #N`.
- **Branches:** `type/short-description` (e.g. `fix/upstash-rate-limiter`, `docs/developer-documentation`).
- **PRs:** `## Summary` (bold **Fixes #N** first), optional `## Migration` / `## Setup required` / `## Files changed`, then a `## Test plan` checklist. See `docs/contributing.md`.
- **Issue labels:** priority `P0`/`P1`/`P2` + type (`security`, `perf`, `tech-debt`, `bug`, `enhancement`, `testing`, `documentation`).
- **CI gates** (PRs to `main`): typecheck → lint → test → build → RLS test, plus scraper pytest.
- **Migrations:** numbered `NNN_name.sql`, applied via the Supabase SQL editor.

## Documentation map

Full developer docs live in [`docs/`](docs/README.md):

- **Onboarding:** `architecture.md`, `setup.md`, `database.md`
- **Subsystems:** `community-dashboard.md`, `auth-and-access.md`, `data-pipeline.md`, `api-and-actions.md`
- **Supporting:** `frontend.md`, `deployment.md`, `contributing.md`, `BRAND.md`
