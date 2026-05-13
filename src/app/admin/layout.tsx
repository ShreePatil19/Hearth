import Link from "next/link";
import { Flame, LayoutDashboard, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

// Admin routes are gated by middleware (auth + status=approved + is_admin=true).
// This layout just provides chrome — assume the user is authorized.

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b">
        <div className="container flex h-14 items-center justify-between">
          <Link href="/admin" className="flex items-center gap-2 font-semibold">
            <Flame className="h-5 w-5 text-orange-600" />
            <span>Hearth Admin</span>
          </Link>
          <nav className="flex items-center gap-1">
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin/members" className="gap-2">
                <Users className="h-4 w-4" />
                Members
              </Link>
            </Button>
            <Separator orientation="vertical" className="mx-2 h-5" />
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard" className="gap-2">
                <LayoutDashboard className="h-4 w-4" />
                Back to dashboard
              </Link>
            </Button>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
