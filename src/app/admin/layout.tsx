import { createClient } from "@/lib/supabase/server";
import { AdminShell } from "./_components/admin-shell";

// Gated by middleware for everything except /admin/login (handled inside
// AdminShell, which renders bare children on that route).
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Pre-fetch pending count so the sidebar badge renders without a flash.
  // RLS lets admins see all rows; for the /admin/login (anonymous) request
  // this returns null and AdminShell discards the chrome anyway.
  const supabase = await createClient();
  const { count: pendingCount } = await supabase
    .from("user_profiles")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  return <AdminShell pendingCount={pendingCount ?? 0}>{children}</AdminShell>;
}
