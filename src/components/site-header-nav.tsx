"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowRight,
  Flame,
  LogOut,
  Menu,
  Shield,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export type SiteHeaderStatus = "anonymous" | "pending" | "approved" | "rejected";

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  matchPrefix: string;
  badge?: number;
  isAdmin?: boolean;
};

export function SiteHeaderNav({
  status,
  isAdmin,
  email,
  pendingCount,
}: {
  status: SiteHeaderStatus;
  isAdmin: boolean;
  email: string | null;
  pendingCount: number;
}) {
  const pathname = usePathname() ?? "/";
  const [mobileOpen, setMobileOpen] = useState(false);

  const isApproved = status === "approved";
  const logoHref = isApproved ? "/opportunities" : "/";

  const navItems: NavItem[] = isApproved
    ? [
        {
          label: "Funding Radar",
          href: "/opportunities",
          icon: Sparkles,
          matchPrefix: "/opportunities",
        },
        ...(isAdmin
          ? [
              {
                label: "Admin",
                href: "/admin",
                icon: Shield,
                matchPrefix: "/admin",
                badge: pendingCount > 0 ? pendingCount : undefined,
                isAdmin: true,
              } satisfies NavItem,
            ]
          : []),
      ]
    : [];

  const itemActive = (item: NavItem) => {
    if (item.href === "/opportunities" && pathname.startsWith("/opp/")) {
      return true;
    }
    return pathname === item.matchPrefix || pathname.startsWith(item.matchPrefix + "/");
  };

  const showAuthControls = status !== "anonymous";

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-sm">
      <div className="container flex h-16 items-center justify-between gap-4">
        <Link href={logoHref} className="flex shrink-0 items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg hearth-gradient text-white">
            <Flame className="h-5 w-5" />
          </div>
          <div className="hidden sm:flex sm:flex-col">
            <span className="text-lg font-bold leading-tight tracking-tight text-foreground">
              Hearth
            </span>
            <span className="text-[11px] font-medium leading-tight text-muted-foreground">
              Funding Radar
            </span>
          </div>
          <span className="text-lg font-bold tracking-tight sm:hidden">Hearth</span>
        </Link>

        {navItems.length > 0 && (
          <nav className="hidden md:flex md:flex-1 md:items-center md:gap-1 md:pl-6">
            {navItems.map((item) => {
              const active = itemActive(item);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-hearth-50 text-hearth-700"
                      : item.isAdmin
                        ? "text-hearth-700/80 hover:bg-hearth-50/60 hover:text-hearth-700"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                  {item.badge !== undefined && (
                    <Badge
                      variant="secondary"
                      className={cn(
                        "ml-1 h-5 min-w-[1.25rem] px-1.5 text-xs",
                        active
                          ? "bg-hearth-100 text-hearth-700"
                          : "bg-hearth-50 text-hearth-700",
                      )}
                    >
                      {item.badge}
                    </Badge>
                  )}
                </Link>
              );
            })}
          </nav>
        )}

        <div className="flex items-center gap-2">
          {status === "anonymous" && (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href="/auth/login">Sign in</Link>
              </Button>
              <Button asChild size="sm" className="gap-1.5">
                <Link href="/auth/signup">
                  Request access
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </>
          )}

          {showAuthControls && (
            <>
              {email && (
                <span className="hidden max-w-[14rem] truncate text-xs text-muted-foreground lg:inline-block">
                  {email}
                </span>
              )}
              <form action="/auth/signout" method="POST" className="hidden md:block">
                <Button variant="ghost" size="sm" type="submit" className="gap-1.5">
                  <LogOut className="h-4 w-4" />
                  Sign out
                </Button>
              </form>
            </>
          )}

          {(navItems.length > 0 || showAuthControls) && (
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="md:hidden"
                  aria-label="Open navigation menu"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[85vw] max-w-xs p-0">
                <div className="flex h-full flex-col">
                  <div className="flex h-16 items-center gap-2.5 border-b px-5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg hearth-gradient text-white">
                      <Flame className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-bold">Hearth</span>
                  </div>
                  <nav className="flex-1 space-y-1 p-3">
                    {navItems.map((item) => {
                      const active = itemActive(item);
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMobileOpen(false)}
                          className={cn(
                            "flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                            active
                              ? "bg-hearth-50 text-hearth-700"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground",
                          )}
                        >
                          <span className="flex items-center gap-2.5">
                            <Icon className="h-4 w-4" />
                            {item.label}
                          </span>
                          {item.badge !== undefined && (
                            <Badge
                              variant="secondary"
                              className={cn(
                                "h-5 min-w-[1.25rem] px-1.5 text-xs",
                                active && "bg-hearth-100 text-hearth-700",
                              )}
                            >
                              {item.badge}
                            </Badge>
                          )}
                        </Link>
                      );
                    })}
                  </nav>
                  {showAuthControls && (
                    <div className="space-y-2 border-t p-3">
                      {email && (
                        <p className="truncate px-2 text-xs text-muted-foreground">
                          {email}
                        </p>
                      )}
                      <form action="/auth/signout" method="POST">
                        <Button
                          variant="ghost"
                          size="sm"
                          type="submit"
                          className="w-full justify-start gap-1.5"
                        >
                          <LogOut className="h-4 w-4" />
                          Sign out
                        </Button>
                      </form>
                    </div>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          )}
        </div>
      </div>
    </header>
  );
}
