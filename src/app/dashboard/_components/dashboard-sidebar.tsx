"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, LogOut, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

type Community = {
  id: string;
  name: string;
};

export function DashboardSidebar({
  communities,
  email,
}: {
  communities: Community[];
  email: string | null;
}) {
  const pathname = usePathname() ?? "";

  return (
    <>
      <nav className="flex-1 p-3 space-y-1">
        <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Communities
        </p>

        {communities.map((community) => {
          const isActive = pathname.includes(community.id);
          return (
            <Link
              key={community.id}
              href={`/dashboard/${community.id}`}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                isActive
                  ? "bg-hearth-50 text-hearth-700 font-medium"
                  : "hover:bg-hearth-50 text-foreground"
              }`}
            >
              <LayoutDashboard className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <span className="truncate">{community.name}</span>
            </Link>
          );
        })}

        {communities.length === 0 && (
          <p className="px-2 py-1 text-xs text-muted-foreground">
            No communities connected yet
          </p>
        )}

        <Separator className="my-2" />

        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-hearth-600"
          asChild
        >
          <a href="/api/slack/install">
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            Connect Slack
          </a>
        </Button>
      </nav>

      <div className="p-3 border-t">
        {email && (
          <p className="px-2 mb-2 text-xs text-muted-foreground truncate">{email}</p>
        )}
        <form action="/auth/signout" method="POST">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground"
            type="submit"
          >
            <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
            Sign Out
          </Button>
        </form>
      </div>
    </>
  );
}
