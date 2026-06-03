# Database

Hearth's data layer is PostgreSQL on Supabase, secured Row-Level-Security-first with `pgcrypto` for token encryption and HMAC-hashed user identities, defined entirely through numbered SQL migrations in `supabase/migrations/`.

Related docs: [architecture](./architecture.md) · [setup](./setup.md) · [community-dashboard](./community-dashboard.md) · [auth-and-access](./auth-and-access.md) · [data-pipeline](./data-pipeline.md) · [api-and-actions](./api-and-actions.md) · [frontend](./frontend.md) · [deployment](./deployment.md) · [contributing](./contributing.md) · root [CLAUDE.md](../CLAUDE.md)

---

## 1. Overview

- **Engine:** PostgreSQL managed by Supabase (Postgres + Auth + RLS in one).
- **RLS-first:** Every application table has `ROW LEVEL SECURITY` enabled. The browser uses the anon/authenticated key and is fully constrained by policies; only the `service_role` key (server-side, never shipped to the client) bypasses RLS. Public data flows through narrow `SECURITY DEFINER` RPCs rather than open table grants — see §5.
- **Encryption:** The `pgcrypto` extension (`CREATE EXTENSION IF NOT EXISTS pgcrypto`, declared in both `supabase/migrations/001_create_opportunities.sql` and `supabase/migrations/002_phase2_community_dashboard.sql`) provides `gen_random_uuid()`, `gen_random_bytes()` (per-community salts), and `pgp_sym_encrypt`/`pgp_sym_decrypt` for OAuth token encryption at rest.
- **Two product domains:**
  - *Funding Radar* — the public `opportunities` table (`001`, `004`).
  - *Community Dashboard* — multi-tenant Slack analytics (`002`) plus invite-only access control (`003`, `005`).
- **`moddatetime`** extension (`002`) backs the `updated_at` auto-touch trigger on `communities`.

The RLS guarantees are exercised by `scripts/test-rls.ts` (`npm run db:test-rls`).

---

## 2. Per-table reference

All column/type/index facts below are taken directly from the migration SQL. Tables created in `002`, `003` are in the `public` schema (explicit `public.` prefix); `opportunities` (`001`) is created unqualified (default `public`).

### opportunities

Public, read-only directory of funding opportunities. Defined in `supabase/migrations/001_create_opportunities.sql`; extended in `supabase/migrations/004_tagger_extended_fields.sql`.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` | PK, `DEFAULT gen_random_uuid()` |
| `name` | `TEXT` | `NOT NULL` |
| `organisation` | `TEXT` | nullable |
| `slug` | `TEXT` | `UNIQUE NOT NULL`; URL key for `opp/[slug]` |
| `type` | `opportunity_type` | `NOT NULL DEFAULT 'other'` — enum (see below) |
| `description` | `TEXT` | nullable |
| `eligibility_summary` | `TEXT` | nullable |
| `stage` | `TEXT[]` | `NOT NULL DEFAULT '{}'`; GIN-indexed |
| `industry` | `TEXT[]` | `NOT NULL DEFAULT '{}'`; GIN-indexed |
| `geo` | `TEXT[]` | `NOT NULL DEFAULT '{}'`; GIN-indexed |
| `amount_min` | `INTEGER` | nullable |
| `amount_max` | `INTEGER` | nullable |
| `currency` | `TEXT` | `NOT NULL DEFAULT 'AUD'` |
| `deadline` | `DATE` | nullable; indexed `ASC NULLS LAST` |
| `application_url` | `TEXT` | nullable |
| `source_url` | `TEXT` | `NOT NULL` |
| `women_focused` | `BOOLEAN` | `NOT NULL DEFAULT TRUE` |
| `content_hash` | `TEXT` | nullable; scraper change-detection |
| `first_seen_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` |
| `last_checked_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` |
| `is_active` | `BOOLEAN` | `NOT NULL DEFAULT TRUE`; indexed |
| `equity_free` | `BOOLEAN` | `NOT NULL DEFAULT TRUE` (added `004`); partial index |
| `support_types` | `TEXT[]` | `NOT NULL DEFAULT '{funding}'` (added `004`) |
| `impact_focus` | `BOOLEAN` | `NOT NULL DEFAULT FALSE` (added `004`); partial index |
| `revenue_required` | `BOOLEAN` | nullable (added `004`) |
| `application_cycle` | `TEXT` | `NOT NULL DEFAULT 'ongoing'` (added `004`) |

**Enum `opportunity_type`** (`001`): `'grant'`, `'accelerator'`, `'pitch_competition'`, `'fund'`, `'fellowship'`, `'other'`.

**Indexes:**
- `idx_opportunities_deadline` on `(deadline ASC NULLS LAST)`
- `idx_opportunities_is_active` on `(is_active)`
- `idx_opportunities_slug` on `(slug)`
- `idx_opportunities_stage` — GIN on `stage`
- `idx_opportunities_industry` — GIN on `industry`
- `idx_opportunities_geo` — GIN on `geo`
- `idx_opportunities_equity_free` — partial, `WHERE equity_free = TRUE` (`004`)
- `idx_opportunities_impact` — partial on `impact_focus`, `WHERE impact_focus = TRUE` (`004`)

**Relationships:** none (standalone reference table).

### communities

Top-level tenant for the Community Dashboard; one row per connected Slack workspace. `supabase/migrations/002_phase2_community_dashboard.sql`.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` | PK, `DEFAULT gen_random_uuid()` |
| `name` | `TEXT` | `NOT NULL` |
| `platform` | `TEXT` | `NOT NULL DEFAULT 'slack'`, `CHECK (platform IN ('slack'))` |
| `owner_user_id` | `UUID` | `NOT NULL` → `auth.users(id)` `ON DELETE CASCADE`; drives all ownership RLS |
| `slack_team_id` | `TEXT` | `UNIQUE` (nullable) |
| `salt` | `TEXT` | `NOT NULL DEFAULT encode(extensions.gen_random_bytes(32), 'hex')` — **per-community HMAC salt** (see §4) |
| `share_token` | `UUID` | `DEFAULT gen_random_uuid()`; opaque key for public dashboard share links (see §5) |
| `status` | `TEXT` | `NOT NULL DEFAULT 'active'`, `CHECK (status IN ('active','paused','revoked'))` |
| `installed_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()`; auto-touched by trigger |

**Trigger:** `communities_updated_at` — `BEFORE UPDATE ... EXECUTE FUNCTION extensions.moddatetime(updated_at)`.

**Relationships:** parent of `integrations`, `channels`, `message_events`, `cohort_snapshots`, `ingest_log` (all cascade-delete on community removal).

> Note: `communities` declares no secondary index on `share_token`; lookups rely on the primary key and the `UNIQUE(slack_team_id)` constraint.

### integrations

Encrypted Slack OAuth credentials per community. `supabase/migrations/002_phase2_community_dashboard.sql`.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` | PK, `DEFAULT gen_random_uuid()` |
| `community_id` | `UUID` | `NOT NULL` → `communities(id)` `ON DELETE CASCADE` |
| `platform` | `TEXT` | `NOT NULL DEFAULT 'slack'` |
| `encrypted_access_token` | `BYTEA` | `NOT NULL` — `pgp_sym_encrypt` ciphertext (see §4) |
| `encrypted_refresh_token` | `BYTEA` | nullable ciphertext |
| `scopes` | `TEXT[]` | `NOT NULL DEFAULT '{}'` |
| `slack_team_id` | `TEXT` | nullable |
| `slack_team_name` | `TEXT` | nullable |
| `installed_by` | `UUID` | `NOT NULL` → `auth.users(id)` |
| `installed_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` |
| `last_used_at` | `TIMESTAMPTZ` | nullable |

**Constraints:** `UNIQUE(community_id, platform)` — drives the `ON CONFLICT` upsert in `store_integration`.

### channels

Slack channels discovered per community, with per-channel opt-in. `supabase/migrations/002_phase2_community_dashboard.sql`.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` | PK, `DEFAULT gen_random_uuid()` |
| `community_id` | `UUID` | `NOT NULL` → `communities(id)` `ON DELETE CASCADE` |
| `platform_channel_id` | `TEXT` | `NOT NULL` (Slack channel ID) |
| `name` | `TEXT` | `NOT NULL` |
| `is_private` | `BOOLEAN` | `NOT NULL DEFAULT false` |
| `opted_in` | `BOOLEAN` | `NOT NULL DEFAULT false` — **ingest is OFF by default** |
| `member_count` | `INTEGER` | nullable; used for lurker-ratio metric |
| `synced_at` | `TIMESTAMPTZ` | nullable |

**Constraints:** `UNIQUE(community_id, platform_channel_id)`.

**Usage:** `src/lib/dashboard-queries.ts` reads `channels` filtered on `opted_in = true` for channel breakdown and lurker-ratio queries.

### message_events

Metadata-only record of Slack activity — **no message text is ever stored.** `supabase/migrations/002_phase2_community_dashboard.sql`.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` | PK, `DEFAULT gen_random_uuid()` |
| `community_id` | `UUID` | `NOT NULL` → `communities(id)` `ON DELETE CASCADE` |
| `channel_id` | `UUID` | `NOT NULL` → `channels(id)` `ON DELETE CASCADE` |
| `hashed_user_id` | `TEXT` | `NOT NULL` — **HMAC-SHA256 of the Slack user ID** (see §4); never the raw ID |
| `ts` | `TIMESTAMPTZ` | `NOT NULL` — message timestamp (UTC) |
| `msg_length` | `INTEGER` | `NOT NULL DEFAULT 0` — length only, not content |
| `has_thread` | `BOOLEAN` | `NOT NULL DEFAULT false` |
| `has_reaction` | `BOOLEAN` | `NOT NULL DEFAULT false` |
| `ingested_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` |

**Indexes:**
- `idx_message_events_community_ts` on `(community_id, ts DESC)`
- `idx_message_events_channel_ts` on `(channel_id, ts DESC)`
- `idx_message_events_hashed_user` on `(community_id, hashed_user_id)`
- `idx_message_events_dedup` — **UNIQUE** on `(community_id, channel_id, hashed_user_id, ts)` (idempotent ingest)

**Usage:** the dashboard metric helpers in `src/lib/dashboard-queries.ts` (`getDashboardMetrics`, `getMessageVolume`, `getChannelBreakdown`, `getTopContributors`, `getNewVsReturning`, `getLurkerRatio`) all query this table, deriving unique-user counts by de-duplicating `hashed_user_id` client-side.

### cohort_snapshots

Pre-computed weekly retention cohorts. `supabase/migrations/002_phase2_community_dashboard.sql`.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` | PK, `DEFAULT gen_random_uuid()` |
| `community_id` | `UUID` | `NOT NULL` → `communities(id)` `ON DELETE CASCADE` |
| `week_start` | `DATE` | `NOT NULL` — the observation week |
| `cohort_week` | `DATE` | `NOT NULL` — the week the cohort first appeared |
| `retained_count` | `INTEGER` | `NOT NULL DEFAULT 0` |
| `total_in_cohort` | `INTEGER` | `NOT NULL DEFAULT 0` |
| `computed_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` |

**Constraints:** `UNIQUE(community_id, week_start, cohort_week)`.

**Usage:** `getCohortRetention` in `src/lib/dashboard-queries.ts`, ordered by `cohort_week` then `week_start`.

### ingest_log

Audit/operational log of ingest runs. `supabase/migrations/002_phase2_community_dashboard.sql`.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` | PK, `DEFAULT gen_random_uuid()` |
| `community_id` | `UUID` | `NOT NULL` → `communities(id)` `ON DELETE CASCADE` |
| `started_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` |
| `finished_at` | `TIMESTAMPTZ` | nullable |
| `channels_processed` | `INTEGER` | `DEFAULT 0` |
| `messages_ingested` | `INTEGER` | `DEFAULT 0` |
| `status` | `TEXT` | `NOT NULL DEFAULT 'running'`, `CHECK (status IN ('running','success','error'))` |
| `error_message` | `TEXT` | nullable |

### user_profiles

Invite-only access control: every `auth.users` row gets a profile, defaulting to `pending` until an admin approves. `supabase/migrations/003_user_profiles_with_approval.sql` (RLS hardened in the two `005` migrations).

| Column | Type | Notes |
|---|---|---|
| `user_id` | `UUID` | **PK** → `auth.users(id)` `ON DELETE CASCADE` |
| `status` | `TEXT` | `NOT NULL DEFAULT 'pending'`, `CHECK (status IN ('pending','approved','rejected'))` |
| `is_admin` | `BOOLEAN` | `NOT NULL DEFAULT false` |
| `display_name` | `TEXT` | nullable — the only field a non-admin may edit (see §3) |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` |
| `approved_at` | `TIMESTAMPTZ` | nullable |
| `approved_by` | `UUID` | nullable → `auth.users(id)` |

**Index:** `idx_user_profiles_status` on `(status)`.

**Trigger `on_auth_user_created`** — `AFTER INSERT ON auth.users` runs `public.handle_new_user()` (`SECURITY DEFINER`, `SET search_path = public`), inserting a `('pending', is_admin=false)` profile (`ON CONFLICT (user_id) DO NOTHING`).

**Backfill (`003`):** all pre-existing `auth.users` are inserted as `'approved'` so demo-seed / existing accounts keep working; pending status applies only to post-migration signups.

**Helper `public.is_admin()`** — `SECURITY DEFINER`, `STABLE`, `SET search_path = public`. Returns the caller's `is_admin` flag (or `false`), and is `GRANT EXECUTE ... TO authenticated`. Used inside RLS policies so the admin check itself bypasses RLS recursion.

**Column-immutability triggers (`005`):** two `BEFORE UPDATE` triggers lock privileged columns for non-admins — see §3 for the collision detail.

---

## 3. Row-Level Security

RLS is enabled on **every** application table. The `service_role` key bypasses RLS entirely and is used by server actions, ingest, seed, and admin scripts. The anon/authenticated browser client is bound by the policies below.

> A table with RLS enabled and **no** matching policy denies all access to non-`service_role` callers. `opportunities` is the only table with a public-read policy; all dashboard tables are owner-scoped, which is exactly what `scripts/test-rls.ts` verifies (anon sees 0 rows everywhere except `opportunities`).

### opportunities (`001`)

| Policy | Cmd | Predicate | Intent |
|---|---|---|---|
| `Allow public read access` | SELECT | `USING (true)` | Anyone (incl. anon) may read the directory. No INSERT/UPDATE/DELETE policy exists — writes only via `service_role` (scrapers). |

### communities (`002`) — owner CRUD

All four policies key off `owner_user_id = (SELECT auth.uid())`.

| Policy | Cmd | Predicate |
|---|---|---|
| `communities_owner_select` | SELECT | `USING (owner_user_id = (SELECT auth.uid()))` |
| `communities_owner_insert` | INSERT | `WITH CHECK (owner_user_id = (SELECT auth.uid()))` |
| `communities_owner_update` | UPDATE | `USING (owner_user_id = (SELECT auth.uid()))` |
| `communities_owner_delete` | DELETE | `USING (owner_user_id = (SELECT auth.uid()))` |

> Note: `communities_owner_update` has no explicit `WITH CHECK`; Postgres falls back to the `USING` predicate for the post-update row, so an owner cannot reassign a community to another user via the authenticated client.

### integrations / channels / message_events / cohort_snapshots / ingest_log (`002`)

These are gated **transitively** by community ownership via a subquery: `community_id IN (SELECT id FROM public.communities WHERE owner_user_id = (SELECT auth.uid()))`.

| Table | Policy | Cmd |
|---|---|---|
| `integrations` | `integrations_owner_select` | SELECT |
| `integrations` | `integrations_owner_insert` | INSERT (`WITH CHECK`) |
| `integrations` | `integrations_owner_delete` | DELETE |
| `channels` | `channels_owner_select` | SELECT |
| `channels` | `channels_owner_update` | UPDATE |
| `message_events` | `message_events_owner_select` | SELECT (read-only) |
| `cohort_snapshots` | `cohort_snapshots_owner_select` | SELECT (read-only) |
| `ingest_log` | `ingest_log_owner_select` | SELECT (read-only) |

Notable gaps (intentional — writes happen via `service_role` during ingest, not from the browser):
- `integrations` has **no UPDATE** policy (token refresh runs through `store_integration` RPC / `service_role`).
- `channels` has **no INSERT/DELETE** policy (channel discovery is server-side); owners may only toggle `opted_in` via UPDATE.
- `message_events`, `cohort_snapshots`, `ingest_log` are **SELECT-only** for owners; all writes are `service_role`.

### user_profiles (`003`, hardened in `005`)

This is the most security-sensitive table — it gates the whole app via `status`/`is_admin`. Base policies from `003`:

| Policy | Cmd | Predicate | Intent |
|---|---|---|---|
| `user_profiles_self_select` | SELECT | `USING (user_id = (SELECT auth.uid()))` | Users read their own profile. |
| `user_profiles_admin_select` | SELECT | `USING ((SELECT public.is_admin()))` | Admins read all profiles. |
| `user_profiles_admin_update` | UPDATE | `USING ((SELECT public.is_admin()))` | Admins update any profile. **`003` had no `WITH CHECK` — the P0 fixed by `005`.** |

Hardening added by the `005` migrations (issue #17):

| Policy / object | Cmd | Predicate / behaviour |
|---|---|---|
| `user_profiles_admin_update` (replaced) | UPDATE | `USING ((SELECT public.is_admin()))` **`WITH CHECK ((SELECT public.is_admin()))`** — closes the missing-`WITH CHECK` hole. |
| `user_profiles_self_update` (added) | UPDATE | `USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()))` — a user may update their own **row**; column-level limits enforced by trigger. |
| immutability trigger (added) | BEFORE UPDATE | For non-admin, non-`service_role` callers, locks privileged columns. |

**Intent of the column-immutability trigger:** RLS only checks *row* ownership, so a self-update policy alone would let a `pending` user flip their own `status` to `approved` or set `is_admin = true`. The trigger closes that escalation. `scripts/test-rls.ts` Test 8 verifies exactly this: a non-admin cannot self-promote `is_admin`, cannot change their own `status`, **can** change their own `display_name`, cannot touch another user's row (RLS, 0 rows), and `service_role` can still flip `is_admin`.

> **Gotcha — duplicate/competing trigger definitions (the 005 collision):** both `005` files install a `BEFORE UPDATE` immutability trigger, but they are *not* the same object:
> - `005_fix_user_profiles_rls.sql` → function `public.enforce_profile_immutable_columns()` + trigger `trg_enforce_profile_immutable_columns`. It **silently coerces** privileged columns back to `OLD` values (`NEW.is_admin := OLD.is_admin`, etc.) and always pins `user_id`.
> - `005_user_profiles_rls_hardening.sql` → function `public.enforce_user_profile_immutable()` + trigger `enforce_user_profile_immutable_trigger`. It **raises an exception** on any privileged-column change, short-circuits for `service_role` (via `auth.role()`, deliberately *not* `current_user`) and admins, and additionally locks `created_at`.
>
> Because the trigger names differ, applying both leaves **two** `BEFORE UPDATE` triggers on `user_profiles`. They are individually correct and compatible (raise wins over silent coercion), but the redundancy is a maintenance hazard — see §6.

---

## 4. Privacy & encryption model

Hearth's privacy posture (see also root [CLAUDE.md](../CLAUDE.md) and [community-dashboard](./community-dashboard.md)): **no message text is stored**, user IDs are HMAC-hashed, OAuth tokens are encrypted at rest.

### HMAC-SHA256 user-ID hashing (per-community salt)

- The `communities.salt` column is generated server-side per community: `DEFAULT encode(extensions.gen_random_bytes(32), 'hex')` (32 random bytes, hex-encoded) — `supabase/migrations/002_phase2_community_dashboard.sql`.
- Slack user IDs are HMAC-SHA256 hashed with that salt before storage; only the digest lands in `message_events.hashed_user_id` (`TEXT NOT NULL`). A per-community salt means the same Slack user produces a different hash in different communities, preventing cross-tenant correlation.
- The dashboard never reverses the hash: `getTopContributors` in `src/lib/dashboard-queries.ts` labels contributors `Contributor #N` and shows only `hash.slice(0, 8)` as a `hashPreview`.

> Note: the SQL stores `hashed_user_id`, but the HMAC-SHA256 hashing (per-community salt) is done in application code — `hmacUserId` in `src/lib/slack.ts`, called during Slack ingest — not in these migrations. See [community-dashboard](./community-dashboard.md).

### pgcrypto token encryption (`TOKEN_ENCRYPTION_KEY`)

OAuth tokens are never stored in plaintext. In `supabase/migrations/002_phase2_community_dashboard.sql`:

- **Storage** — `store_integration(...)` (`SECURITY DEFINER`) writes ciphertext via `pgp_sym_encrypt(p_access_token, v_key)` into `integrations.encrypted_access_token` (`BYTEA`), and conditionally encrypts the refresh token. It upserts on `UNIQUE(community_id, platform)`.
- **Retrieval** — `get_decrypted_token(p_community_id, p_encryption_key)` (`SECURITY DEFINER`) returns the plaintext via `pgp_sym_decrypt(...)`. Intended for `service_role` only (no table grant exposes the ciphertext to the browser, and `integrations` SELECT is owner-gated and returns only `BYTEA`).
- **Key handling** — the symmetric key is resolved as `COALESCE(p_encryption_key, current_setting('app.settings.token_encryption_key', true))`. The env var is named **`TOKEN_ENCRYPTION_KEY`** (value redacted; documented by name only) and is either passed explicitly by the caller or read from the Postgres GUC `app.settings.token_encryption_key`.

> Note: the migrations do not set the `app.settings.token_encryption_key` GUC; the app passes the key as `p_encryption_key` (from the `TOKEN_ENCRYPTION_KEY` env var) when calling `store_integration` / `get_decrypted_token`, with `current_setting(...)` as a fallback. See [api-and-actions](./api-and-actions.md).

---

## 5. SECURITY DEFINER RPCs

Defined in `supabase/migrations/002_phase2_community_dashboard.sql` (plus `is_admin` / `handle_new_user` in `003`, covered in §2). All run with the privileges of the function owner, so they can read past RLS in a controlled, narrow way.

| Function | Returns | Purpose / exposure |
|---|---|---|
| `get_shared_dashboard(p_share_token UUID)` | `TABLE(community_id UUID, community_name TEXT)` | **Public dashboard share links.** Resolves a `share_token` to a community **only when `status = 'active'`** and returns just the id + name — never tokens, salts, or message data. This is the single entry point for the public `dashboard/share/[shareToken]` route; the browser never queries `communities` directly. Paused/revoked communities return no row, instantly killing a shared link. |
| `store_integration(...)` | `UUID` | Encrypts + upserts an OAuth integration (see §4). |
| `get_decrypted_token(p_community_id, p_encryption_key)` | `TABLE(access_token TEXT, refresh_token TEXT)` | Decrypts stored tokens (see §4); `service_role` use only. |
| `revoke_community(p_community_id UUID)` | `BOOLEAN` | Deletes the community; FK `ON DELETE CASCADE` removes integrations, channels, message_events, cohort_snapshots, ingest_log. Returns whether a row was deleted. |

> Caveat: the migrations declare **no explicit `GRANT EXECUTE`** for `get_shared_dashboard`, `store_integration`, `get_decrypted_token`, or `revoke_community` (only `is_admin()` is granted to `authenticated`, in `003`). Effective `EXECUTE` privileges therefore depend on Supabase's default role config — confirm in the live DB that `get_shared_dashboard` is callable by `anon`/`authenticated` (required for public sharing) and that the other three remain restricted to `service_role`. (Tracked in issue #63 / PR #116.)

---

## 6. Migration conventions

- **Location & naming:** SQL lives in `supabase/migrations/`, numbered `NNN_name.sql` (e.g. `supabase/migrations/002_phase2_community_dashboard.sql`).
- **Application:** run manually in the **Supabase Dashboard SQL Editor** (the file headers say so, e.g. `005_user_profiles_rls_hardening.sql` notes "Run this in the Supabase Dashboard SQL Editor against hearth-prod"). There is no automated migration runner in this repo. See [setup](./setup.md) and [deployment](./deployment.md).
- **Security-critical changes:** any change to migrations, RLS, auth, or ingest must be followed by `npm run db:test-rls` (`scripts/test-rls.ts`). This is also a CI gate (root [CLAUDE.md](../CLAUDE.md)).

### Gotcha — duplicate `005` numbering

There are **two** migrations numbered `005`:

| File | Issue ref | What it does |
|---|---|---|
| `supabase/migrations/005_fix_user_profiles_rls.sql` | "Fix P0 #17" | Adds `WITH CHECK` to admin update, adds self-update policy, installs the **silent-coercion** trigger `trg_enforce_profile_immutable_columns`. |
| `supabase/migrations/005_user_profiles_rls_hardening.sql` | "closes #17" | Same policy intent, but installs the **raise-on-change** trigger `enforce_user_profile_immutable_trigger` (also locks `created_at`, short-circuits `service_role`). |

Both target issue #17 and overlap heavily (both DROP/recreate `user_profiles_admin_update` and `user_profiles_self_update`). The DDL is idempotent enough to apply in sequence — the last-applied policy definition wins, and the two distinctly-named triggers coexist — but:

- The shared `005` prefix means **ordering between the two is undefined by filename alone**; apply `005_fix_user_profiles_rls.sql` *before* `005_user_profiles_rls_hardening.sql` to match the intended end state (hardening on top of fix).
- Two immutability triggers fire on every `user_profiles` UPDATE. Consider consolidating to one numbered migration / one trigger to remove the ambiguity.

### Rollback (`*.down.sql`)

Every migration ships a paired `*.down.sql` with real reversal SQL:

- `001_create_opportunities.down.sql` — `DROP TABLE opportunities CASCADE` + `DROP TYPE opportunity_type` (leaves `pgcrypto`).
- `002_phase2_community_dashboard.down.sql` — drops the four RPCs, the `communities_updated_at` trigger, and all six tables `CASCADE`.
- `003_user_profiles_with_approval.down.sql` — drops the `on_auth_user_created` trigger, `handle_new_user()`, `is_admin()`, and `user_profiles CASCADE`.
- `004_tagger_extended_fields.down.sql` — drops the two partial indexes and the five added columns.
- `005_fix_user_profiles_rls.down.sql` — drops the coercion trigger/function and self-update policy, restoring the original (no-`WITH CHECK`) admin policy.
- `005_user_profiles_rls_hardening.down.sql` — drops the raise trigger/function only (leaving the `WITH CHECK` policies from the fix migration).

Roll back in the reverse of the apply order. Because the two `005` files share a prefix (so order isn't encoded by filename), `005_user_profiles_rls_hardening.down.sql`'s header notes that a full rollback should run `005_fix_user_profiles_rls.down.sql` next.

---

See [auth-and-access](./auth-and-access.md) for how `user_profiles.status`/`is_admin` gate routes in `src/middleware.ts`, [community-dashboard](./community-dashboard.md) for the ingest + metrics flow over these tables, and [api-and-actions](./api-and-actions.md) for the server-side callers of the RPCs above.
