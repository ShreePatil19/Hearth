import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="container mx-auto flex flex-1 flex-col items-center justify-center px-4 py-16">
        <h2 className="text-2xl font-bold">Opportunity Not Found</h2>
        <p className="mt-2 text-muted-foreground">
          This opportunity may have been removed or the link may be incorrect.
        </p>
        <Button asChild className="mt-6">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to all opportunities
          </Link>
        </Button>
      </main>
      <SiteFooter />
    </div>
  );
}
