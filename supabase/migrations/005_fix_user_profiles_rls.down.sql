-- Reverses 005_fix_user_profiles_rls.sql
-- Drops the column-immutability trigger and the self-update policy added by
-- the fix migration, then restores the original admin UPDATE policy (without
-- WITH CHECK) so the state matches migration 003.

DROP TRIGGER IF EXISTS trg_enforce_profile_immutable_columns ON public.user_profiles;
DROP FUNCTION IF EXISTS public.enforce_profile_immutable_columns();

DROP POLICY IF EXISTS "user_profiles_self_update" ON public.user_profiles;

DROP POLICY IF EXISTS "user_profiles_admin_update" ON public.user_profiles;
CREATE POLICY "user_profiles_admin_update" ON public.user_profiles FOR UPDATE
  USING ((SELECT public.is_admin()));
