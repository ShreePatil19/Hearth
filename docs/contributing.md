# Contributing

Conventions for branches, commits, pull requests, migrations, and review. See [setup.md](setup.md) to get a working environment and [CLAUDE.md](../CLAUDE.md) for a project overview.

## Branches

Branch off `main` using `type/short-description`:

```
fix/upstash-rate-limiter
feat/promote-to-admin
perf/dashboard-set-lookups
docs/developer-documentation
```

## Commits

[Conventional Commits](https://www.conventionalcommits.org/): `type(scope): subject`.

- Types in use: `feat`, `fix`, `perf`, `docs`, `chore`.
- Reference issues in the body with `Closes #N`.
- Keep the subject imperative and under ~70 chars.

## Pull requests

Match the established PR format:

```markdown
## Summary
- **Fixes #NN** — one-line statement of the problem
- Bullet points describing the change and its impact

## Migration            (only if a DB migration is included)
## Setup required        (only if new env vars / services are needed)

## Test plan
- [ ] Concrete, checkable verification steps
```

Keep the title short; put detail in the body. Reference the issue so it auto-closes on merge.

## Issue labels

| Label | Meaning |
|---|---|
| `P0` / `P1` / `P2` | Priority (P0 = drop everything) |
| `security` | Auth, RLS, secrets, PII |
| `perf` | Performance / cost |
| `tech-debt` | Cleanup / hygiene |
| `bug` | Incorrect behavior |
| `enhancement` | New capability |
| `testing` | Test coverage / infrastructure |
| `documentation` | Docs |

## Review gates (CI must pass)

Every PR to `main` runs `.github/workflows/ci.yml`. Replicate it locally before pushing:

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # next lint
npm test            # vitest run
npm run build
npm run db:test-rls # RLS security test (needs .env.local)
```

Scraper changes also run `python -m pytest scrapers/tests -q`. See [deployment.md](deployment.md) for the full CI breakdown.

## Tests

- TS unit tests live in `src/lib/__tests__/` (Vitest + happy-dom). Co-locate new tests there; the suite covers `schemas`, `filters`, `dates`, `form-data`, `rate-limit`, `slack`, `notifications`, `dashboard-queries`, the Supabase clients, and more.
- Scraper tests live in `scrapers/tests/` (pytest).
- Add coverage when you change behavior; CI runs the full suite on every PR.

## Database migrations

- Numbered `NNN_name.sql` in `supabase/migrations/`, applied via the Supabase SQL editor (see [database.md](database.md)).
- **Pair every migration with a `NNN_name.down.sql` rollback** — all six existing migrations already have one; keep this convention.
- **Gotcha:** there are currently two migrations numbered `005` (`005_fix_user_profiles_rls.sql` and `005_user_profiles_rls_hardening.sql`). The next migration must be `006`. Do not renumber existing files; be aware their apply order is filename-dependent (see [database.md](database.md)).

## Security-critical changes

Treat changes to auth, middleware, RLS policies, migrations, token handling, or Slack ingest as security-critical:

- Run `npm run db:test-rls` and confirm policies still hold.
- Never store Slack **message text**; keep user IDs HMAC-hashed; keep per-channel opt-in default OFF (see [community-dashboard.md](community-dashboard.md) and [auth-and-access.md](auth-and-access.md)).
- Never log secrets or raw PII. Refer to env vars by name; never commit values.
