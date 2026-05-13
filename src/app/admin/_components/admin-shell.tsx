"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Flame, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminSidebar } from "./admin-sidebar";

// /admin/login is public + has its own full-bleed design — render children
// without the admin chrome. Every other /admin/* route gets sidebar + header.
export function AdminShell({
  pendingCount,
  children,
}: {
  pendingCount: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-muted/30">
      <AdminSidebar pendingCount={pendingCount} />

      <div className="flex flex-1 flex-col">
        {/* Mobile-only header (sidebar is hidden below md) */}
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
