# API Routes & Server Actions

A reference catalog of every HTTP route handler (`route.ts`) and Next.js server action (`actions.ts`) in the Hearth app, including auth gating, request/response shapes, and validation conventions.

> Companion docs: [architecture.md](architecture.md) · [auth-and-access.md](auth-and-access.md) (auth gate, RLS, approval flow) · [community-dashboard.md](community-dashboard.md) (dashboard flow, ingest pipeline) · [data-pipeline.md](data-pipeline.md) · [database.md](database.md) · root [CLAUDE.md](../CLAUDE.md).

---

## A. HTTP routes

Hearth exposes a small set of route handlers under `src/app/`. Auth gating for cron and gated routes is enforced centrally in [`src/middleware.ts`](../src/middleware.ts) (see notes below); per-route handlers add their own rate limiting and session checks.

| Method | Path | Auth | Purpose | Request shape | Response / redirect |
|---|---|---|---|---|---|
| `GET` | `/api/cron/ingest-slack` | `CRON_SECRET` Bearer (middleware) | Pull last-24h Slack message **metadata** for all `active` communities into `message_events`. | None (no query/body). | `200` JSON: `{ timestamp, communities_processed, results[], status: "success" \| "partial_failure" }`. `500` `{ error: "Failed to fetch communities" }` on community-fetch error. |
| `GET` | `/api/cron/compute-cohorts` | `CRON_SECRET` Bearer (middleware) | Recompute weekly cohort-retention snapshots for all `active` communities. | None. | `200` JSON: `{ timestamp, communities_processed }`, or `{ message: "No active communities" }`. `500` `{ error: "Failed to fetch communities" }` on fetch error. |
| `GET` | `/api/slack/install` | Session (Supabase user) | Begin Slack OAuth: set CSRF `state` cookie, redirect to Slack's authorize URL. | None (uses session cookie). | `302` redirect to `https://slack.com/oauth/v2/authorize?...`; sets `slack_oauth_state` cookie. Unauthenticated → `302` `/auth/login`. Rate-limited → `429`. |
| `GET` | `/api/slack/callback` | Session (Supabase user) | Slack OAuth callback: validate `state`, exchange `code` for token, create/update community, store encrypted token, sync channels. | Query: `code`, `state`, `error` (Slack denial). | `302` redirect to `/dashboard/{communityId}/settings` on success; clears `slack_oauth_state`. Errors → `302` `/dashboard?error=...`. Unauthenticated → `302` `/auth/login`. Rate-limited → `429`. |
| `GET` | `/auth/callback` | Public | Supabase email-link/OAuth callback: exchange `code` for a session. | Query: `code`, `redirect` (optional). | `302` redirect to sanitized `redirect` (default `/dashboard`). On exchange failure → `302` `/auth/login?error=...`. Rate-limited → `429`. |
| `POST` | `/auth/signout` | Session (best-effort) | Sign the current user out. | None (no body). | `302` redirect to `/`. |

> Note: `/api/slack/install` and `/api/slack/callback` are **not** matched by the `src/middleware.ts` matcher (which covers `/dashboard`, `/admin`, `/opportunities`, `/opp/`, `/api/cron`). They enforce their own session check inline via `supabase.auth.getUser()`. The `/auth/*` routes are likewise unmatched and gate themselves.

### Cron routes — auth & behavior

Both cron handlers are `GET`, exported with `export const dynamic = "force-dynamic"` and `export const maxDuration = 60`. They are gated entirely by [`src/middleware.ts`](../src/middleware.ts): any request under `/api/cron/` must carry `Authorization: Bearer <CRON_SECRET>` or it returns `401 { error: "Unauthorized" }`. If `CRON_SECRET` is unset, **all** cron requests are rejected. The handlers themselves do no further auth check — they trust the middleware gate.

- **`/api/cron/ingest-slack`** ([route.ts](../src/app/api/cron/ingest-slack/route.ts)): for each `active` community it writes a `running` row to `ingest_log`, decrypts the Slack token via the `get_decrypted_token` RPC (using `TOKEN_ENCRYPTION_KEY`), and for each `opted_in` channel pages `conversations.history` (limit 200, `oldest` = now − 24h). It stores **metadata only** — `hashed_user_id` (HMAC via `hmacUserId`, see [src/lib/slack.ts](../src/lib/slack.ts)), `ts`, `msg_length`, `has_thread`, `has_reaction` — never message text. Rows are upserted into `message_events` with `ignoreDuplicates`. Per-channel errors are caught and logged without aborting the run; a 1.2s delay between channels rate-limits Slack. On per-community failure it updates `ingest_log` to `error` and calls `sendFailureNotification` (best-effort). Note: the community-fetch error body is intentionally generic to avoid leaking Postgres error text to a caller that guessed `CRON_SECRET` (code comment cites issue #71).
- **`/api/cron/compute-cohorts`** ([route.ts](../src/app/api/cron/compute-cohorts/route.ts)): for each `active` community it **first attempts a `compute_cohort_retention` RPC** (`admin.rpc("compute_cohort_retention", { p_community_id })`). If that RPC does not exist / returns no data, it **falls back to a JS implementation** that reads all `message_events`, derives each user's first active week (cohort) and active weeks via `getWeekStart`, builds a retention matrix, and upserts `cohort_snapshots` (on conflict `community_id,week_start,cohort_week`). Per-community errors are caught and logged; the run continues.

### Slack OAuth — install → callback flow

The install/callback pair implements the standard authorization-code flow with a CSRF `state` token:

1. **Install** ([api/slack/install/route.ts](../src/app/api/slack/install/route.ts)): rate-limits by IP (`apiLimiter`), requires a Supabase session (else redirect to `/auth/login`), generates `state = crypto.randomBytes(16).toString("hex")`, and redirects to Slack's `oauth/v2/authorize` with `client_id` (`SLACK_CLIENT_ID`), `scope` (`SLACK_SCOPES` from [src/lib/slack.ts](../src/lib/slack.ts): `channels:read,channels:history,groups:read,groups:history,users:read`), `redirect_uri` (`${NEXT_PUBLIC_SITE_URL}/api/slack/callback`), and `state`. The `state` is also stored in an `httpOnly`, `sameSite=lax` cookie `slack_oauth_state` (`maxAge` 600s; `secure` in production).
2. **Callback** ([api/slack/callback/route.ts](../src/app/api/slack/callback/route.ts)): rate-limits by IP, reads `code`/`state`/`error` from the query. Slack denial (`error` present) → redirect `/dashboard?error=...`. **CSRF check:** the query `state` must equal the `slack_oauth_state` cookie, else redirect `/dashboard?error=Invalid OAuth state`. Missing `code` → `/dashboard?error=No authorization code`. Requires a session. It then POSTs to `oauth.v2.access` (with `SLACK_CLIENT_ID` + `SLACK_CLIENT_SECRET`) to exchange `code`; on `!ok` redirects with the Slack error. On success it upserts the `communities` row keyed by `slack_team_id` (sets owner to the current user on insert), stores the token encrypted via the `store_integration` RPC (using `TOKEN_ENCRYPTION_KEY`), and best-effort syncs channels from `conversations.list` into `channels` with **`opted_in: false`** (privacy-first default). Finally it clears `slack_oauth_state` and redirects to `/dashboard/{communityId}/settings`.

> Secrets referenced by name only: `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `NEXT_PUBLIC_SITE_URL`, `TOKEN_ENCRYPTION_KEY`, `CRON_SECRET`. See [setup.md](setup.md) / `.env.example` for the full list.

### Other auth routes

- **`/auth/callback`** ([route.ts](../src/app/auth/callback/route.ts)): rate-limits by IP (`authLimiter`), reads `code` and an optional `redirect`. **Open-redirect guard:** `redirect` must start with `/` and not `//`, else it defaults to `/dashboard`. If `code` is present it calls `supabase.auth.exchangeCodeForSession`; on failure it redirects to `/auth/login?error=Sign-in link expired. Please try again.` (rather than silently continuing — code comment cites issue #85). Otherwise redirects to the sanitized target.
- **`/auth/signout`** ([route.ts](../src/app/auth/signout/route.ts)): `POST` only; calls `supabase.auth.signOut()` and redirects to `/`. No rate limiting or explicit auth guard — sign-out is idempotent for an unauthenticated caller.

---

## B. Server actions

All server-action files begin with `"use server"`. Form-driven actions parse `FormData` and either `redirect()` (auth actions) or return an `ActionResult` (admin/dashboard actions) for inline error surfacing.

| File | Exported action(s) | Input (schema / fields) | Auth / ownership guard | Returns |
|---|---|---|---|---|
| [auth/login/actions.ts](../src/app/auth/login/actions.ts) | `login(formData)` | `loginSchema` (`email`, `password` min 6) via `formDataToObject`; reads `redirect` field. | IP rate-limit (`authLimiter`); credentials via `signInWithPassword`. | `void` — `redirect()` on every path (success → sanitized `redirect` default `/dashboard`; failure → `/auth/login?error=...`). |
| [auth/signup/actions.ts](../src/app/auth/signup/actions.ts) | `signup(formData)` | `signupSchema` (`email`, `password`, `confirmPassword`; min 8; refine passwords match). | IP rate-limit (`authLimiter`); `auth.signUp` with `emailRedirectTo` → `/auth/callback`. | `void` — `redirect()` (success → `/auth/login?message=Check your email...`; failure → `/auth/signup?error=...`). |
| [admin/login/actions.ts](../src/app/admin/login/actions.ts) | `adminLogin(formData)` | `loginSchema` (`email`, `password` min 6). | IP rate-limit (`authLimiter`); `signInWithPassword`. **Admin gating is not in this action** — it relies on the `/admin/*` `is_admin` check in `src/middleware.ts`. | `void` — `redirect()` (success → `/admin`; failure → `/admin/login?error=...`). |
| [admin/members/actions.ts](../src/app/admin/members/actions.ts) | `approveMember`, `rejectMember`, `reinstateMember`, `promoteMember` (all `(_prevState, formData)`) | No zod schema; `parseFormUUID(formData, "user_id")`. | Each requires a signed-in user **and** `user_profiles.is_admin === true` (checked in `setMemberStatus` / inline in `promoteMember`). `promoteMember` only sets `is_admin` on rows already `status = "approved"`. | `Promise<ActionResult>` — `null` on success (after `revalidatePath("/admin/members")`), `{ error }` otherwise. |
| [dashboard/[communityId]/settings/actions.ts](../src/app/dashboard/[communityId]/settings/actions.ts) | `toggleChannel`, `regenerateShareToken`, `disableSharing`, `revokeIntegration` (all `(_prevState, formData)`) | No zod schema; `parseFormUUID` for `communityId` / `channelId`, `parseFormBoolean` for `optedIn`. | `requireOwner(communityId)`: signed-in user must equal `communities.owner_user_id`. | `Promise<ActionResult>` — `null` on success (after `revalidatePath` of the settings page); `{ error }` on failure. `revokeIntegration` calls the `revoke_community` RPC then `redirect("/dashboard")`. |

### Notes on individual actions

- **Auth actions** (`login`, `signup`, `adminLogin`) never return a value — they always end in `redirect(...)`. Errors are surfaced as `?error=` query params read by the corresponding page. Messages are deliberately generic ("Invalid email or password", "Could not complete signup") to avoid user-enumeration leaks (code comments cite issue #68).
- **`login`** re-validates the `redirect` target the same way as `/auth/callback`: must start with `/` and not `//`, else `/dashboard`.
- **`admin/members`** actions share a private `setMemberStatus(userId, status)` helper. `approveMember` additionally stamps `approved_at` / `approved_by`. These are React `useActionState`-style actions (signature `(_prevState, formData)`).
- **`dashboard/.../settings`** actions all funnel through `requireOwner`, which uses the **session** Supabase client (subject to RLS). `revokeIntegration` switches to the **admin** client (`createAdminClient`) to invoke the `revoke_community` RPC.

> Note (unverified): the `parseFormUUID`, `parseFormBoolean`, `parseFormString`, `formDataToObject`, and `firstZodError` helpers live in `@/lib/form-data` (referenced but not read for this doc). Their exact validation behavior is inferred from call sites.

---

## Validation & error-surfacing conventions

- **Validation = zod.** Input schemas live in [`src/lib/schemas.ts`](../src/lib/schemas.ts). The two used by these actions are:
  - `loginSchema` — `{ email: string().email(), password: string().min(6) }`. The 6-char minimum is intentionally lenient so legacy accounts can still sign in.
  - `signupSchema` — `{ email, password, confirmPassword }` with `min 8` (`SIGNUP_PASSWORD_MIN`) and a `.refine()` requiring `password === confirmPassword` (error path `confirmPassword`).
  - (Other schemas in the file — `opportunitySchema`, `taggedFieldsSchema`, `communitySchema`, `channelSchema`, `messageEventSchema`, and the enums — are data-shape/type schemas used elsewhere, not action inputs.)
  Actions call `schema.safeParse(formDataToObject(formData))` and, on failure, `redirect(...?error=${firstZodError(...)})` (auth actions) — i.e. the **first** zod issue message is shown. ID-only actions skip zod and rely on `parseFormUUID` returning `null` for invalid UUIDs.
- **Error surfacing = `ActionResult`.** Defined in [`src/lib/action-result.ts`](../src/lib/action-result.ts) as:

  ```ts
  export type ActionResult = { error: string } | null;
  ```

  `null` means success; `{ error }` carries a user-facing message. Admin- and dashboard-settings actions return `ActionResult` (consumed by client forms, typically via `useActionState`), whereas auth actions communicate via redirect query params instead. Several actions interpolate the raw Supabase `error.message` into the returned string (e.g. `Failed to update channel: ${error.message}`); cron routes deliberately do **not** (they return generic bodies).

---

## Summary of auth gating by layer

| Concern | Where enforced |
|---|---|
| Cron `CRON_SECRET` Bearer | `src/middleware.ts` (`/api/cron/*`) |
| Gated-route session + `approved` profile | `src/middleware.ts` (`/dashboard`, `/admin`, `/opportunities`, `/opp`) |
| `/admin/*` `is_admin` | `src/middleware.ts` |
| Slack OAuth session check | Inline in `/api/slack/install` + `/api/slack/callback` |
| Per-action admin check | `admin/members/actions.ts` (`is_admin`) |
| Per-action ownership check | `dashboard/[communityId]/settings/actions.ts` (`requireOwner`) |
| IP rate limiting | Inline per route/action via `@/lib/rate-limit` (`authLimiter` / `apiLimiter`) |

See [auth-and-access.md](auth-and-access.md) for the full auth gate, approval workflow, and RLS model.
