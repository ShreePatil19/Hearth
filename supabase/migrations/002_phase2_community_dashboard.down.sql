-- Reverses 002_phase2_community_dashboard.sql
-- Drops all six community dashboard tables (CASCADE handles indexes, RLS
-- policies, and FK chains across cohort_snapshots, ingest_log, message_events,
-- channels, integrations, communities) and the four RPC functions defined
-- alongside them. Leaves the pgcrypto and moddatetime extensions in place
-- since they may be used by other migrations.

DROP FUNCTION IF EXISTS public.revoke_community(UUID);
DROP FUNCTION IF EXISTS public.get_shared_dashboard(UUID);
DROP FUNCTION IF EXISTS public.get_decrypted_token(UUID, TEXT);
DROP FUNCTION IF EXISTS public.store_integration(UUID, TEXT, TEXT, TEXT, TEXT[], TEXT, TEXT, UUID, TEXT);

DROP TRIGGER IF EXISTS communities_updated_at ON public.communities;

DROP TABLE IF EXISTS public.ingest_log CASCADE;
DROP TABLE IF EXISTS public.cohort_snapshots CASCADE;
DROP TABLE IF EXISTS public.message_events CASCADE;
DROP TABLE IF EXISTS public.channels CASCADE;
DROP TABLE IF EXISTS public.integrations CASCADE;
DROP TABLE IF EXISTS public.communities CASCADE;
