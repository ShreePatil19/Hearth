import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch (error) {
            // Next.js throws when cookies are set during a Server Component render.
            // Route Handlers and Server Actions can set cookies safely; the
            // @supabase/ssr docs recommend swallowing in the render context only.
            if (process.env.NODE_ENV !== "production") {
              console.warn(
                "[supabase/server] cookie write skipped:",
                error instanceof Error ? error.message : error
              );
            }
          }
        },
      },
    }
  );
}
