"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flame, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

type Section = "opportunities" | "dashboard" | "admin" | null;

function pathnameToSection(pathname: string): Section {
  if (pathname.startsWith("/opportunities") || pathname.startsWith("/opp/"))
    return "opportunities";
  if (pathname.startsWith("/dashboard")) return "dashboard";
  if (pathname.startsWith("/admin")) return "admin";
  return null;
}

export function SiteHeader() {
  const pathname = usePathname();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setIsLoggedIn(!!session);
      if (session?.user) {
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("is_admin")
          .eq("user_id", session.user.id)
          .maybeSingle();
        setIsAdmin(!!profile?.is_admin);
      }
    });
  }, []);

  const activeSection = pathnameToSection(pathname);

  return (
    <header className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur-sm">
      <div className="container flex h-16 items-center justify-between">
        <Link
          href={isLoggedIn ? "/opportunities" : "/"}
          className="flex items-center gap-2.5"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-orange-400 to-orange-600 text-white">
            <Flame className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold leading-tight tracking-tight text-foreground">
              Hearth
            </span>
            <span className="text-[11px] font-medium leading-tight text-muted-foreground">
              Funding Radar
            </span>
          </div>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          {isLoggedIn ? (
            <>
              <NavLink
                href="/opportunities"
                label="Funding Radar"
                active={activeSection === "opportunities"}
              />
              <NavLink
                href="/dashboard"
                label="Dashboard"
                active={activeSection === "dashboard"}
              />
              {isAdmin && (
                <NavLink
                  href="/admin"
                  label="Admin"
                  icon={<Shield className="h-3.5 w-3.5" />}
                  active={activeSection === "admin"}
                  emphasized
                />
              )}
            </>
          ) : (
            <Link
              href="/auth/login"
              className="text-sm font-medium text-orange-600 transition-colors hover:text-orange-700"
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

function NavLink({
  href,
  label,
  icon,
  active,
  emphasized,
}: {
  href: string;
  label: string;
  icon?: React.ReactNode;
  active: boolean;
  emphasized?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-orange-50 text-orange-700"
          : "text-muted-foreground hover:text-foreground",
        emphasized && !active && "text-orange-600 hover:text-orange-700",
      )}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}
