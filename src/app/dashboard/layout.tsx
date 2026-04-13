import { redirect } from "next/navigation";
import Link from "next/link";
import { Flame, LayoutDashboard, LogOut, Plus, Menu } from "lucide-react";
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
import { headers } from "next/headers";

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

  // Get current path for active state
  const headersList = await headers();
  const pathname = headersList.get("x-next-url") || "";

  const sidebarContent = (
    <>
      <nav className="flex-1 p-3 space-y-1">
        <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Communities
        </p>

        {communities?.map((community) => {
          const isActive = pathname.includes(community.id);
          return (
            <Link
              key={community.id}
              href={`/dashboard/${community.id}`}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                isActive
                  ? "bg-orange-50 text-orange-700 font-medium"
                  : "hover:bg-orange-50 text-foreground"
              }`}
            >
              <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">{community.name}</span>
            </Link>
          );
        })}

        {(!communities || communities.length === 0) && (
          <p className="px-2 py-1 text-xs text-muted-foreground">
            No communities connected yet
          </p>
        )}

        <Separator className="my-2" />

        <Button variant="ghost" size="sm" className="w-full justify-start text-orange-600" asChild>
          <a href="/api/slack/install">
            <Plus className="mr-2 h-4 w-4" />
            Connect Slack
          </a>
        </Button>
      </nav>

      <div className="p-3 border-t">
        <p className="px-2 mb-2 text-xs text-muted-foreground truncate">{user.email}</p>
        <form action="/auth/signout" method="POST">
          <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" type="submit">
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </form>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Mobile top bar */}
      <header className="flex md:hidden items-center justify-between border-b bg-white px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-400 to-orange-600 text-white">
            <Flame className="h-4 w-4" />
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
                <Flame className="h-4 w-4 text-orange-500" />
                Dashboard
              </SheetTitle>
            </SheetHeader>
            <div className="flex flex-col h-full">{sidebarContent}</div>
          </SheetContent>
        </Sheet>
      </header>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r bg-white">
        <div className="p-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-400 to-orange-600 text-white">
              <Flame className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold">Hearth</span>
              <span className="text-[10px] text-muted-foreground">Community Dashboard</span>
            </div>
          </Link>
        </div>
        <Separator />
        {sidebarContent}
      </aside>

      {/* Main content */}
      <main className="flex-1 bg-background">
        {children}
      </main>
    </div>
  );
}
