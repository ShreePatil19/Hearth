# Frontend

Hearth's UI is a Next.js 14 App Router application (TypeScript + Tailwind + shadcn/ui) that renders the public Funding Radar, the gated opportunity list, and the community/admin consoles from server components, dropping to client components only where interactivity demands it.

> Audience: frontend developers. For backend data-access and server actions see [api-and-actions.md](api-and-actions.md); for the Slack analytics dashboard internals see [community-dashboard.md](community-dashboard.md). Auth gating lives in [auth-and-access.md](auth-and-access.md). Repo overview: [CLAUDE.md](../CLAUDE.md).

Related docs: [architecture.md](architecture.md) · [setup.md](setup.md) · [database.md](database.md) · [community-dashboard.md](community-dashboard.md) · [auth-and-access.md](auth-and-access.md) · [data-pipeline.md](data-pipeline.md) · [api-and-actions.md](api-and-actions.md) · [deployment.md](deployment.md) · [contributing.md](contributing.md)

## 1. App Router conventions

Code lives under `src/app/` (App Router) and `src/components/`. Pages are **server components by default**; `params`/`searchParams` are `Promise`s and are `await`ed (Next.js 14.2 convention) — see `src/app/opp/[slug]/page.tsx` and `src/app/opportunities/page.tsx`.

Components opt into the client with the `"use client"` directive. Client components are reserved for interactivity (hooks, event handlers, charts):

| Client component | Path | Why client |
|---|---|---|
| `columns` | `src/components/columns.tsx` | TanStack `ColumnDef` cell renderers |
| `OpportunityTable` | `src/components/opportunity-table.tsx` | `useReactTable` |
| `FilterSidebar` | `src/components/filter-sidebar.tsx` | `useSearchParams`/`useRouter`, `useCallback` |
| `ActiveFilterChips` | `src/components/active-filter-chips.tsx` | URL state hooks |
| `ActionForm` | `src/components/action-form.tsx` | `useFormState` |
| `SiteHeaderNav` | `src/components/site-header-nav.tsx` | `usePathname`, mobile sheet state |
| `dashboard/*` charts | `src/components/dashboard/*.tsx` | `recharts` (e.g. `message-volume-chart.tsx`) |
| `MagicLinkForm`, `GoogleButton` | `src/components/auth/*.tsx` | client Supabase auth calls |
| `channel-toggles`, `time-range-selector` | `src/app/dashboard/.../*.tsx` | `useState`/`useTransition` |
| Error/`reset` boundaries | `src/app/**/error.tsx` | error boundaries are always client |

Note: data-fetching pages such as `SiteHeader` (`src/components/site-header.tsx`) stay server components and read Supabase directly via `@/lib/supabase/server`.

### Special files present

| File | Location | Purpose |
|---|---|---|
| `layout.tsx` | `src/app/` (root) | HTML shell, fonts, `ThemeProvider`, Vercel `Analytics` |
| `layout.tsx` | `src/app/auth/`, `src/app/dashboard/`, `src/app/admin/` | Route-group chrome (auth card shell, dashboard sidebar, admin shell) |
| `loading.tsx` | `src/app/opp/[slug]/`, `src/app/dashboard/`, `src/app/dashboard/[communityId]/` | Skeleton fallbacks |
| `error.tsx` | `src/app/dashboard/`, `src/app/dashboard/[communityId]/` | Client error boundary with `reset()` |
| `not-found.tsx` | `src/app/opp/[slug]/` | 404 for missing opportunities (triggered by `notFound()`) |

> Note: there is **no root-level `loading.tsx`, `error.tsx`, or `not-found.tsx`** in `src/app/` — only the locations above. Route-group folders prefixed `_components` (e.g. `src/app/admin/_components/`, `src/app/dashboard/_components/`) are private and not routable.

## 2. Route map

Access column reflects how the route is reached in practice: `public` (no auth), `auth+approved` (member-gated by `src/middleware.ts`), `admin` (`is_admin` gate), `public-share` (unauthenticated, resolved through a `SECURITY DEFINER` RPC). Gating itself is centralized in `src/middleware.ts` — see [auth-and-access.md](auth-and-access.md).

### Pages

| Path | File | Access | Purpose |
|---|---|---|---|
| `/` | `src/app/page.tsx` | public | Funding Radar landing page; redirects approved users to `/opportunities`, pending users to `/auth/pending` |
| `/opportunities` | `src/app/opportunities/page.tsx` | auth+approved | Filterable opportunity list (server-side Supabase query + filters) |
| `/opp/[slug]` | `src/app/opp/[slug]/page.tsx` | auth+approved | Single opportunity detail; `generateMetadata`, `notFound()` on miss |
| `/privacy` | `src/app/privacy/page.tsx` | public | Plain-English privacy explainer |
| `/auth/login` | `src/app/auth/login/page.tsx` | public | Email/password + Google + magic-link sign-in; sanitizes `?redirect=` |
| `/auth/signup` | `src/app/auth/signup/page.tsx` | public | Request-access signup |
| `/auth/pending` | `src/app/auth/pending/page.tsx` | public | "Account under review" holding page |
| `/dashboard` | `src/app/dashboard/page.tsx` | auth | Community picker / Slack onboarding; redirects to `/dashboard/[id]` when exactly one community |
| `/dashboard/[communityId]` | `src/app/dashboard/[communityId]/page.tsx` | auth (owner via RLS) | Community analytics dashboard — detail in [community-dashboard.md](community-dashboard.md) |
| `/dashboard/[communityId]/settings` | `src/app/dashboard/[communityId]/settings/page.tsx` | auth (owner via RLS) | Per-channel opt-in toggles, integration revoke |
| `/dashboard/share/[shareToken]` | `src/app/dashboard/share/[shareToken]/page.tsx` | public-share | Read-only shared dashboard via `get_shared_dashboard` RPC |
| `/admin` | `src/app/admin/page.tsx` | admin | Members + catalog KPI overview |
| `/admin/members` | `src/app/admin/members/page.tsx` | admin | Approve / reject / reinstate / promote members |
| `/admin/login` | `src/app/admin/login/page.tsx` | public | Admin sign-in (explicitly excluded from the `/admin/*` gate) |

### Route handlers (`route.ts`)

These are API/OAuth endpoints, not UI; documented fully in [api-and-actions.md](api-and-actions.md).

| Path | File | Purpose |
|---|---|---|
| `/auth/callback` | `src/app/auth/callback/route.ts` | Supabase OAuth/magic-link exchange |
| `/auth/signout` | `src/app/auth/signout/route.ts` | POST sign-out (used by header form) |
| `/api/slack/install` | `src/app/api/slack/install/route.ts` | Slack OAuth install start |
| `/api/slack/callback` | `src/app/api/slack/callback/route.ts` | Slack OAuth callback |
| `/api/cron/ingest-slack` | `src/app/api/cron/ingest-slack/route.ts` | Cron: metadata ingest (Bearer-gated) |
| `/api/cron/compute-cohorts` | `src/app/api/cron/compute-cohorts/route.ts` | Cron: cohort computation (Bearer-gated) |

> Note: the README's project-structure section lists a `community/` route ("Landing page for community managers"). **Verified false — `src/app/community/` does not exist** (glob of `src/app/community/**` returns nothing). The community-manager pitch lives as a section within the landing page `src/app/page.tsx` and the `/privacy` page; the analytics product lives under `/dashboard`. Treat the README entry as stale.

## 3. Component library

### shadcn/ui primitives — `src/components/ui/`

Configured via `components.json` (`style: default`, `rsc: true`, base color `slate`, CSS variables on). Present primitives:

`alert`, `avatar`, `badge`, `button`, `card`, `checkbox`, `dialog`, `dropdown-menu`, `input`, `label`, `scroll-area`, `select`, `separator`, `sheet`, `skeleton`, `sonner` (toasts), `switch`, `table`, `tabs`.

### Custom / app components — `src/components/`

| Component | File | Role |
|---|---|---|
| `SiteHeader` | `site-header.tsx` | Server wrapper: reads user/profile, computes admin + pending count, renders nav |
| `SiteHeaderNav` | `site-header-nav.tsx` | Client nav: status-aware links, mobile sheet, sign-out form |
| `SiteFooter` | `site-footer.tsx` | Disclaimer, privacy link, Fishburners wordmark |
| `columns` | `columns.tsx` | TanStack column defs for the opportunity table (type colors, deadline formatting, `meta.hideOnMobile`) |
| `OpportunityTable` | `opportunity-table.tsx` | Renders the table + empty state |
| `FilterSidebar` | `filter-sidebar.tsx` | Desktop sidebar + mobile filter sheet |
| `ActiveFilterChips` | `active-filter-chips.tsx` | Removable chips reflecting active URL filters |
| `ActionForm` | `action-form.tsx` | Generic server-action `<form>` wrapper with inline error |
| `dashboard/*` | `dashboard/` | `metric-card`, `message-volume-chart`, `channel-breakdown-chart`, `new-vs-returning-chart`, `top-contributors-table`, `cohort-retention-table`, `lurker-ratio-card`, `time-range-selector` |
| `auth/*` | `auth/` | `google-button`, `magic-link-form`, `auth-divider` |
| `brand/*` | `brand/` | `fishburners-wordmark` |

Route-private components also exist under `src/app/admin/_components/` (`admin-chrome`, `admin-subnav`), `src/app/admin/members/_components/` (`promote-admin-button`), and `src/app/dashboard/_components/` (`dashboard-sidebar`).

## 4. Styling

### Tailwind (`tailwind.config.ts`)

- `darkMode: ["class"]`; content globs cover `src/pages`, `src/components`, `src/app`.
- Container centered, padded `1rem`, max `2xl: 1280px`.
- Fonts: `sans` → Inter (`--font-inter`), `display` → Anton (`--font-anton`). Both loaded in the root layout via `next/font/google`.
- **Custom `hearth` color palette** (the brand orange), with shades `50,100,200,300,400,500,600,700,900` mapped to CSS variables `--orange-*` (defined in `src/app/globals.css`; `--orange-500` is the primary Flame Orange `#FF4C00`). A `success` palette maps to `--green-*` (a smaller set of shades). Standard shadcn tokens (`background`, `foreground`, `primary`, `card`, etc.) use `hsl(var(--…))`.
- Plugin: `tailwindcss-animate`.

Brand gradient/glow utilities (`hearth-gradient`, `hearth-gradient-subtle`, `hearth-glow`) are hand-authored CSS classes in `src/app/globals.css`, not Tailwind config keys.

### Dark mode

`src/app/layout.tsx` wraps the app in `next-themes` `ThemeProvider` with `attribute="class"`, `defaultTheme="system"`, `enableSystem`, `disableTransitionOnChange`. `<html>` sets `suppressHydrationWarning`. Tokens flip via the `.dark` class (`src/app/globals.css`).

> Note: no theme-toggle UI control was found in the components read; theme follows the system preference by default.

### `cn()` helper — `src/lib/utils.ts`

`cn(...inputs)` merges classes with `clsx` + `tailwind-merge` — the standard shadcn pattern for conditional/conflicting class resolution. `src/lib/utils.ts` also exports `formatCurrency()` (used by the table and detail page) and `generateSlug()`.

## 5. Data tables (TanStack React Table)

The opportunity list is a thin TanStack setup:

- **`src/components/columns.tsx`** — `ColumnDef<Opportunity>[]`: columns for `name` (links to `/opp/[slug]`), `type` (color-coded `Badge`), `amount` (`formatCurrency`), `deadline` (relative "Nd left" / urgent styling via local `formatDeadline`), `geo` (badges, hidden on mobile through `meta.hideOnMobile`), and a source-link icon column.
- **`src/components/opportunity-table.tsx`** — `useReactTable({ data, columns, getCoreRowModel })`, renders shadcn `Table` parts with `flexRender`, honors `meta.hideOnMobile`, and shows an `Inbox` empty state when there are no rows. It receives already-filtered `data` as a prop (no client-side filtering/sorting/pagination models are registered).

### Filtering

Filtering is **URL-driven**, not table-state-driven:

- **`src/components/filter-sidebar.tsx`** (client) reads/writes query params with `useSearchParams` + `router.replace(..., { scroll: false })`. Multi-select facets (`type`, `stage`, `industry`, `geo`, `cycle`) are comma-joined; booleans (`aussie`, `equity`, `impact`) are `"true"` flags. Facet options come from `src/lib/constants.ts`. Renders a desktop `aside` and a mobile `Sheet`.
- **`src/components/active-filter-chips.tsx`** renders removable chips for the same params.
- **`src/lib/filters.ts`** exposes `FilterState` + `parseFilters(searchParams)`, the server-side counterpart that `src/app/opportunities/page.tsx` uses to translate params into Supabase query clauses (`.in`, `.overlaps`, `.contains`, `.eq`). The page guards on `process.env.NEXT_PUBLIC_SUPABASE_URL` before querying.

Flow: sidebar/chip click → URL update → server `page.tsx` re-renders → `parseFilters` → Supabase query → `OpportunityTable` re-renders.

## 6. Forms (server actions)

Mutations use React server actions with the `useFormState` + `ActionResult` pattern:

- **`src/components/action-form.tsx`** wraps a `<form>` around `useFormState(action, null)`, binds `action={formAction}`, and renders `state.error` inline as destructive text. The `action` prop is typed `(prevState: ActionResult, formData: FormData) => Promise<ActionResult>`, where `ActionResult` comes from `@/lib/action-result`.
- Consumers pass server actions and hidden inputs — e.g. `src/app/admin/members/page.tsx` uses `<ActionForm action={approveMember}>` / `rejectMember` / `reinstateMember` with a hidden `user_id`.
- Dashboard settings toggles (`src/app/dashboard/[communityId]/settings/channel-toggles.tsx`) follow the same `ActionResult` action signature but drive it through `useState`/`useTransition` rather than `ActionForm`.
- Auth pages bind server actions directly to `<form action={login|signup|adminLogin}>` (in `src/app/auth/login`, `auth/signup`, `admin/login`), surfacing results via `?error`/`?message` search params + the `Alert` primitive instead of `useFormState`.

Server-action implementations and the `ActionResult` contract are documented in [api-and-actions.md](api-and-actions.md).
