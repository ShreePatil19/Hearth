import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Flame,
  Lock,
  RefreshCw,
  Shield,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SiteFooter } from "@/components/site-footer";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Hearth — funding for women founders",
  description:
    "Curated grants, accelerators, pitch competitions, and funds for women founders. Invite-only access.",
};

// Public landing page. Logged-in approved users are forwarded straight to /opportunities.
// Logged-in pending users go to /auth/pending. Everyone else sees the marketing page.
export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("status")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profile?.status === "approved") {
      redirect("/opportunities");
    }
    if (profile?.status === "pending") {
      redirect("/auth/pending");
    }
    // 'rejected' or no profile → fall through to landing (they can read marketing
    // but signing in lands them on /auth/pending again)
  }

  // Public opportunity count for social proof (just a number, no rows exposed)
  const { count: oppCount } = await supabase
    .from("opportunities")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Lightweight public header (the gated SiteHeader is for inside-app pages) */}
      <header className="border-b">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-orange-400 to-orange-600 text-white">
              <Flame className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold tracking-tight">Hearth</span>
          </Link>
          <nav className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/auth/login">Sign in</Link>
            </Button>
            <Button asChild size="sm" className="gap-1.5">
              <Link href="/auth/signup">
                Request access
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="border-b bg-gradient-to-b from-orange-50 to-background">
          <div className="container py-16 md:py-24">
            <div className="mx-auto max-w-3xl space-y-6 text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white px-3 py-1 text-xs font-medium text-orange-700">
                <Sparkles className="h-3.5 w-3.5" />
                Invite-only · Fishburners community
              </div>
              <h1 className="text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
                Funding, curated for{" "}
                <span className="text-orange-500">women founders</span>
              </h1>
              <p className="mx-auto max-w-2xl text-lg text-muted-foreground md:text-xl">
                Hearth aggregates grants, accelerators, pitch competitions, and
                funds in one place. Refreshed daily so you never miss a deadline.
              </p>
              <div className="flex flex-col items-center justify-center gap-3 pt-2 sm:flex-row">
                <Button asChild size="lg" className="gap-2">
                  <Link href="/auth/signup">
                    Request access
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/auth/login">I already have an account</Link>
                </Button>
              </div>
              {oppCount !== null && oppCount !== undefined && (
                <p className="pt-4 text-sm text-muted-foreground">
                  Currently tracking{" "}
                  <span className="font-semibold text-foreground">
                    {oppCount} active opportunities
                  </span>{" "}
                  from 10 sources
                </p>
              )}
            </div>
          </div>
        </section>

        {/* What's inside */}
        <section className="container py-16 md:py-20">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center text-2xl font-semibold tracking-tight md:text-3xl">
              What members get access to
            </h2>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              <FeatureCard
                icon={<Sparkles className="h-5 w-5" />}
                title="Filterable funding radar"
                description="Browse grants, accelerators, pitch comps, and funds. Filter by stage, industry, geography. Search by anything."
              />
              <FeatureCard
                icon={<RefreshCw className="h-5 w-5" />}
                title="Refreshed daily"
                description="Scrapers run every morning to pull new opportunities and remove past deadlines. No more dead links."
              />
              <FeatureCard
                icon={<Users className="h-5 w-5" />}
                title="Community analytics"
                description="If you run a women-founder Slack community, plug it in for privacy-first engagement insights."
              />
            </div>
          </div>
        </section>

        {/* For community managers */}
        <section className="border-t bg-white">
          <div className="container py-16 md:py-20">
            <div className="mx-auto max-w-3xl text-center">
              <div className="inline-flex items-center gap-2 rounded-full bg-orange-100 px-3 py-1 text-xs font-medium text-orange-700">
                <Shield className="h-3.5 w-3.5" />
                Privacy-first analytics
              </div>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight md:text-3xl">
                Running a women-founder community?
              </h2>
              <p className="mt-3 text-base text-muted-foreground">
                Plug in your Slack for free engagement analytics — without ever
                touching a message.
              </p>
            </div>

            <div className="mx-auto mt-10 grid max-w-4xl gap-6 md:grid-cols-2">
              <Card className="border-orange-200 bg-orange-50/30">
                <CardContent className="pt-6">
                  <div className="mb-4 flex items-center gap-2">
                    <Eye className="h-5 w-5 text-orange-500" />
                    <h3 className="text-lg font-semibold">What you see</h3>
                  </div>
                  <ul className="space-y-2.5">
                    {[
                      "Daily, weekly, monthly active users",
                      "Message volume trends over time",
                      "Most active channels",
                      "Top contributors (anonymous ranks)",
                      "Cohort retention week over week",
                      "Shareable dashboard for board reports",
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-green-200 bg-green-50/30">
                <CardContent className="pt-6">
                  <div className="mb-4 flex items-center gap-2">
                    <EyeOff className="h-5 w-5 text-green-600" />
                    <h3 className="text-lg font-semibold">What we never touch</h3>
                  </div>
                  <ul className="space-y-2.5">
                    {[
                      "Message content — never read or stored",
                      "Direct messages — zero access",
                      "Real names or emails — IDs are hashed",
                      "Files and attachments — not accessed",
                      "Channels you don't opt in — ignored",
                      "Data sold to third parties — never",
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm">
                        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Access note */}
        <section className="border-t bg-muted/30">
          <div className="container py-12">
            <div className="mx-auto flex max-w-2xl items-start gap-4 rounded-lg border bg-card p-6">
              <Lock className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" />
              <div className="space-y-1">
                <p className="font-medium">Invite-only access</p>
                <p className="text-sm text-muted-foreground">
                  Hearth is currently in pilot with the Fishburners community.
                  Sign up to request access — an admin will review and approve
                  within a few business days. Already a member?{" "}
                  <Link
                    href="/auth/login"
                    className="font-medium text-foreground underline-offset-4 hover:underline"
                  >
                    Sign in here
                  </Link>
                  .
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
        {icon}
      </div>
      <h3 className="mb-2 font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
