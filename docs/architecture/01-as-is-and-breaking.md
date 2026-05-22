# Hearth — As-Is Architecture & Where It's Breaking

> Snapshot date: 2026-05-22
> Author: System-design conversation (Shree + Claude)
> Status: Pre-redesign inventory. Not a target architecture. **Do not implement from this file.**
> Companion docs (forthcoming): `02-target-overview.md`, then one file per layer.

---

## TL;DR

Three different products share one Next.js app and one Supabase database:

1. **Public funding directory** — anonymous browse, scraped from 10 sources, public-read RLS
2. **Community analytics SaaS** — per-tenant OAuth, encrypted Slack tokens, owner-scoped RLS, privacy-first metadata ingest
3. **Internal admin tool** — Fishburners staff approval workflow + member management

They were merged under one app because they share a "women founders + privacy-first" narrative. They do **not** share data models, access tiers, scaling profiles, or audiences. The only genuinely shared piece is the identity layer (Supabase Auth + `user_profiles`), and it's currently the most overloaded component in the stack.

The architecture didn't get redesigned when the product changed direction (public radar → invite-only → Ascent feeder). It got patched. Result: middleware does too much, the dashboard has no service layer, two contradictory access contracts (private auth wrapping public data) live in the same routes, and Phase 3 (founder personalization) will land on top of a `user_profiles` table that doesn't yet distinguish founder from community manager.

---

## Module Inventory — 9 modules across 4 layers

### Layer 1 — Data Ingest (write-side)

#### M1. Opportunity Ingest (Python + GitHub Actions)

| | |
|---|---|
| Purpose | Daily scrape of 10 funding sources → tagged opportunities |
| Trigger | GitHub Actions cron `0 18 * * *` (`.github/workflows/refresh.yml`) + manual `workflow_dispatch` |
| Writes | `opportunities` (via Supabase REST, `service_role` key) |
| Reads | 10 public funding source sites (9× BeautifulSoup, 1× Coveo JSON API) |
| Entry point | `scrapers/run_all.py:main()` |
| Choke point | `scrapers/shared/db.py:upsert_opportunity()` — slug lookup → MD5 content_hash skip → tag → upsert with `on_conflict: slug` |
| Tagger | `scrapers/shared/tagger.py` — rule-based regex (no LLM yet) |
| Auto-expire | `run_all.py:expire_stale_opportunities()` — past-deadline + 180-day-stale → `is_active=false` |
| External deps | Coveo API token (business.gov.au), Supabase service role |

**Smells**
- Hardcoded Coveo token at `scrapers/business_gov_au.py:12` (should be env var)
- `ANTHROPIC_API_KEY` loaded in `refresh.yml:16` but unused (placeholder for planned A.1 AI tagger)
- No HTTP retries; individual scraper failures are logged but pipeline continues
- Greedy amount parsing in `tagger.py` may capture unrelated prices in HTML
- **Tagger doesn't actually classify `type`** — `tagger.py:127` is `type=defaults.get("type", "grant")`. No content inspection. All classification authority sits with the scraper's hardcoded `DEFAULTS["type"]`.
- **`business_gov_au.py:119` mislabels** — blanket-tags ~300 Coveo results as `"grant"` but the search hub returns accelerators, programs, R&D incentives, voucher schemes that should be `accelerator` / `fund` / `other`.
- **`opportunities.type` column has `DEFAULT 'other'`** (`001_create_opportunities.sql:22`) — combined with the skip-if-unchanged `content_hash` logic, legacy untyped rows are stuck as `other` and never re-tagged.

#### M2. Slack Ingest (TypeScript + Vercel Cron)

| | |
|---|---|
| Purpose | OAuth install for community workspaces + daily message metadata pull + cohort retention precompute |
| Triggers | User OAuth at `/api/slack/install` · Vercel cron `0 2 * * *` (ingest) · `30 2 * * *` (cohorts) |
| Writes | `communities`, `integrations`, `channels`, `message_events`, `cohort_snapshots`, `ingest_log` |
| Reads | Slack Web API — `oauth.v2.access`, `conversations.list`, `conversations.history` |
| OAuth flow | `/api/slack/install` (CSRF via `slack_oauth_state` cookie, 5/min rate limit) → Slack auth → `/api/slack/callback` (token exchange, encrypted storage, channel sync with `opted_in=false` default) |
| Encryption | `pgp_sym_encrypt` via RPC `store_integration` / `get_decrypted_token` (both `SECURITY DEFINER`), key from `TOKEN_ENCRYPTION_KEY` env var |
| User hashing | HMAC-SHA256 with per-community 32-byte hex salt (`communities.salt`), set on install, never rotated |
| Privacy model | Opted-in channel default OFF, no message content stored, no display names, only `(channel_id, hashed_user_id, ts, msg_length, has_thread, has_reaction)` |
| Idempotency | Unique index on `(community_id, channel_id, hashed_user_id, ts)` |

**Smells**
- **24-hour ingest window only** (`/api/cron/ingest-slack:74`) — no historical backfill ever possible after install
- No Slack 429 backoff — channel loop dies on rate limit
- Cohort JS fallback in `/api/cron/compute-cohorts:50-101` loads all `message_events` into memory → fails on large communities
- Salt is immutable post-install (no rotation path if leaked)
- Share token regeneration action exists but UI doesn't warn that old tokens invalidate
- `revoke_community` is hard cascade-delete with no audit trail, soft-delete, or undo

### Layer 2 — Identity & Access (cross-cutting)

#### M3. Identity

| | |
|---|---|
| Purpose | Single auth state machine for all human users + middleware gate + RLS scaffolding |
| Identity sources | Email/password · Google OAuth · Magic link (`/admin/login` only) · ~~Slack OAuth is *not* user identity~~ |
| State machine | `auth.users` INSERT → trigger `handle_new_user` (`003_user_profiles_with_approval.sql:25`) → `user_profiles {status: pending, is_admin: false}` → admin `setMemberStatus` → `{approved}` → optional `promote-admin` → `is_admin: true` |
| Edge gate | `src/middleware.ts:30-65` — matches `/dashboard/*`, `/admin/*`, `/opportunities/*`, `/opp/*` |
| Per-request cost | `supabase.auth.getUser()` + `user_profiles.select(status, is_admin)` — **two DB hits per authed navigation** |
| Authz helper | `is_admin()` SECURITY DEFINER function (`003:47-58`) reads `user_profiles` again — used by RLS policies |
| Supabase clients | `server.ts` (RSC, anon) · `client.ts` (browser, anon) · `admin.ts` (service role, bypasses RLS) · `middleware.ts` (edge SSR) |
| Rate limit | `lib/rate-limit.ts` in-memory IP map — applied to `/api/slack/install` only |

**Smells**
- 2 DB hits per request in middleware + a third via `is_admin()` in RLS = up to 3 reads of `user_profiles` for one page render
- `notifications.ts` not wired to signup events — admins must manually check the queue
- Backfill in migration `003:88-91` auto-approves all pre-migration users — one-time hack, not sustainable
- In-memory rate limiter won't survive multi-instance scaling (will need Redis/Upstash before Phase 2 has any volume)
- `is_admin` is a boolean flag; no role tiers. Adding "Fishburners ops vs super-admin" later will need a schema change
- Defensive re-check of admin status inside `src/app/admin/members/actions.ts:23-32` duplicates what middleware already guaranteed

### Layer 3 — Read Surfaces (user-facing)

#### M4. Funding Radar UI

| | |
|---|---|
| Routes | `/opportunities`, `/opp/[slug]` |
| Reads | `opportunities` table via `server.ts` client |
| Key components | `opportunity-table.tsx` (TanStack Table), `filter-sidebar.tsx`, `columns.tsx` |
| Filter pattern | URL search params (shareable, SSR-compatible, no client state lib) — **clean** |
| Access tier | Currently gated (auth + approved) — contradicts the public-read RLS on the underlying table |

#### M5. Community Dashboard UI

| | |
|---|---|
| Routes | `/dashboard`, `/dashboard/[communityId]`, `/dashboard/[communityId]/settings`, `/dashboard/share/[shareToken]` |
| Reads | `message_events`, `channels`, `cohort_snapshots`, `communities` |
| Query layer | `src/lib/dashboard-queries.ts` (de-facto Phase 2 data access, sitting at the same level as `lib/utils.ts`) |
| Charts | 7 components in `src/components/dashboard/*.tsx` — MessageVolume, ChannelBreakdown, TopContributors, NewVsReturning, LurkerRatio, CohortRetention, MetricCard |
| Share path | `/dashboard/share/[shareToken]` uses `admin.ts` (RLS bypass) + `get_shared_dashboard` RPC — only public route in the app using service role |

**Smells**
- `getDashboardMetrics:25-31` pulls every `hashed_user_id` row in range, counts uniques in JS
- `getChannelBreakdown:115-123` loops channels with one `count()` per channel — classic n+1
- `getNewVsReturning:168-199` does `array.includes()` over thousands of rows — quadratic
- All aggregation in JS, none in SQL or a materialized view
- Share view hardcodes `range="30d"` (`/dashboard/share/[shareToken]/page.tsx:33`)
- No `error.tsx` boundaries on share route

#### M6. Admin Console UI

| | |
|---|---|
| Routes | `/admin`, `/admin/members`, `/admin/login` |
| Reads | `user_profiles` (RLS via `is_admin()`), `auth.users` (via `admin.auth.listUsers`) |
| Writes | `user_profiles.status`, `user_profiles.is_admin`, `approved_at`, `approved_by` |
| Workflow | Pending queue → Approve / Reject → optional Promote to admin → Revoke admin / Reinstate rejected |
| Separate `/admin/login` | Intentional UX — dark theme, distinct messaging, friction-by-design |

#### M7. Public Marketing UI

| | |
|---|---|
| Routes | `/`, `/privacy`, `/auth/{login,signup,pending,callback,signout}` |
| Reads | `opportunities.count` only (for landing social proof) |
| Smell | Privacy copy duplicated between `/` and `/dashboard/[communityId]/settings` — no single source |

### Layer 4 — Shared Infrastructure

#### M8. Schemas & Types

- `src/lib/schemas.ts` — Zod schema, canonical TS source
- `scrapers/shared/models.py` — Pydantic mirror, **hand-maintained**
- No codegen, no contract test → drift is inevitable

#### M9. Operational Plumbing

- `lib/rate-limit.ts` — in-memory IP map (won't survive multi-instance)
- `lib/notifications.ts` — Vercel logs + optional webhook (wired to cron failures only, not signup events)
- `lib/utils.ts`, `lib/types.ts`, `lib/constants.ts`
- DB-level RPCs: `store_integration`, `get_decrypted_token`, `get_shared_dashboard`, `revoke_community`, `is_admin`, `handle_new_user`

---

## Where Modularity Is Actually Broken

### B1. Private auth wrapping public data

Phase 1 was originally designed as a public product. The invite-only retrofit (PR #5) shoved `/opportunities` and `/opp/*` behind middleware auth — but the `opportunities` table still has `Allow public read access` RLS (`001_create_opportunities.sql:50-55`). The auth wrapper and the schema disagree about who the audience is.

**Implication**: Either the radar becomes a true members product (needs audience model in the schema — at minimum a `visibility` enum, possibly per-user saved/recommended joins) or the gate gets removed and the dashboard alone stays private. Cannot stay in current contradiction.

### B2. Identity layer makes 2-3 DB round-trips per authed request

`src/middleware.ts:36-52` runs on every `/dashboard`, `/admin`, `/opportunities`, `/opp` navigation:
1. `supabase.auth.getUser()` — verifies session
2. `supabase.from('user_profiles').select('status, is_admin').eq('user_id', user.id)` — checks approval + role
3. Any subsequent RLS-gated query that uses `is_admin()` re-reads `user_profiles`

**Implication**: This is fine at 10 users. At 1000 it's a latency cliff (Vercel edge middleware has a small CPU/network budget). Belongs in a JWT custom claim (`status`, `is_admin`) set at approval time, with cache-control on the session.

### B3. M5 (Dashboard UI) has no service / domain layer

`src/lib/dashboard-queries.ts` sits at the same directory level as `lib/utils.ts`. There's no `src/lib/phase2/`, no `src/domains/community-analytics/`, no boundary between "Phase 2 data access" and "shared helpers." When Phase 3 adds `founder_recommendations`, `saved_opportunities`, and embeddings, those queries will land at the same level. The lib folder becomes a junk drawer.

**Implication**: Need explicit domain folders before more code lands.

### B4. M8 (Schemas) drifts because the Python mirror is hand-maintained

The Zod schema (`src/lib/schemas.ts`) is the canonical TS shape. The Pydantic mirror (`scrapers/shared/models.py`) is kept in sync by hand. There's no test that asserts they match. When Workstream A.1 adds AI-generated `ai_summary` JSON, both will need editing — and the first time someone forgets, the scraper will write rows the app can't render.

**Implication**: Either codegen from a JSON Schema bridge (Zod → JSON Schema → datamodel-code-generator → Pydantic) or a contract test in CI. The hand-mirror is a time bomb.

### B5. Slack-as-integration is filed under `/api/slack/*`

`/api/slack/install` and `/api/slack/callback` sound like OAuth login routes. They are not — they connect a community workspace for metadata ingest. The Slack identity is never used to authenticate a Hearth user. A future reader (or you in three months) will read this as auth.

**Implication**: Naming should reflect "integration", not "auth". When Discord / Circle / Mighty Networks integrations land, they need a parallel path. Belongs under `/api/integrations/slack/*` (or `/integrations/slack` as a server route + a generic integration model in the DB).

---

## What's Missing Entirely (Planned, Unbuilt)

| Item | Where it'd live | Status |
|---|---|---|
| Founder vs community-manager role split | `user_profiles.role` enum + migration 006 | Not started; blocks Phase 3 |
| AI scraper tagger (Claude Haiku) | `scrapers/shared/ai_tagger.py` + flag in `db.py` | `ANTHROPIC_API_KEY` loaded, no code |
| AI grant summaries | `opportunities.ai_summary jsonb` + migration 004 | Not started |
| Semantic search | `opportunities.embedding vector(1536)` + pgvector + ivfflat + `/api/search` | Not started |
| Founder recommendations | `founder_recommendations` table + daily cron | Not started |
| Saved opportunities / application tracker | `saved_opportunities` + `application_checklist` + deadline reminder cron | Not started |
| Audit log | new `audit_events` table; should capture admin actions, integration installs, share-token regenerations | Not started — no current audit trail anywhere |
| Email layer | `lib/email.ts` + Resend templates | `RESEND_*` env vars planned, no code |

---

## Diagnosis — why this happened

The product direction changed mid-flight three times:

1. **Originally**: public funding directory (Phase 1) for women founders
2. **Then**: community manager analytics (Phase 2) bolted on as a separate product under the same domain
3. **Then**: invite-only retrofit (PR #5) to make it feel less public while Fishburners decides on the rollout strategy
4. **Coming**: Phase 3 founder personalization, AI layer, application tracking

Each pivot bolted on instead of rethinking the foundation. Identity (M3) absorbed the shock each time — first adding `user_profiles`, then adding admin promotion, then adding magic-link admin entry, then admins gating Phase 1 routes that were never designed to be gated.

The nav restructure (8-day-old pending plan) is the visible symptom. The real issue is that three products share one identity layer and one routing tree without ever defining the contract between them.

---

## Open Product Questions Blocking Redesign

Before drawing target boundaries, these need answers:

1. **What is Hearth, in one sentence, today?** Pick one:
   - (a) Ascent-internal infrastructure — invitation-only tool for Fishburners cohorts
   - (b) Public funding directory with optional community analytics for women-founder Slacks
   - (c) Members-only platform for women founders (directory + dashboard + future founder features)
   - (d) Two separate products under the Hearth umbrella that should eventually split repos

2. **Refactor scope**:
   - (a) Clean up today's seams only — no new feature work
   - (b) Restructure to absorb Phase 3 (founder identity, recommendations, application tracker) without further patching
   - (c) Restructure to absorb Phase 3 + AI layer (Workstream A) cleanly

3. **The "private auth on public data" contradiction (B1)**:
   - (a) Make radar truly private — add audience model to schema, drop public RLS
   - (b) Revert radar to public — keep gate only on `/dashboard` and `/admin`
   - (c) Tiered access — public preview (count + a few teasers), full list behind login

These three answers determine 80% of the target shape. Everything else (data model, query layer, integrations naming, AI layer placement) follows from them.
