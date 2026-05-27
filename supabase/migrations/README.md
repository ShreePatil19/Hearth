# Supabase migrations

Hearth uses plain SQL migrations applied through the Supabase Dashboard SQL editor (and via `scripts/apply-migration.ts` for local development). Each migration follows a paired up/down convention so a failed change can be reverted without restoring from a `pg_dump` snapshot.

## File naming

```
<NNN>_<description>.sql        forward migration ("up")
<NNN>_<description>.down.sql   matched rollback ("down")
```

The numeric prefix establishes order; the description must be lowercase snake_case. Pair the down file with the exact same prefix and description as the up file.

## Conventions

1. **Idempotent.** Every statement in a down migration uses `IF EXISTS` (drops) or `IF NOT EXISTS` (creates), so re-running is safe.
2. **CASCADE on tables, not extensions.** Dropping a table cascades indexes, triggers, RLS policies, and FK chains. Extensions (`pgcrypto`, `moddatetime`) are never dropped by a single migration's down because other migrations may still depend on them.
3. **Self-contained.** A down migration only reverses what its paired up migration added. It does not reset state from earlier migrations.
4. **Restore prior state where needed.** If an up migration `DROP POLICY ... DROP POLICY` then re-creates with a different definition, the down has to recreate the prior version. See `005_fix_user_profiles_rls.down.sql` for the pattern.
5. **No data preservation.** Down migrations drop tables and their data. The operator is responsible for capturing a `pg_dump` snapshot before applying a down migration to a database that contains real data.

## Applying a rollback

Apply down migrations in **reverse order** of the corresponding up migrations. For example, to roll the database back from `005_user_profiles_rls_hardening` to the state at the end of `003`:

```sql
-- Run in the Supabase SQL editor
\i 005_user_profiles_rls_hardening.down.sql
\i 005_fix_user_profiles_rls.down.sql
\i 004_tagger_extended_fields.down.sql
```

After rollback, verify state with the relevant tests (e.g. `npm run db:test-rls`).

## Manual test for new migrations

When adding a new pair, exercise the round-trip locally:

```sql
-- 1. apply the up
\i NNN_my_change.sql
-- 2. apply the down
\i NNN_my_change.down.sql
-- 3. apply the up again — must be clean, no leftover artefacts
\i NNN_my_change.sql
```

If step 3 fails because of conflicting names, the down is incomplete.

## Migration history

| File | Purpose |
|------|---------|
| `001_create_opportunities` | Funding-radar core schema, RLS, indexes |
| `002_phase2_community_dashboard` | Communities, integrations, channels, message events, cohort snapshots, ingest log, RPC functions |
| `003_user_profiles_with_approval` | Invite-only `user_profiles`, `handle_new_user` trigger, `is_admin()` helper |
| `004_tagger_extended_fields` | Five new tagger columns + partial indexes |
| `005_fix_user_profiles_rls` | First-pass RLS fix: admin WITH CHECK, self-update policy, column immutability trigger |
| `005_user_profiles_rls_hardening` | Hardened trigger that uses `auth.role()` and raises explicit exceptions for non-admin column mutation |
