import Link from "next/link";
import { Flame } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="border-t bg-white">
      <div className="container py-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Flame className="h-4 w-4 text-orange-400" />
            <span className="text-sm font-medium">Hearth</span>
          </div>
          <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
            Hearth is a discovery tool, not legal or financial advice. Always
            verify eligibility and details on the original source site.
          </p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground/60">
            <span>Data refreshed daily</span>
            <span>&middot;</span>
            <Link href="/privacy" className="hover:text-orange-600 transition-colors">
              Privacy
            </Link>
            <span>&middot;</span>
            <span>Built for women founders</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
