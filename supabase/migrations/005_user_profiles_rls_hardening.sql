-- Hearth — user_profiles RLS hardening (closes #17)
-- 1. Add explicit WITH CHECK to admin UPDATE policy (defends against future
--    USING/CHECK divergence — Postgres implicit default is fragile).
-- 2. Add a self-update policy so users can edit their own display_name.
-- 3. BEFORE UPDATE trigger locks privileged columns (is_admin, status,
--    approved_at, approved_by, user_id, created_at) for non-admin callers.
-- Run this in the Supabase Dashboard SQL Editor against hearth-prod.

-- ============================================================
-- 1. Replace admin UPDATE policy with explicit WITH CHECK
-- ============================================================

DROP POLICY IF EXISTS "user_profiles_admin_update" ON public.user_profiles;

CREATE POLICY "user_profiles_admin_update" ON public.user_profiles FOR UPDATE
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

-- ============================================================
-- 2. Self-update policy — user can update their own profile row.
-- Column-level immutability is enforced by the trigger below; RLS
-- only checks row ownership.
-- ============================================================

DROP POLICY IF EXISTS "user_profiles_self_update" ON public.user_profiles;

CREATE POLICY "user_profiles_self_update" ON public.user_profiles FOR UPDATE
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- ============================================================
-- 3. Trigger: lock privileged columns for non-admin callers
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_user_profile_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- service_role bypasses (backfills, admin scripts), and admins via
  -- authenticated session (is_admin flag) keep full write access.
  IF current_user = 'service_role' OR (SELECT public.is_admin()) THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'user_profiles.user_id is immutable';
  END IF;
  IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
    RAISE EXCEPTION 'user_profiles.is_admin can only be changed by an admin';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'user_profiles.status can only be changed by an admin';
  END IF;
  IF NEW.approved_at IS DISTINCT FROM OLD.approved_at THEN
    RAISE EXCEPTION 'user_profiles.approved_at can only be changed by an admin';
  END IF;
  IF NEW.approved_by IS DISTINCT FROM OLD.approved_by THEN
    RAISE EXCEPTION 'user_profiles.approved_by can only be changed by an admin';
  END IF;
  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'user_profiles.created_at is immutable';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_user_profile_immutable_trigger ON public.user_profiles;
CREATE TRIGGER enforce_user_profile_immutable_trigger
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_user_profile_immutable();
