-- ============================================================
-- 006: Lock down SECURITY DEFINER RPC execution + pin search_path
-- ============================================================
-- The four SECURITY DEFINER functions created in migration 002 were callable
-- by PUBLIC (the Postgres default), so any anon/authenticated PostgREST caller
-- could invoke them and bypass RLS. revoke_community is the worst case: it
-- cascade-deletes an entire community with no in-function authorization.
--
-- Every legitimate caller in the app uses the service_role (admin) client:
--   store_integration    -> src/app/api/slack/callback/route.ts
--   get_decrypted_token  -> src/app/api/cron/ingest-slack/route.ts
--   get_shared_dashboard -> src/app/dashboard/share/[shareToken]/page.tsx
--   revoke_community     -> src/app/dashboard/[communityId]/settings/actions.ts
-- so we revoke EXECUTE from PUBLIC and grant it only to service_role.
--
-- search_path is pinned to (public, extensions) rather than (public) alone:
-- migration 002 runs `CREATE EXTENSION IF NOT EXISTS pgcrypto` without a SCHEMA
-- clause, so pgp_sym_encrypt / pgp_sym_decrypt may resolve from either public
-- or the extensions schema. Including both keeps the crypto calls resolvable
-- while still removing "$user" and arbitrary schemas from the path.
--
-- NOTE: ownership for revoke_community is enforced at the application layer
-- (requireOwner in settings/actions.ts). An auth.uid() check is deliberately
-- NOT added inside the function: it runs under service_role where auth.uid()
-- is NULL, which would break the legitimate call path. Revoking PUBLIC execute
-- already closes the "any authenticated user can call it" hole.

-- store_integration(UUID, TEXT, TEXT, TEXT, TEXT[], TEXT, TEXT, UUID, TEXT)
ALTER FUNCTION public.store_integration(UUID, TEXT, TEXT, TEXT, TEXT[], TEXT, TEXT, UUID, TEXT)
  SET search_path = public, extensions;
REVOKE EXECUTE ON FUNCTION public.store_integration(UUID, TEXT, TEXT, TEXT, TEXT[], TEXT, TEXT, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.store_integration(UUID, TEXT, TEXT, TEXT, TEXT[], TEXT, TEXT, UUID, TEXT) TO service_role;

-- get_decrypted_token(UUID, TEXT)
ALTER FUNCTION public.get_decrypted_token(UUID, TEXT)
  SET search_path = public, extensions;
REVOKE EXECUTE ON FUNCTION public.get_decrypted_token(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_decrypted_token(UUID, TEXT) TO service_role;

-- get_shared_dashboard(UUID)
ALTER FUNCTION public.get_shared_dashboard(UUID)
  SET search_path = public, extensions;
REVOKE EXECUTE ON FUNCTION public.get_shared_dashboard(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_dashboard(UUID) TO service_role;

-- revoke_community(UUID)
ALTER FUNCTION public.revoke_community(UUID)
  SET search_path = public, extensions;
REVOKE EXECUTE ON FUNCTION public.revoke_community(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_community(UUID) TO service_role;
