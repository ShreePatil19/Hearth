import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client for API routes.
 * Bypasses RLS — use only in server-side API routes and cron jobs.
 * NEVER import this in client components or server components.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
