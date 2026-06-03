# Authentication & Access Control

How Hearth authenticates users, gates routes via Next.js middleware, enforces an admin-approval workflow, and layers Supabase Row-Level Security (RLS) underneath — defense in depth for a privacy-first app.

> Sibling docs: [architecture.md](architecture.md) · [setup.md](setup.md) · [database.md](database.md) · [community-dashboard.md](community-dashboard.md) · [data-pipeline.md](data-pipeline.md) · [api-and-actions.md](api-and-actions.md) · [frontend.md](frontend.md) · [deployment.md](deployment.md) · [contributing.md](contributing.md) · root [CLAUDE.md](../CLAUDE.md)
>
> RLS policy detail per table → [database.md](database.md). Full route/action catalog → [api-and-actions.md](api-and-actions.md).

---

## 1. Authentication methods

Auth is Supabase Auth (GoTrue) over `@supabase/ssr`. Three sign-in mechanisms exist, but **not every entry point exposes all three**:

| Method | Implemented in | `/auth/login` | `/auth/signup` | `/admin/login` |
|---|---|:--:|:--:|:--:|
| Email + password | server actions `signInWithPassword` / `signUp` | yes | yes (signup) | yes |
| Google OAuth | `GoogleButton` → `signInWithOAuth({ provider: "google" })` | yes | yes | yes |
| Magic link (email OTP) | `MagicLinkForm` → `signInWithOtp` | **no** | **no** | yes |

> Note: The regular login page does **not** offer magic-link — `src/app/auth/login/page.tsx` renders only `GoogleButton` + an email/password `<form>`. `MagicLinkForm` (`src/components/auth/magic-link-form.tsx`) is wired up exclusively on `src/app/admin/login/page.tsx`.

### Email + password

- **Login** — `src/app/auth/login/actions.ts` (`login`): rate-limit by IP → validate with `loginSchema` → `supabase.auth.signInWithPassword` → redirect to the sanitized `redirect` param (default `/dashboard`).
- **Signup** — `src/app/auth/signup/actions.ts` (`signup`): rate-limit → validate with `signupSchema` → `supabase.auth.signUp({ email, password, options: { emailRedirectTo: <SITE_URL>/auth/callback } })` → redirect to `/auth/login?message=Check your email to confirm your account`.
- Both are `"use server"` actions using the **cookie-backed server client** (`src/lib/supabase/server.ts`).
- **User-enumeration hardening** (issue #68): both login and signup return generic errors (`"Invalid email or password"`, `"Could not complete signup. Please try again."`) that never reveal whether an account exists or its confirmation state.

Password policy is asymmetric by design (`src/lib/schemas.ts`):

| Schema | Min length | Why |
|---|---|---|
| `loginSchema` | 6 chars | Legacy accounts created before the bump can still sign in |
| `signupSchema` | 8 chars (`SIGNUP_PASSWORD_MIN`) + `confirmPassword` must match | New accounts |

> Security smell: a 6-char minimum on login means pre-existing weak passwords remain accepted indefinitely. Acceptable per the inline comment, but worth a forced-reset campaign if password auth becomes primary.

### Google OAuth

`src/components/auth/google-button.tsx` is a client component using the **browser client** (`src/lib/supabase/client.ts`). On click it calls `signInWithOAuth` with `redirectTo = ${window.location.origin}/auth/callback?redirect=<encoded target>`. The `redirect` target varies by entry point: `/auth/login` passes the sanitized post-login path, `/auth/signup` passes `/auth/pending`, `/admin/login` passes `/admin`. If Google isn't enabled in the Supabase project, the provider error surfaces inline under the button.

### Magic link (OTP)

`src/components/auth/magic-link-form.tsx` (client, browser client) calls `signInWithOtp` with the same `…/auth/callback?redirect=…` pattern. Tells the user the link expires in 1 hour. Used only on the admin sign-in page.

### Callback — `src/app/auth/callback/route.ts`

The single OAuth/OTP/email-confirmation return endpoint (`GET`):

1. Rate-limit by IP (`authLimiter`); 429 on exceed.
2. Read `code` + sanitized `redirect` (must start with `/`, not `//`; else `/dashboard`).
3. If `code` present, `exchangeCodeForSession(code)` to set the session cookies.
4. On exchange failure (issue #85): log and redirect to `/auth/login?error=Sign-in link expired. Please try again.` — deliberately **not** silently forwarding to `/dashboard` (which would cause a redirect loop with the middleware gate).
5. On success: redirect to the sanitized target.

### Sign-out — `src/app/auth/signout/route.ts`

`POST` only: `signOut()` then redirect to `/`. Being POST-only mitigates CSRF-style drive-by logout via `<img>`/link.

### `/auth/pending` — `src/app/auth/pending/page.tsx`

A static "account under review" landing page (invite-only messaging, support email). It performs **no auth check itself** — it is purely informational. The middleware is what *sends* unapproved users here.

---

## 2. The approval gate (`user_profiles.status` + `is_admin`)

Hearth is invite-only. Every authenticated user has a `user_profiles` row keyed by `user_id` with at minimum:

| Column | Type | Meaning |
|---|---|---|
| `status` | `pending` \| `approved` \| `rejected` | Access state; only `approved` clears the middleware gate |
| `is_admin` | boolean | Grants `/admin/*` access + member-management rights |
| `approved_at`, `approved_by` | timestamp / uuid | Set when an admin approves (see `setMemberStatus`) |
| `display_name`, `created_at` | — | Profile/UI metadata |

(See [database.md](database.md) for the full table schema and its RLS policies.)

### Lifecycle

```
signup / first OAuth login
        │
        ▼
   user_profiles row created  ──►  status = "pending"   ──►  /auth/pending
                                                               │ (admin acts)
                                        ┌──────────────────────┼─────────────────────┐
                                        ▼                       ▼                     ▼
                                 status="approved"      status="rejected"     (reinstate → "pending")
                                  → gated routes          → /auth/pending
```

> Note: New `user_profiles` rows are created automatically by the `on_auth_user_created` trigger on `auth.users` (the `handle_new_user()` `SECURITY DEFINER` function in `003_user_profiles_with_approval.sql`) — see [database.md](database.md). The middleware (§3) also defensively treats a *missing* profile the same as not-approved.

### How approval happens

Admins act from `/admin/members` (`src/app/admin/members/page.tsx` + `actions.ts`). The shared `setMemberStatus(userId, status)` server action:

1. `getUser()` → must be signed in.
2. Re-reads the **caller's** `user_profiles.is_admin` (does not trust middleware alone).
3. On `approved`, stamps `approved_at = now()` and `approved_by = currentUser.id`.
4. Updates the target row, then `revalidatePath("/admin/members")`.

| Action | Effect |
|---|---|
| `approveMember` | `status → approved` (+ approval stamps) |
| `rejectMember` | `status → rejected` (UI labels this "Reject" for pending and "Revoke" for approved members) |
| `reinstateMember` | `status → pending` (fresh review for a rejected user) |
| `promoteMember` | `is_admin → true`, **guarded by `.eq("status", "approved")`** so only approved members can be promoted |

---

## 3. Middleware gate (`src/middleware.ts`)

The middleware is the first access-control layer. Its `config.matcher` runs it only on these prefixes: `/dashboard/:path*`, `/admin/:path*`, `/opportunities/:path*`, `/opp/:path*`, `/api/cron/:path*`. Anything else (e.g. `/`, `/auth/*`, `/api/slack/*`) is untouched by middleware.

### Route → requirement

| Route / prefix | Requirement | On failure |
|---|---|---|
| `/dashboard/share/...` | **Public** (share-link special-case, checked first) | — (passes through) |
| `/admin/login` | **Public** (only un-gated path under `/admin`) | — |
| `/api/cron/...` | **Bearer `CRON_SECRET`** in `Authorization` header | `401 { error: "Unauthorized" }` (also 401 if `CRON_SECRET` is unset) |
| `/dashboard`, `/opportunities`, `/opp/...` | **Authenticated + `status === "approved"`** | no user → `302 /auth/login?redirect=<path>`; not approved / no profile → `302 /auth/pending` |
| `/admin/...` (except `/admin/login`) | **Authenticated + approved + `is_admin === true`** | as above, plus approved-but-not-admin → `302 /dashboard` |
| Everything else | Not matched (middleware does not run) | — |

> Note: `/opportunities` and `/opp/[slug]` are auth-gated here, even though the funding directory is described elsewhere as "public". The public funding surface is the homepage `/`; the full list/detail pages require an approved account.

### How the gate evaluates (order matters)

1. `/dashboard/share/` → pass (public share links; access controlled by a `SECURITY DEFINER` RPC, not RLS table reads — see [community-dashboard.md](community-dashboard.md)).
2. `/admin/login` → pass.
3. `/api/cron/` → compare `Authorization` to `Bearer ${CRON_SECRET}`; 401 if missing/mismatch/secret-unset.
4. Gated prefixes: build a `createMiddlewareClient` (§4), `getUser()`; redirect to login (preserving `redirect`) if anonymous; else read `{ status, is_admin }` from `user_profiles`; redirect to `/auth/pending` if no row or `status !== "approved"`; redirect non-admins away from `/admin`.
5. Fallback `NextResponse.next()`.

The login `redirect` param is sanitized everywhere it's consumed (`raw.startsWith("/") && !raw.startsWith("//")`, else `/dashboard`) to prevent open-redirect to external origins.

---

## 4. The four Supabase clients

| File | Factory | Key used | Cookies / session | RLS | Use from |
|---|---|---|---|---|---|
| `src/lib/supabase/server.ts` | `createClient()` (async) | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | reads/writes request cookies via `next/headers` | **Enforced** (acts as the signed-in user) | Server Components, Server Actions, route handlers |
| `src/lib/supabase/client.ts` | `createClient()` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser session storage | **Enforced** | Client Components |
| `src/lib/supabase/middleware.ts` | `createMiddlewareClient(request)` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | reads request cookies, writes refreshed cookies onto a `response` | **Enforced** | `src/middleware.ts` only |
| `src/lib/supabase/admin.ts` | `createAdminClient()` | `SUPABASE_SERVICE_ROLE_KEY` | none (`persistSession:false`, `autoRefreshToken:false`) | **BYPASSED** | server-only API routes / cron / privileged reads |

**`createAdminClient` is the dangerous one.** The service-role key bypasses all RLS. Its own JSDoc warns: *"Bypasses RLS — use only in server-side API routes and cron jobs. NEVER import this in client components or server components."*

> Note: that "never in server components" guidance is slightly stricter than current usage. `src/app/admin/members/page.tsx` (a Server Component) imports it to call `auth.admin.listUsers()` for emails — but only *after* the middleware has already proven the caller is an admin, and it never round-trips the service key to the client. Treat the JSDoc as the rule of thumb; the members page is a sanctioned exception.

### Server-client cookie writes (`server.ts`)

`src/lib/supabase/server.ts` swallows the error Next.js throws when cookies are written during a Server Component render:

```ts
// Next.js throws when cookies are set during a Server Component render.
// Route Handlers and Server Actions can set cookies safely; the
// @supabase/ssr docs recommend swallowing in the render context only.
```

This is the standard `@supabase/ssr` pattern, not a bug: cookie writes succeed normally from Server Actions and Route Handlers, and are safely no-ops (logged in non-production) only in a render context. It does **not** mean auth is disabled.

---

## 5. Admin console (`src/app/admin/*`)

| Path | File | Purpose |
|---|---|---|
| `/admin/login` | `login/page.tsx` + `login/actions.ts` | Public dark-themed sign-in (Google + password + magic link); `adminLogin` action redirects to `/admin` |
| `/admin` | `page.tsx` | Overview: KPI counts (pending/approved/rejected/admins, opportunities, 7-day signups) via `count` queries |
| `/admin` (shell) | `layout.tsx` + `_components/admin-chrome.tsx`, `admin-subnav.tsx` | Chrome + pending-count badge; `AdminChrome` strips the shell on `/admin/login` |
| `/admin/members` | `members/page.tsx` + `members/actions.ts` | Approve / reject / reinstate / promote members |
| — | `members/_components/promote-admin-button.tsx` | Confirmation dialog → `promoteMember` |

What admins can do: review the signup queue, approve/reject/reinstate members, and promote approved members to admin (irreversible from the UI — there is no demote action).

### How admin access is enforced (two layers)

1. **Middleware** (§3): `/admin/*` (minus `/admin/login`) requires authenticated + approved + `is_admin`. Non-admins are bounced to `/dashboard` before any admin page renders.
2. **Per-action re-check**: every member-mutating action (`setMemberStatus`, `promoteMember`) independently `getUser()`s and re-queries `is_admin`, returning `{ error: "Only admins can …" }` otherwise. This means even if a server action were invoked outside the middleware-covered path, it self-guards.

`adminLogin` (`login/actions.ts`) does **not** itself check `is_admin` — it only authenticates. The admin gate is applied by middleware on the *next* request to `/admin`; a successfully-authenticated non-admin who lands on `/admin` is redirected to `/dashboard`. The login page copy ("Restricted to Hearth admins. Non-admins will be redirected.") reflects this.

### Action result + form wiring

Member actions return `ActionResult` (`src/lib/action-result.ts` = `{ error: string } | null`; `null` = success) and are driven by `useFormState` via `ActionForm` / `PromoteAdminButton`. `user_id` inputs are validated with `parseFormUUID` (`src/lib/form-data.ts`) before any DB write.

> Note: `members/page.tsx` paginates `user_profiles` (1000/page) and `auth.admin.listUsers` (500/page) up to a `SAFETY_CAP` of 10,000 rows, logging a warning if hit. Fine at current scale; switch to keyset paging before that becomes load-bearing.

---

## 6. Rate limiting (`src/lib/rate-limit.ts`)

Upstash Redis sliding-window limiters, keyed by **first `x-forwarded-for` IP** (falls back to `"unknown"`).

| Limiter | Limit / window | Prefix | Applied to |
|---|---|---|---|
| `authLimiter` | **5 requests / 60 s** | `rl:auth` | `login`, `signup`, `adminLogin` actions; `auth/callback` GET |
| `apiLimiter` | **20 requests / 60 s** | `rl:api` | (defined; used by API routes — see [api-and-actions.md](api-and-actions.md)) |

`rateLimit(identifier, limiter)` returns `{ success, remaining }`. Callers branch on `success`: auth actions `redirect(...?error=Too many … attempts. Please wait a minute.)`; the callback route returns `429 { error: "Too many requests" }`.

### Graceful degradation when Upstash is unset

`createRedis()` returns `null` if either `UPSTASH_REDIS_REST_URL` or `UPSTASH_REDIS_REST_TOKEN` is missing. Both limiters then initialize to `null`, and `rateLimit` short-circuits to `{ success: true, remaining: 999 }` — i.e. **rate limiting becomes a no-op (allow-all)**. This keeps local/dev and misconfigured environments functional.

> Security smell: in production, missing Upstash env vars silently disable all rate limiting with no startup warning. Treat both vars as required in prod (verify in [deployment.md](deployment.md)).

---

## 7. Defense in depth — middleware + RLS

The two layers are independent and complementary:

| Layer | Trust boundary | What it protects | What it does **not** do |
|---|---|---|---|
| **Middleware** (`src/middleware.ts`) | Edge, before render | Route-level coarse gate: who reaches `/dashboard`, `/admin`, etc. | Does not constrain *which rows* a request can read/write |
| **RLS** (Postgres) | Database, every query | Row-level authorization on each table; enforced even if middleware is bypassed | Does not redirect or shape UX |
| **Per-action checks** (server actions) | Server, per mutation | Re-verifies `is_admin` for member mutations | — |

Why both matter:

- The **anon-key** clients (`server`/`client`/`middleware`) always run *as the user*, so even a request that slips past a route gate is still bounded by RLS policies in the database (see [database.md](database.md)).
- The **service-role** client (`admin.ts`) bypasses RLS, so it is confined to server-only code reached *after* the middleware admin gate, and its mutating server actions re-check `is_admin` themselves.
- Public share links don't touch tables directly — they go through a `SECURITY DEFINER` RPC, so the middleware can safely let `/dashboard/share/...` through without an auth check ([community-dashboard.md](community-dashboard.md)).

Net effect: an attacker must defeat both the edge gate **and** the database policies (or compromise the service-role key) to reach protected rows. When changing auth, middleware matchers, RLS, or ingest, treat correctness as security-critical and run `npm run db:test-rls` (per [CLAUDE.md](../CLAUDE.md)).
