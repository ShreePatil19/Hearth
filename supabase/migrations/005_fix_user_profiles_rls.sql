-- Fix P0 #17: user_profiles UPDATE policy missing WITH CHECK clause
--
-- 1. Replace admin update policy with WITH CHECK (prevent user_id mutation)
-- 2. Add self-update policy so users can edit their own display_name
-- 3. Add BEFORE UPDATE trigger to enforce column immutability for non-admins

-- ============================================================
-- 1. Fix admin update policy — add WITH CHECK
-- ============================================================

DROP POLICY IF EXISTS "user_profiles_admin_update" ON public.user_profiles;

CREATE POLICY "user_profiles_admin_update" ON public.user_profiles
  FOR UPDATE
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

-- ============================================================
-- 2. Self-update policy — users can update their own row
-- ============================================================

CREATE POLICY "user_profiles_self_update" ON public.user_profiles
  FOR UPDATE
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- ============================================================
-- 3. Column immutability trigger for non-admin updates
--    Non-admins cannot change: is_admin, status, approved_by, approved_at
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_profile_immutable_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    NEW.is_admin    := OLD.is_admin;
    NEW.status      := OLD.status;
    NEW.approved_by := OLD.approved_by;
    NEW.approved_at := OLD.approved_at;
  END IF;

  -- user_id is the PK — never allow mutation regardless of role
  NEW.user_id := OLD.user_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_profile_immutable_columns
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_profile_immutable_columns();
