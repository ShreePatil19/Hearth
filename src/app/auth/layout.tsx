import { Flame } from "lucide-react";
import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-orange-50 to-background px-4">
      <Link href="/" className="mb-8 flex items-center gap-2.5">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-orange-400 to-orange-600 text-white">
          <Flame className="h-6 w-6" />
        </div>
        <div className="flex flex-col">
          <span className="text-xl font-bold tracking-tight">Hearth</span>
          <span className="text-xs text-muted-foreground">Community Dashboard</span>
        </div>
      </Link>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
