import Link from "next/link";
import { Flame, LayoutDashboard } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { AdminSidebar } from "./_components/admin-sidebar";

// Gated by middleware — auth + status=approved + is_admin=true required.

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Pre-fetch the pending count so the sidebar badge can render with the page
  // (saves a flash of zero on first paint).
  const supabase = await createClient();
  const { count: pendingCount } = await supabase
    .from("user_profiles")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  return (
    <div className="flex min-h-screen bg-muted/30">
      <AdminSidebar pendingCount={pendingCount ?? 0} />

      <div className="flex flex-1 flex-col">
        {/* Mobile-only header (sidebar is hidden on mobile) */}
        <header className="flex h-16 items-center justify-between border-b bg-card px-4 md:hidden">
          <Link href="/admin" className="flex items-center gap-2 font-semibold">
            <Flame className="h-5 w-5 text-orange-600" />
            <span>Hearth Admin</span>
          </Link>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard" className="gap-1.5">
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Link>
          </Button>
        </header>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
