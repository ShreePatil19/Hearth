# Community Dashboard

Privacy-first analytics for Slack communities of women founders: Hearth ingests **metadata only** (never message text), hashes user IDs per-community, and renders engagement charts from aggregated `message_events`.

> Part of the Hearth developer docs. Siblings: [architecture](architecture.md) · [setup](setup.md) · [database](database.md) · **community-dashboard** · [auth-and-access](auth-and-access.md) · [data-pipeline](data-pipeline.md) · [api-and-actions](api-and-actions.md) · [frontend](frontend.md) · [deployment](deployment.md) · [contributing](contributing.md) · root [CLAUDE.md](../CLAUDE.md).

---

## 1. End-to-end data flow

```
 ┌─────────────────┐   OAuth v2    ┌──────────────────────────┐
 │  Community owner │ ────────────▶ │ /api/slack/install        │  CSRF state cookie
 │  (authed user)   │               │ /api/slack/callback       │  exchange code → token
 └─────────────────┘               └────────────┬─────────────┘
                                                 │ store_integration RPC (pgcrypto encrypt)
                                                 │ conversations.list → channels (opted_in = false)
                                                 ▼
                                    ┌──────────────────────────┐
                                    │ communities / integrations │  encrypted token at rest
                                    │ channels (opt-in, OFF)     │
                                    └────────────┬─────────────┘
        Vercel Cron 02:00 UTC                    │
        (Bearer CRON_SECRET)                     ▼
 ┌──────────────────────────┐   conversations.history (metadata)   ┌────────────────────┐
 │ /api/cron/ingest-slack    │ ───────────────────────────────────▶ │ Slack Web API       │
 │  - decrypt token (RPC)    │ ◀─────────────────────────────────── │  (opted-in channels)│
 │  - hash user IDs (HMAC)   │   ts, thread_ts, reactions, len      └────────────────────┘
 │  - upsert message_events  │
 └────────────┬─────────────┘
              │  message_events  (hashed_user_id, ts, msg_length, has_thread, has_reaction)
              ▼
 ┌──────────────────────────┐   compute_cohort_retention RPC  ──┐
 │ /api/cron/compute-cohorts │   (else JS fallback)              │  Vercel Cron 02:30 UTC
 │  → cohort_snapshots        │ ◀────────────────────────────────┘
 └────────────┬─────────────┘
              ▼
 ┌──────────────────────────┐   dashboard-queries.ts (RLS via owner)   ┌──────────────────┐
 │ /dashboard/[communityId]  │ ◀──────────────────────────────────────  │ recharts charts   │
 │ /dashboard/share/[token]  │   get_shared_dashboard RPC (SECURITY     │ + KPI/metric cards│
 │   (public, admin client)  │   DEFINER), then same query fns          └──────────────────┘
 └──────────────────────────┘
```

| Stage | Where | What happens |
|---|---|---|
| Connect Slack | `src/app/api/slack/install/route.ts`, `…/callback/route.ts` | OAuth v2 with CSRF `state` cookie; token exchanged, community created/reactivated, channels synced (default OFF). |
| Store token | `store_integration` RPC (in callback) | Token encrypted at rest via `pgcrypto` using `TOKEN_ENCRYPTION_KEY`. |
| Daily ingest | `src/app/api/cron/ingest-slack/route.ts` | 02:00 UTC. Decrypt token, pull `conversations.history` metadata for opted-in channels, upsert `message_events`. |
| Cohort rollup | `src/app/api/cron/compute-cohorts/route.ts` | 02:30 UTC. RPC `compute_cohort_retention`, else JS fallback → `cohort_snapshots`. |
| Query + render | `src/lib/dashboard-queries.ts`, `src/app/dashboard/**` | Server components fetch metrics in parallel and render charts. |

See [database.md](database.md) for the table/column definitions and RPC contracts referenced below, and [api-and-actions.md](api-and-actions.md) for route/auth details.

---

## 2. Privacy guarantees

These are enforced in code, not just by convention:

| Guarantee | Enforcement (verified) |
|---|---|
| **No message text stored** | `ingest-slack` maps each Slack message to metadata fields only — `hashed_user_id`, `ts`, `msg_length` (`(msg.text \|\| "").length`), `has_thread`, `has_reaction`. The raw `text` is used only to compute a length and is discarded. |
| **HMAC-SHA256 hashed user IDs, per-community salt** | `hmacUserId(userId, salt)` in `src/lib/slack.ts` = `crypto.createHmac("sha256", salt).update(userId).digest("hex")`. The salt is `communities.salt`, loaded per community in the cron. Comment: "Cross-community correlation is impossible by design." |
| **Per-channel opt-in, default OFF** | Channel rows are inserted with `opted_in: false` in `slack/callback/route.ts` ("Default OFF — privacy first"). Ingest filters `.eq("opted_in", true)`; if none are opted in the community is skipped (logged as success). |
| **OAuth tokens encrypted at rest** | Stored via `store_integration` RPC with `p_encryption_key: TOKEN_ENCRYPTION_KEY` (pgcrypto); decrypted only server-side via `get_decrypted_token` RPC inside the cron. |
| **Anonymized UI** | Top Contributors shows `Contributor #N` + an 8-char hash preview (`hash.slice(0, 8)`), never names. The table subtitle states "Anonymized — no real names or identifiers shown". |

> Note: `msg_length` is a per-message integer; no message content is reconstructable from it. The dashboard does not currently surface `msg_length` or `has_reaction` in any chart (ingested but unused — see §7).

Secrets referenced by name only (never log/echo values): `TOKEN_ENCRYPTION_KEY`, `CRON_SECRET`, `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_SIGNING_SECRET`, `ALERT_WEBHOOK_URL`.

---

## 3. The cron jobs

Schedules from `vercel.json`:

| Path | Cron | Time |
|---|---|---|
| `/api/cron/ingest-slack` | `0 2 * * *` | 02:00 UTC daily |
| `/api/cron/compute-cohorts` | `30 2 * * *` | 02:30 UTC daily |

**Auth gate.** Both routes live under `/api/cron/*` and are gated in `src/middleware.ts`: the request must carry `Authorization: Bearer <CRON_SECRET>`, else `401`. If `CRON_SECRET` is unset the gate also fails closed. The route handlers themselves are plain `GET` exports (`export const dynamic = "force-dynamic"; maxDuration = 60`) and do not re-check the secret — the middleware is the single gate. See [auth-and-access.md](auth-and-access.md).

### `ingest-slack`

For each `communities` row with `status = "active"`:

1. Insert an `ingest_log` row with `status: "running"`.
2. Decrypt the Slack token via `get_decrypted_token` RPC (`p_community_id`, `p_encryption_key`). Missing token → throws "No token found".
3. Load opted-in `channels`. None → mark log `success` with `channels_processed: 0` and skip.
4. For each channel, page through `conversations.history` (`oldest` = now − 24h, `limit: 200`, cursor pagination):
   - Keep only real user messages (`msg.user && !msg.subtype`).
   - Map to metadata rows and `upsert` into `message_events` with `onConflict: "community_id,channel_id,hashed_user_id,ts"`, `ignoreDuplicates: true` (dedup).
   - Sleep 1200ms between channels (rate-limit courtesy).
5. Update the `ingest_log` with `success`, `channels_processed`, `messages_ingested`.
6. On per-community error: mark log `error` with `error_message`, push an error result, and call `sendFailureNotification(...)` (failure swallowed with `.catch(() => {})`).

Response body: `{ timestamp, communities_processed, results, status }` where `status` is `"partial_failure"` if any community errored, else `"success"`. Raw Postgres errors are intentionally **not** leaked to the caller — they're logged server-side and a generic body is returned (comment cites issue #71).

Timestamp conversion uses `slackTsToDate` (`src/lib/slack.ts`), which throws on a malformed `ts` so the per-message try/catch can skip it (issue #101).

### `compute-cohorts` — RPC then JS fallback

For each active community:

```ts
let cohortData = null;
try {
  const result = await admin.rpc("compute_cohort_retention" as string, {
    p_community_id: community.id,
  });
  cohortData = result.data;
} catch {
  // RPC doesn't exist — fall through to JS implementation
}

if (!cohortData) {
  // ...JS implementation...
}
```

- **RPC path:** if the Postgres function `compute_cohort_retention(p_community_id)` exists, it runs server-side and is expected to persist/return cohort data. When it returns a value, the JS block is skipped.
- **JS fallback:** if the RPC is absent (or returns null), the route:
  1. Loads all `message_events` (`hashed_user_id, ts`) for the community, ordered by `ts`.
  2. Buckets each event into a week via `getWeekStart` (`src/lib/dates.ts`); records each user's **first** active week (cohort) and the set of weeks they were active.
  3. Builds a retention matrix: for each cohort week, for each subsequent active week, counts how many of the cohort's users were active (`retained_count` / `total_in_cohort`).
  4. `upsert`s `cohort_snapshots` rows (`community_id, week_start, cohort_week, retained_count, total_in_cohort`) with `onConflict: "community_id,week_start,cohort_week"`.

Per-community errors are caught and logged; the route still returns `{ timestamp, communities_processed }`.

> Note: The RPC `compute_cohort_retention` is invoked defensively (cast `as string`, wrapped in try/catch). Whether it is materialized in the live DB is environment-dependent — the JS path is the guaranteed fallback. The `getCohortRetention` query (§4) reads only from `cohort_snapshots`, so both cron paths must ultimately populate that table for the retention chart to render. See [database.md](database.md).

---

## 4. Dashboard query catalog

All functions live in `src/lib/dashboard-queries.ts` and take a `SupabaseClient` as the first arg (the page passes either an RLS-scoped server client or the admin client for shared views). `Range` is `"7d" | "30d" | "90d"`; `getRangeDate` converts it to an ISO cutoff (now − N days).

| Function | Inputs | Returns | Tables / columns read |
|---|---|---|---|
| `getDashboardMetrics` | `(supabase, communityId, range)` | `{ totalMessages, activeUsers, dau, threadPercentage }` | `message_events`: `count`, `hashed_user_id`, `has_thread`, `ts`. DAU uses a **UTC** day boundary (`setUTCHours(0,0,0,0)`) to match stored timestamps (comment cites #79). |
| `getMessageVolume` | `(supabase, communityId, range)` | `{ date, messages }[]`, one entry per day in range (missing days filled with 0) | `message_events`: `ts` (grouped by `YYYY-MM-DD`). |
| `getChannelBreakdown` | `(supabase, communityId, range)` | `{ name, messages }[]` sorted desc; `name` is `#<channel>` | `channels`: `id, name` where `opted_in = true`; then per-channel `count(*)` on `message_events` filtered by `channel_id` + `ts`. |
| `getTopContributors` | `(supabase, communityId, range, limit = 10)` | `{ rank, label, hashPreview, messages }[]` — `label` = `Contributor #N`, `hashPreview` = first 8 chars of hash | `message_events`: `hashed_user_id` (counted in JS). |
| `getNewVsReturning` | `(supabase, communityId, range)` | `{ new, returning }` | `message_events`: `hashed_user_id` queried twice — `ts < since` (prior users) and `ts >= since` (range users); set diff. |
| `getCohortRetention` | `(supabase, communityId)` — no range | `cohort_snapshots` rows (or `[]`) | `cohort_snapshots`: `*`, ordered by `cohort_week`, `week_start`. |
| `getLurkerRatio` | `(supabase, communityId, range)` | `{ totalMembers, activePosters }` | `channels`: `member_count` where `opted_in = true` (summed); `message_events`: distinct `hashed_user_id` in range. |

> Note (perf): `getChannelBreakdown` issues one count query per opted-in channel (N+1); `getTopContributors`, `getNewVsReturning`, `getLurkerRatio`, and the unique-user counts in `getDashboardMetrics` pull all `hashed_user_id` rows for the window and aggregate in JS rather than via SQL `GROUP BY`/`distinct`. Fine at current scale; a candidate for the `compute_cohort_retention`-style RPC treatment if volume grows. The `compute_cohort_retention` SQL RPC and `getCohortRetention` are the only retention-aware reads.

---

## 5. Pages & UI

All dashboard pages are server components. The `/dashboard/*` tree is auth-gated by `src/middleware.ts` (authenticated user **and** `approved` `user_profiles` row); the **share** route is explicitly bypassed (see §5.5).

### 5.1 `dashboard/layout.tsx`

Wraps every `/dashboard/*` page. Re-checks `auth.getUser()` (redirects to `/auth/login` if absent — defense in depth atop middleware), loads the user's `communities` (`owner_user_id = user.id`) for the sidebar (`./_components/dashboard-sidebar`), and renders a responsive shell (desktop `aside`, mobile `Sheet`).

### 5.2 `dashboard/page.tsx` (index)

- Redirects unauthenticated users to `/auth/login`.
- Loads the user's communities (`id, name, platform, status, installed_at`).
- **1 community → redirect** straight to `/dashboard/{id}`.
- **0 communities → onboarding** card with a "Connect Slack" link to `/api/slack/install`.
- **2+ → community picker** cards.
- Renders a destructive `Alert` from `?error=` (e.g. OAuth failures redirected here by the callback).

### 5.3 `dashboard/[communityId]/page.tsx` (main dashboard)

Reads `range` from `searchParams` (defaults `30d`; only `7d`/`90d` override). Loads the community (`notFound()` if missing), then fetches all metrics in parallel via `Promise.all` over the seven query functions and renders:

| Region | Component (`src/components/dashboard/*`) | Source query |
|---|---|---|
| KPI: Total Messages / Active Users (+DAU) / Thread Usage / New vs Returning | `metric-card.tsx` (×4) | `getDashboardMetrics`, `getNewVsReturning` |
| Message Volume (area chart) | `message-volume-chart.tsx` (recharts `AreaChart`) | `getMessageVolume` |
| Channel Breakdown (horizontal bar) | `channel-breakdown-chart.tsx` (recharts `BarChart`) | `getChannelBreakdown` |
| Top Contributors (table) | `top-contributors-table.tsx` | `getTopContributors` |
| New vs Returning (donut) | `new-vs-returning-chart.tsx` (recharts `PieChart`) | `getNewVsReturning` |
| Community Engagement / lurker ratio | `lurker-ratio-card.tsx` | `getLurkerRatio` |
| Cohort Retention (heatmap table) | `cohort-retention-table.tsx` | `getCohortRetention` |

Header has the `time-range-selector.tsx` client component (writes `?range=` and `router.replace`) and a Settings link.

### 5.4 `dashboard/[communityId]/settings/`

- **`page.tsx`** — loads the community and all its `channels` (ordered by `name`). Renders three cards:
  - *Channel Monitoring* → `channel-toggles.tsx` (client) with the `toggleChannel` server action.
  - *Shareable Dashboard* — shows the share URL (`NEXT_PUBLIC_SITE_URL/dashboard/share/{share_token}`) if `community.share_token` is set; forms call `regenerateShareToken` / `disableSharing`.
  - *Danger Zone* — `revokeIntegration` ("delete all data").
- **`channel-toggles.tsx`** — client component. Renders a `Switch` per channel; flipping it builds a `FormData` (`communityId`, `channelId`, `optedIn`) and calls the passed `toggleAction` inside `useTransition`, surfacing any `error`. Shows private badges and `member_count`.
- **`actions.ts`** (`"use server"`) — see [api-and-actions.md](api-and-actions.md). Each action calls `requireOwner(communityId)` (verifies signed-in user owns the community via `communities.owner_user_id`) before mutating:

  | Action | Effect |
  |---|---|
  | `toggleChannel` | `channels.opted_in = optedIn` (scoped to `id` + `community_id`); `revalidatePath` settings. |
  | `regenerateShareToken` | `communities.share_token = crypto.randomUUID()`. |
  | `disableSharing` | `communities.share_token = null`. |
  | `revokeIntegration` | admin client calls `revoke_community` RPC, then `redirect("/dashboard")`. |

  Inputs are parsed/validated via `parseFormUUID` / `parseFormBoolean` (`src/lib/form-data`); failures return an `ActionResult` `{ error }`.

### 5.5 `dashboard/share/[shareToken]/page.tsx` (public)

- **Public — middleware bypass.** `src/middleware.ts` returns `NextResponse.next()` for any path under `/dashboard/share/` before the auth gate, so no login is required.
- Uses the **admin** Supabase client and resolves the token via the `get_shared_dashboard` RPC (a `SECURITY DEFINER` function — the share path never touches tables directly under the visitor's (anonymous) identity). `notFound()` if the token resolves to nothing.
- From the RPC result it reads `community_id` and `community_name`, then runs a **read-only subset** of the queries at a fixed `30d` range (no time selector): `getDashboardMetrics`, `getMessageVolume`, `getChannelBreakdown`, `getTopContributors`, `getNewVsReturning`. It deliberately omits cohort retention and the lurker card.
- Renders KPI cards + Message Volume, Channel Breakdown, Top Contributors, and New vs Returning. Footer: "Read-only view · Data refreshed daily · No message content stored".

> Because the share page uses the admin client (RLS-bypassing) it relies entirely on the `get_shared_dashboard` RPC for the token→community gate. See [auth-and-access.md](auth-and-access.md) and [database.md](database.md).

---

## 6. Slack integration touchpoints

### `src/lib/slack.ts`

| Export | Purpose |
|---|---|
| `hmacUserId(userId, salt)` | HMAC-SHA256 hash of a Slack user ID with the per-community salt (privacy anchor — see §2). |
| `slackTsToDate(ts)` | Parses Slack's `"<secs>.<frac>"` timestamp to a `Date`; **throws** on malformed input so the ingest worker can skip rather than crash (#101). |
| `SLACK_SCOPES` | Comma-joined OAuth scopes: `channels:read, channels:history, groups:read, groups:history, users:read`. Read-only; no write/post scopes. |

Used by: `ingest-slack` (`hmacUserId`, `slackTsToDate`) and `slack/install` (`SLACK_SCOPES`).

### `src/lib/notifications.ts`

`sendFailureNotification(title, details)`:

- Always `console.error("[ALERT] ...")` (surfaces in Vercel Runtime Logs).
- If `ALERT_WEBHOOK_URL` is set, POSTs a JSON `{ text }` payload to that webhook (Slack/Discord-compatible); webhook errors are caught and logged, never thrown.

Called by `ingest-slack` on per-community ingest failure (with `.catch(() => {})` so a notification failure can't crash the cron).

---

## 7. Known gaps / notes for contributors

- **Ingested-but-unused fields:** `message_events.msg_length` and `has_reaction` are written by the cron but not surfaced by any current chart or query. Safe to build on; no UI removal needed.
- **Cohort RPC is optional:** `compute_cohort_retention` is called defensively and may not exist in every environment; the JS fallback is authoritative. If you add/alter the RPC, keep its output shape consistent with the `cohort_snapshots` columns the fallback writes, since `getCohortRetention` reads only that table.
- **Aggregation in JS:** several queries (§4 note) aggregate in the app layer; watch this if a community's message volume grows large.
- **Share page omits cohort + lurker** views by design; if you add charts there, confirm they don't require data the public RPC path can't safely expose.

> Related: pipeline mechanics in [data-pipeline.md](data-pipeline.md); routes/server actions in [api-and-actions.md](api-and-actions.md); RLS, RPCs, and table schemas in [database.md](database.md) and [auth-and-access.md](auth-and-access.md).
