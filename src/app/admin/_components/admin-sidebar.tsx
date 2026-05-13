"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  Flame,
  LayoutDashboard,
  Sparkles,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
};

export function AdminSidebar({ pendingCount }: { pendingCount: number }) {
  const pathname = usePathname();

  const items: NavItem[] = [
    { label: "Overview", href: "/admin", icon: LayoutDashboard },
    {
      label: "Members",
      href: "/admin/members",
      icon: Users,
      badge: pendingCount > 0 ? pendingCount : undefined,
    },
  ];

  return (
    <aside className="hidden md:flex md:w-60 md:flex-col md:border-r md:bg-card">
      <div className="flex h-16 items-center gap-2.5 border-b px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-400 to-orange-600 text-white">
          <Flame className="h-4 w-4" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-bold leading-tight">Hearth</span>
          <span className="text-[11px] font-medium leading-tight text-muted-foreground">
            Admin console
          </span>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {items.map((item) => {
          const active =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-orange-50 text-orange-700"
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
                    active && "bg-orange-100 text-orange-700",
                  )}
                >
                  {item.badge}
                </Badge>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-1 border-t p-3">
        <p className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Switch view
        </p>
        <Link
          href="/opportunities"
          className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Sparkles className="h-4 w-4" />
          Funding Radar
        </Link>
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Community dashboard
        </Link>
      </div>
    </aside>
  );
}
