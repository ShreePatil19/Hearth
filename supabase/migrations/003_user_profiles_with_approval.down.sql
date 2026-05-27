-- Reverses 003_user_profiles_with_approval.sql
-- Removes the user_profiles table, the auth.users trigger that auto-creates
-- profiles, and the helper functions. CASCADE on the table drops the RLS
-- policies and the status index implicitly.

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.is_admin();
DROP TABLE IF EXISTS public.user_profiles CASCADE;
