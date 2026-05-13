-- Hearth Phase 3 — User Profiles with Admin Approval
-- Adds invite-only access: new signups land in 'pending' until an admin approves them.
-- Run this in the Supabase Dashboard SQL Editor.

-- ============================================================
-- TABLE
-- ============================================================

CREATE TABLE public.user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  is_admin BOOLEAN NOT NULL DEFAULT false,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_user_profiles_status ON public.user_profiles(status);

-- ============================================================
-- TRIGGER: auto-create profile on new auth.users INSERT
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, status, is_admin)
  VALUES (NEW.id, 'pending', false)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- HELPER: is_admin() — SECURITY DEFINER to bypass RLS in policies
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.user_profiles WHERE user_id = auth.uid()),
    false
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Users see their own profile
CREATE POLICY "user_profiles_self_select" ON public.user_profiles FOR SELECT
  USING (user_id = (SELECT auth.uid()));

-- Admins see all profiles
CREATE POLICY "user_profiles_admin_select" ON public.user_profiles FOR SELECT
  USING ((SELECT public.is_admin()));

-- Admins update any profile (e.g. flip status, toggle is_admin)
CREATE POLICY "user_profiles_admin_update" ON public.user_profiles FOR UPDATE
  USING ((SELECT public.is_admin()));

-- Service role bypasses RLS — used by backfill, demo seed, and admin scripts

-- ============================================================
-- BACKFILL: any pre-existing user (e.g. demo seed) gets an approved profile
-- so existing flows don't break. Pending status only applies to NEW signups
-- post-migration.
-- ============================================================

INSERT INTO public.user_profiles (user_id, status, is_admin, approved_at)
SELECT id, 'approved', false, now()
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;
