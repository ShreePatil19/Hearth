import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b bg-white">
      <div className="container mx-auto flex items-center justify-between px-4 py-4">
        <Link href="/" className="flex items-baseline gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Hearth</h1>
          <span className="text-sm text-muted-foreground">Funding Radar</span>
        </Link>
      </div>
    </header>
  );
}
