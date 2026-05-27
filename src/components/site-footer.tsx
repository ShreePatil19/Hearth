import Link from "next/link";
import { Flame } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="border-t bg-card">
      <div className="container py-10">
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md hearth-gradient text-white">
              <Flame className="h-3.5 w-3.5" aria-hidden="true" />
            </div>
            <span className="text-sm font-bold tracking-tight">Hearth</span>
          </div>
          <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
            Hearth is a discovery tool, not legal or financial advice. Always
            verify eligibility and details on the original source site.
          </p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground/60">
            <span>Data refreshed daily</span>
            <span className="h-3 w-px bg-border" />
            <Link
              href="/privacy"
              className="transition-colors hover:text-foreground"
            >
              Privacy
            </Link>
            <span className="h-3 w-px bg-border" />
            <span>Built for women founders</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
