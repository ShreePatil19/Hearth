# Hearth

A platform for women founders to find and win funding.

**Live:** [hearth-seven-zeta.vercel.app](https://hearth-seven-zeta.vercel.app)

## What's here

- **Funding Radar** — public, filterable directory of 308+ grants, accelerators, pitch competitions, and funds from 10 sources. Refreshed daily.
- **Community Dashboard** — privacy-first analytics for Slack communities running women-founder groups. Metadata-only ingest, HMAC-hashed user IDs, per-channel opt-in.

## Tech stack

- Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui
- Supabase (Postgres + Auth + RLS + pgcrypto)
- Python scrapers (requests + BeautifulSoup + httpx)
- Vercel hosting + Vercel Cron
- GitHub Actions for daily scraper refresh
- Recharts, Sentry, CI with RLS security tests

## Local development

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Fill in Supabase URL, anon key, service role key

# Run dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Running scrapers locally

```bash
cd scrapers
python -m venv venv
source venv/Scripts/activate  # or venv/bin/activate on macOS/Linux
pip install -r requirements.txt
python run_all.py
```

### Running tests

```bash
# RLS security tests (requires .env.local configured)
npx tsx scripts/test-rls.ts

# Seed demo data for the dashboard
npx tsx scripts/seed-demo-data.ts
```

## Project structure

```
src/
  app/                    # Next.js App Router
    page.tsx              # Funding Radar homepage (public)
    opp/[slug]/           # Opportunity detail pages
    dashboard/            # Community manager dashboard (auth)
    community/            # Landing page for community managers
    privacy/              # Privacy policy
    auth/                 # Login, signup, callback
    api/                  # Slack OAuth, cron endpoints
  components/             # React components (shadcn/ui + custom)
  lib/                    # Schemas, queries, utilities
  middleware.ts           # Auth gate for /dashboard, CRON_SECRET for /api/cron

scrapers/                 # Python scrapers (10 sources)
  shared/                 # Shared utilities (config, db, tagger)
  run_all.py              # Orchestrator

supabase/migrations/      # Database schema
scripts/                  # Demo seed + RLS tests
.github/workflows/        # CI + daily scraper cron
```

## Privacy guarantees (Community Dashboard)

- Message text is never stored
- User IDs are HMAC-SHA256 hashed with per-community salt
- Per-channel opt-in (default OFF)
- OAuth tokens encrypted at rest (pgcrypto)
- One-tap revoke with cascade delete

## Status

- Phase 1 (Funding Radar): **live**
- Phase 2 (Community Dashboard): **live**
- Phase 3 (founder profiles + recommendations + application tracker): **in progress**
