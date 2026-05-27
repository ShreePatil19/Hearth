import { redirect } from "next/navigation";
import Link from "next/link";
import { Flame, Menu } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { DashboardSidebar } from "./_components/dashboard-sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: communities } = await supabase
    .from("communities")
    .select("id, name, platform, status")
    .eq("owner_user_id", user.id)
    .order("installed_at", { ascending: false });

  const sidebar = (
    <DashboardSidebar
      communities={communities ?? []}
      email={user.email ?? null}
    />
  );

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Mobile top bar */}
      <header className="flex md:hidden items-center justify-between border-b bg-background px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg hearth-gradient text-white">
            <Flame className="h-4 w-4" aria-hidden="true" />
          </div>
          <span className="text-sm font-bold">Hearth</span>
        </Link>

        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="sm" aria-label="Open navigation menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[85vw] max-w-xs p-0">
            <SheetHeader className="p-4 pb-0">
              <SheetTitle className="flex items-center gap-2 text-sm">
                <Flame className="h-4 w-4 text-hearth-500" aria-hidden="true" />
                Dashboard
              </SheetTitle>
            </SheetHeader>
            <div className="flex flex-col h-full">{sidebar}</div>
          </SheetContent>
        </Sheet>
      </header>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r bg-card">
        <div className="p-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg hearth-gradient text-white">
              <Flame className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold">Hearth</span>
              <span className="text-[10px] text-muted-foreground">Community Dashboard</span>
            </div>
          </Link>
        </div>
        <Separator />
        {sidebar}
      </aside>

      {/* Main content */}
      <main className="flex-1 bg-background">
        {children}
      </main>
    </div>
  );
}
