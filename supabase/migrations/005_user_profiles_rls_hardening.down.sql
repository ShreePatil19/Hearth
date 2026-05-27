-- Reverses 005_user_profiles_rls_hardening.sql
-- Drops the hardening trigger and function added on top of the fix migration.
-- The admin and self-update policies are left in place; their WITH CHECK
-- clauses were already established by the prior fix migration and remain
-- safe to keep. If a full rollback below the fix migration is needed, apply
-- 005_fix_user_profiles_rls.down.sql next.

DROP TRIGGER IF EXISTS enforce_user_profile_immutable_trigger ON public.user_profiles;
DROP FUNCTION IF EXISTS public.enforce_user_profile_immutable();
