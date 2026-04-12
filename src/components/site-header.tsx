"use client";

import Link from "next/link";
import { Flame } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur-sm">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
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

        <nav className="flex items-center gap-4">
          <span className="hidden sm:inline-block text-xs text-muted-foreground">
            For women founders
          </span>
        </nav>
      </div>
    </header>
  );
}
