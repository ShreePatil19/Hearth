import Link from "next/link";
import { Clock, Mail } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Account under review · Hearth",
};

export default function PendingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="container flex-1 py-16 md:py-24">
        <div className="mx-auto max-w-md space-y-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-orange-50 text-orange-600">
            <Clock className="h-7 w-7" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              Your account is under review
            </h1>
            <p className="text-muted-foreground">
              Hearth is currently invite-only. We&rsquo;ve received your signup
              and an admin will approve your account shortly. You&rsquo;ll be
              able to sign in and access the funding radar once approved.
            </p>
          </div>

          <div className="rounded-lg border bg-card p-4 text-sm text-left">
            <div className="flex items-start gap-3">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="space-y-1">
                <p className="font-medium">Need to follow up?</p>
                <p className="text-muted-foreground">
                  Email{" "}
                  <a
                    href="mailto:hearth@fishburners.org"
                    className="text-foreground underline-offset-4 hover:underline"
                  >
                    hearth@fishburners.org
                  </a>{" "}
                  and we&rsquo;ll check on your application.
                </p>
              </div>
            </div>
          </div>

          <Button asChild variant="outline" className="w-full">
            <Link href="/">Back to home</Link>
          </Button>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
