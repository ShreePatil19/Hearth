import { createClient } from "@/lib/supabase/server";
import { SiteHeaderNav, type SiteHeaderStatus } from "./site-header-nav";

// Unified top-nav rendered across the member app AND admin console.
// On /admin/* the layout renders an admin sub-nav strip below this header.
// /admin/login bypasses this entirely (it has its own pre-auth chrome).
export async function SiteHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let status: SiteHeaderStatus = "anonymous";
  let isAdmin = false;
  let pendingCount = 0;
  let email: string | null = null;

  if (user) {
    email = user.email ?? null;
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("is_admin, status")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profile) {
      status = (profile.status as SiteHeaderStatus) ?? "pending";
      isAdmin = !!profile.is_admin;
    } else {
      status = "pending";
    }

    if (isAdmin) {
      const { count } = await supabase
        .from("user_profiles")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");
      pendingCount = count ?? 0;
    }
  }

  return (
    <SiteHeaderNav
      status={status}
      isAdmin={isAdmin}
      email={email}
      pendingCount={pendingCount}
    />
  );
}
