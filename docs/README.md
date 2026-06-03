# Hearth Developer Documentation

Developer-facing documentation for the Hearth platform. For a high-level orientation and conventions, start with [`/CLAUDE.md`](../CLAUDE.md) at the repo root.

## Reading order

New to the codebase? Read these in order:

1. **[architecture.md](architecture.md)** — the two products, system components, request lifecycle, and trust boundaries.
2. **[setup.md](setup.md)** — get the app, database, and scrapers running locally; environment variables; tests.
3. **[database.md](database.md)** — schema, migrations, RLS policies, and the privacy/encryption model.

## Subsystem deep-dives

- **[community-dashboard.md](community-dashboard.md)** — Slack ingest pipeline, cron jobs, cohort/retention computation, dashboard charts, and privacy guarantees.
- **[auth-and-access.md](auth-and-access.md)** — auth flows, the approval gate, middleware, admin access, RLS, and rate limiting.
- **[data-pipeline.md](data-pipeline.md)** — Python scrapers: the 10 sources, shared modules, tagging, and the daily refresh job.
- **[api-and-actions.md](api-and-actions.md)** — catalog of API routes and server actions with their auth requirements and payloads.

## Supporting

- **[frontend.md](frontend.md)** — App Router structure, the component library, and UI conventions.
- **[deployment.md](deployment.md)** — Vercel hosting, Vercel Cron, GitHub Actions CI/CD, Sentry, and secrets.
- **[contributing.md](contributing.md)** — branch/commit/PR conventions, issue labels, and review gates.

## Keeping docs accurate

These docs are versioned alongside the code and reviewed via PR. When you change a subsystem, update its doc in the same PR. Each doc cites the real source files it describes — if a path or behavior changes, fix the doc.
