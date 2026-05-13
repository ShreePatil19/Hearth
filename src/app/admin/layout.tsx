import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/site-header";
import { AdminChrome } from "./_components/admin-chrome";
import { AdminSubnav } from "./_components/admin-subnav";

// Gated by middleware for everything except /admin/login — AdminChrome strips
// the shell for that route so the dark pre-auth design stands alone.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Pre-fetch pending count so the sub-nav badge renders without a flash.
  // RLS lets admins see all rows; on /admin/login (anonymous) this returns null
  // and AdminChrome discards the chrome anyway.
  const supabase = await createClient();
  const { count: pendingCount } = await supabase
    .from("user_profiles")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  return (
    <AdminChrome
      header={<SiteHeader />}
      subnav={<AdminSubnav pendingCount={pendingCount ?? 0} />}
    >
      {children}
    </AdminChrome>
  );
}
