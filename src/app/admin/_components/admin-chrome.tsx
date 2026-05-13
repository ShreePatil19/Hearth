"use client";

import { usePathname } from "next/navigation";

// /admin/login bypasses the unified shell — it has its own pre-auth full-bleed
// dark theme. Every other /admin/* route renders the SiteHeader + sub-nav strip.
export function AdminChrome({
  header,
  subnav,
  children,
}: {
  header: React.ReactNode;
  subnav: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      {header}
      {subnav}
      <main className="flex-1">{children}</main>
    </div>
  );
}
