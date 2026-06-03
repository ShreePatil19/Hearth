# Architecture

Hearth is a Next.js 14 (App Router) + Supabase application that serves two products from one codebase: a public **Funding Radar** directory and a privacy-first **Community Dashboard** for Slack analytics, fed by Python scrapers and scheduled jobs.

This doc gives a newcomer the mental model. For setup see [setup.md](setup.md); for the schema see [database.md](database.md). Repo conventions live in [CLAUDE.md](../CLAUDE.md).

## The two products

| Product | What it does | Audience | Entry routes |
|---|---|---|---|
| **Funding Radar** | Filterable directory of grants, accelerators, pitch competitions, and funds, refreshed daily by Python scrapers. | Approved members | `src/app/page.tsx` (public landing), `src/app/opportunities/` + `src/app/opp/[slug]/` (gated list/detail) |
| **Community Dashboard** | Privacy-first engagement analytics for Slack communities. Metadata-only ingest, HMAC-hashed user IDs, per-channel opt-in. | Community owners + admins | `src/app/dashboard/` (gated), `src/app/dashboard/share/[shareToken]/` (public read-only) |

> Note: the marketing landing page (`src/app/page.tsx`) is public, but the full opportunity list (`/opportunities`, `/opp/*`) is gated by the auth + approval middleware (see [Trust boundaries](#request-lifecycle--trust-boundaries) below). Access is invite-only/admin-approved.

## Component diagram

```
                        ┌──────────────────────────────────────────────┐
                        │            Next.js 14 (App Router)             │
                        │  src/app/ — RSC pages, route handlers,         │
   Browser ───────────▶ │  server actions, src/middleware.ts (edge gate)│
                        └───────┬───────────────────────┬───────────────┘
                                │                        │
              4 Supabase clients│                        │ external integrations
              (server/browser/  │                        │
               admin/middleware)│                        ▼
                                ▼              ┌──────────────────────────┐
                   ┌────────────────────────┐ │ Slack Web API (OAuth +    │
                   │  Supabase               │ │   conversations.history)  │
                   │  Postgres + Auth + RLS  │ │ Upstash Redis (ratelimit) │
                   │  + pgcrypto (token enc) │ │ Sentry (errors)           │
                   │  + SECURITY DEFINER RPCs│ │ Vercel Analytics          │
                   └───────▲────────────▲────┘ └──────────────────────────┘
                           │            │
        service-role (REST)│            │ Bearer CRON_SECRET (HTTP GET)
                           │            │
              ┌────────────┴───┐   ┌────┴───────────────────────────┐
              │ Python scrapers│   │ Schedulers                     │
              │ scrapers/      │   │ • Vercel Cron → /api/cron/*    │
              │ run_all.py     │   │ • GitHub Actions → run scrapers│
              └────────▲───────┘   └────────────────────────────────┘
                       │
            GitHub Actions (.github/workflows/refresh.yml)
```

External integrations and where they are wired (verified):

| Integration | Used by | Env var(s) |
|---|---|---|
| Slack Web API | `src/app/api/slack/callback/route.ts` (OAuth), `src/app/api/cron/ingest-slack/route.ts` (`conversations.history`) | `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET` |
| Upstash Redis | `src/lib/rate-limit.ts` (sliding-window limiter; no-op/allow-all when unset) | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` |
| Sentry | `next.config.mjs` (`withSentryConfig`) | `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT` |
| Vercel Analytics | `src/app/layout.tsx` (`<Analytics />`) | — |
| Alert webhook | `src/lib/notifications.ts` (cron failure alerts; optional) | `ALERT_WEBHOOK_URL` |
| Anthropic API key | passed to `.github/workflows/refresh.yml` env — **currently unused** | `ANTHROPIC_API_KEY` |

> Note: `ANTHROPIC_API_KEY` is passed to `refresh.yml` but no code consumes it — `scrapers/shared/tagger.py` is a **rule-based** tagger (regex + source defaults, "no LLM needed"), confirmed by a code search across `scrapers/`. The key is reserved/latent. See [data-pipeline.md](data-pipeline.md).

## End-to-end data flows

### (a) Funding Radar: scrapers → `opportunities` → public-ish pages

```
GitHub Actions (refresh.yml, daily 18:00 UTC)
  → scrapers/run_all.py iterates 10 source modules, each calls .run()
  → shared/db.py upsert_opportunity(): content-hash dedup, rule-based tag,
    POST/PATCH to Supabase REST as service-role (on_conflict=slug)
  → run_all.py expire pass: PATCH is_active=false for past-deadline or stale opps
  → opportunities table (RLS: active rows readable)
  → Next.js RSC reads via server client: landing count (page.tsx),
    list (/opportunities), detail (/opp/[slug])
```

The scrapers talk to Postgres over the Supabase **REST** API using the service-role key (`scrapers/shared/config.py`), not the JS SDK. Detail in [data-pipeline.md](data-pipeline.md).

### (b) Community Dashboard: Slack OAuth → daily ingest → tables → charts

```
Owner clicks install → /api/slack/install (CSRF state cookie)
  → Slack OAuth → /api/slack/callback:
      exchange code, upsert communities row, store_integration RPC
      (token encrypted at rest via pgcrypto), sync channels (opted_in=false)
  → owner toggles channels on in /dashboard/[communityId]/settings

Vercel Cron (vercel.json):
  02:00 UTC → /api/cron/ingest-slack  (Bearer CRON_SECRET)
      per active community: get_decrypted_token RPC → for each opted-in channel,
      conversations.history (last 24h) → store METADATA ONLY into message_events
      (hashed_user_id, ts, msg_length, has_thread, has_reaction); never text
  02:30 UTC → /api/cron/compute-cohorts (Bearer CRON_SECRET)
      build cohort retention matrix → cohort_snapshots

Dashboard pages:
  src/lib/dashboard-queries.ts aggregates message_events / cohort_snapshots
  → Recharts components render metrics, volume, channels, contributors, retention
```

Message text is never persisted — only derived metadata. User identity is HMAC-SHA256 hashed with a per-community salt (`hmacUserId` in `src/lib/slack.ts`). Full pipeline and privacy model in [community-dashboard.md](community-dashboard.md) and [database.md](database.md).

## The three Supabase client types

Each client lives under `src/lib/supabase/` and exists for a distinct trust context. Picking the wrong one is a security bug.

| Client | File | Auth context | RLS | Use it in |
|---|---|---|---|---|
| **Server** | `server.ts` (`createClient`) | Logged-in user's session, read from cookies via `@supabase/ssr` | **Enforced** (acts as the user) | RSC pages, server actions, server-side route handlers that act on behalf of the user |
| **Browser** | `client.ts` (`createClient`) | User session in the browser; anon key | **Enforced** | Client components needing live Supabase calls (e.g. auth UI) |
| **Admin / service-role** | `admin.ts` (`createAdminClient`) | Service-role key, no session (`autoRefreshToken`/`persistSession` off) | **Bypassed** | API routes + cron jobs only. The file warns: never import in client/server components |
| **Middleware** | `middleware.ts` (`createMiddlewareClient`) | User session, but reads/refreshes cookies off the `NextRequest`/`NextResponse` pair | **Enforced** | Only `src/middleware.ts`, to read the user + profile while keeping the session cookie fresh |

Notes from the source:
- The **server** client swallows cookie-write errors (a Phase-1 artifact comment), so cookie refresh during RSC render is best-effort; the **middleware** client is what actually rotates the session cookie on each request.
- The **admin** client is the only way Hearth bypasses RLS. It is used deliberately for cron ingest, the Slack callback, and the public share page — which resolves data through a `SECURITY DEFINER` RPC (`get_shared_dashboard`) rather than exposing tables directly (`src/app/dashboard/share/[shareToken]/page.tsx`).

## Request lifecycle & trust boundaries

All gating happens in `src/middleware.ts` (its `matcher` runs on `/dashboard/*`, `/admin/*`, `/opportunities/*`, `/opp/*`, `/api/cron/*`). Order matters — early returns define each boundary:

1. **Public share link** — `/dashboard/share/*` → `NextResponse.next()`, no auth. Data access is locked down at the DB layer via the `get_shared_dashboard` `SECURITY DEFINER` RPC, not in middleware.
2. **Admin login** — `/admin/login` is the one un-gated path under `/admin`.
3. **Cron Bearer** — `/api/cron/*` requires header `Authorization: Bearer ${CRON_SECRET}`; otherwise `401`. (Vercel Cron supplies this; see [deployment.md](deployment.md).)
4. **Authenticated + approved** — `/dashboard`, `/admin`, `/opportunities`, `/opp/*`:
   - No user → redirect to `/auth/login?redirect=<path>`.
   - Look up `user_profiles` (`status`, `is_admin`). No row or `status !== "approved"` → redirect to `/auth/pending`.
5. **Admin-only** — within the gated branch, `/admin*` additionally requires `is_admin === true`; non-admins are redirected to `/dashboard`.
6. **Everything else** → `NextResponse.next()` (e.g. `/`, `/community`, `/privacy`, `/auth/*` are not matched by the gate).

This yields five trust tiers: **public**, **cron (shared secret)**, **public share link (RPC-scoped)**, **authenticated+approved**, and **admin**. Baseline security headers (`X-Frame-Options`, HSTS, etc.) are applied to every response in `next.config.mjs`; a nonce-based CSP is explicitly deferred there. Auth flows, the approval queue, and RLS are detailed in [auth-and-access.md](auth-and-access.md).

## App Router structure (at a glance)

```
src/app/
  layout.tsx                 # root: fonts, ThemeProvider, Vercel Analytics
  page.tsx                   # Funding Radar landing (public)
  opportunities/page.tsx     # full list (gated)
  opp/[slug]/                # detail + loading + not-found (gated)
  dashboard/                 # owner dashboard (gated)
    [communityId]/           # per-community views + settings (channel opt-in)
    share/[shareToken]/      # public read-only dashboard (RPC-scoped)
  admin/                     # admin console; login/ is public, rest is_admin-gated
  auth/                      # login, signup, callback, pending, signout
  community/, privacy/       # public marketing/legal
  api/
    slack/{install,callback} # OAuth start + callback
    cron/{ingest-slack,compute-cohorts}  # Bearer CRON_SECRET
```

## Where to go next

| Topic | Doc |
|---|---|
| Run it locally (env, DB, scrapers, tests) | [setup.md](setup.md) |
| Schema, migrations, RLS, encryption | [database.md](database.md) |
| Slack ingest, cron, cohorts, charts, privacy | [community-dashboard.md](community-dashboard.md) |
| Auth flows, approval gate, admin, rate limiting | [auth-and-access.md](auth-and-access.md) |
| Python scrapers, the 10 sources, tagging | [data-pipeline.md](data-pipeline.md) |
| API routes & server actions catalog | [api-and-actions.md](api-and-actions.md) |
| App Router + component library conventions | [frontend.md](frontend.md) |
| Vercel hosting, Cron, CI/CD, Sentry, secrets | [deployment.md](deployment.md) |
| Branch/commit/PR conventions, review gates | [contributing.md](contributing.md) |
| Repo orientation & conventions (root) | [CLAUDE.md](../CLAUDE.md) |
