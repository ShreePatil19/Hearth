-- ============================================================
-- Reverse 006: restore PUBLIC execute and default search_path
-- ============================================================
-- Restores the migration-002 default (functions callable by PUBLIC, no pinned
-- search_path). Drops the explicit service_role grant added by the up migration.

-- store_integration(UUID, TEXT, TEXT, TEXT, TEXT[], TEXT, TEXT, UUID, TEXT)
ALTER FUNCTION public.store_integration(UUID, TEXT, TEXT, TEXT, TEXT[], TEXT, TEXT, UUID, TEXT) RESET search_path;
REVOKE EXECUTE ON FUNCTION public.store_integration(UUID, TEXT, TEXT, TEXT, TEXT[], TEXT, TEXT, UUID, TEXT) FROM service_role;
GRANT EXECUTE ON FUNCTION public.store_integration(UUID, TEXT, TEXT, TEXT, TEXT[], TEXT, TEXT, UUID, TEXT) TO PUBLIC;

-- get_decrypted_token(UUID, TEXT)
ALTER FUNCTION public.get_decrypted_token(UUID, TEXT) RESET search_path;
REVOKE EXECUTE ON FUNCTION public.get_decrypted_token(UUID, TEXT) FROM service_role;
GRANT EXECUTE ON FUNCTION public.get_decrypted_token(UUID, TEXT) TO PUBLIC;

-- get_shared_dashboard(UUID)
ALTER FUNCTION public.get_shared_dashboard(UUID) RESET search_path;
REVOKE EXECUTE ON FUNCTION public.get_shared_dashboard(UUID) FROM service_role;
GRANT EXECUTE ON FUNCTION public.get_shared_dashboard(UUID) TO PUBLIC;

-- revoke_community(UUID)
ALTER FUNCTION public.revoke_community(UUID) RESET search_path;
REVOKE EXECUTE ON FUNCTION public.revoke_community(UUID) FROM service_role;
GRANT EXECUTE ON FUNCTION public.revoke_community(UUID) TO PUBLIC;
