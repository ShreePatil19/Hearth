"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type Tab = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
  badge?: number;
};

export function AdminSubnav({ pendingCount }: { pendingCount: number }) {
  const pathname = usePathname() ?? "";

  const tabs: Tab[] = [
    { label: "Overview", href: "/admin", icon: LayoutDashboard, exact: true },
    {
      label: "Members",
      href: "/admin/members",
      icon: Users,
      badge: pendingCount > 0 ? pendingCount : undefined,
    },
  ];

  return (
    <div className="border-b bg-background">
      <div className="container flex h-12 items-center gap-1 overflow-x-auto">
        {tabs.map((tab) => {
          const active = tab.exact
            ? pathname === tab.href
            : pathname === tab.href || pathname.startsWith(tab.href + "/");
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex h-12 shrink-0 items-center gap-1.5 border-b-2 px-3 text-sm font-medium transition-colors",
                active
                  ? "border-primary text-hearth-700"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              {tab.badge !== undefined && (
                <Badge
                  variant="secondary"
                  className={cn(
                    "ml-0.5 h-5 min-w-[1.25rem] px-1.5 text-xs",
                    active ? "bg-hearth-100 text-hearth-700" : "bg-hearth-50 text-hearth-700",
                  )}
                >
                  {tab.badge}
                </Badge>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
