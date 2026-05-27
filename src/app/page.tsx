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
  Search,
  Shield,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SiteFooter } from "@/components/site-footer";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Hearth - funding for women founders",
  description:
    "Curated grants, accelerators, pitch competitions, and funds for women founders. Invite-only access.",
};

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
  }

  const { count: oppCount } = await supabase
    .from("opportunities")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-sm">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg hearth-gradient text-white shadow-sm">
              <Flame className="h-5 w-5" aria-hidden="true" />
            </div>
            <span className="text-lg font-bold tracking-tight">Hearth</span>
          </Link>
          <nav aria-label="Site navigation" className="flex items-center gap-2">
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
        <section className="relative overflow-hidden border-b">
          <div className="absolute inset-0 hearth-gradient-subtle" />
          <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-hearth-200/30 blur-3xl" aria-hidden="true" />
          <div className="absolute -left-32 bottom-0 h-64 w-64 rounded-full bg-hearth-100/40 blur-3xl" aria-hidden="true" />
          <div className="container relative py-20 md:py-32">
            <div className="mx-auto max-w-3xl space-y-8 text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-hearth-200 bg-card/80 px-4 py-1.5 text-xs font-semibold tracking-wide text-hearth-700 backdrop-blur-sm">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                Invite-only for Fishburners community
              </div>
              <h1 className="text-balance text-4xl font-extrabold tracking-tight md:text-5xl lg:text-6xl">
                Funding, curated for{" "}
                <span className="bg-gradient-to-r from-hearth-500 to-hearth-700 bg-clip-text text-transparent">
                  women founders
                </span>
              </h1>
              <p className="mx-auto max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl">
                Grants, accelerators, pitch competitions, and funds in one
                searchable radar. Refreshed daily so you never miss a deadline.
              </p>
              <div className="flex flex-col items-center justify-center gap-3 pt-2 sm:flex-row">
                <Button asChild size="lg" className="gap-2 shadow-md">
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
                <div className="flex items-center justify-center gap-6 pt-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <TrendingUp className="h-4 w-4 text-hearth-500" aria-hidden="true" />
                    <strong className="font-semibold text-foreground">
                      {oppCount}
                    </strong>{" "}
                    active opportunities
                  </span>
                  <span className="h-4 w-px bg-border" />
                  <span className="flex items-center gap-1.5">
                    <RefreshCw className="h-3.5 w-3.5 text-hearth-500" aria-hidden="true" />
                    Updated daily
                  </span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="container py-20 md:py-24">
          <div className="mx-auto max-w-5xl">
            <div className="text-center">
              <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
                What members get access to
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
                Everything you need to discover and act on funding opportunities,
                in one place.
              </p>
            </div>
            <div className="mt-12 grid gap-4 md:grid-cols-3">
              <FeatureCard
                icon={<Search className="h-5 w-5" />}
                title="Filterable funding radar"
                description="Browse grants, accelerators, pitch comps, and funds. Filter by stage, industry, geography. Search by anything."
                accent="from-hearth-400 to-hearth-600"
              />
              <FeatureCard
                icon={<RefreshCw className="h-5 w-5" />}
                title="Refreshed daily"
                description="Scrapers run every morning to pull new opportunities and remove past deadlines. No more dead links."
                accent="from-hearth-500 to-hearth-700"
              />
              <FeatureCard
                icon={<Users className="h-5 w-5" />}
                title="Community analytics"
                description="If you run a women-founder Slack community, plug it in for privacy-first engagement insights."
                accent="from-hearth-600 to-hearth-900"
              />
            </div>
          </div>
        </section>

        {/* Privacy section */}
        <section className="border-t bg-card">
          <div className="container py-20 md:py-24">
            <div className="mx-auto max-w-3xl text-center">
              <div className="inline-flex items-center gap-2 rounded-full bg-hearth-100 px-4 py-1.5 text-xs font-semibold tracking-wide text-hearth-700">
                <Shield className="h-3.5 w-3.5" aria-hidden="true" />
                Privacy-first analytics
              </div>
              <h2 className="mt-5 text-2xl font-bold tracking-tight md:text-3xl">
                Running a women-founder community?
              </h2>
              <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                Plug in your Slack for free engagement analytics, without ever
                touching a message.
              </p>
            </div>

            <div className="mx-auto mt-12 grid max-w-4xl gap-4 md:grid-cols-2">
              <Card className="border-hearth-200/60 bg-gradient-to-br from-hearth-50/50 to-transparent">
                <CardContent className="pt-6">
                  <div className="mb-5 flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-hearth-100 text-hearth-600">
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <h3 className="text-lg font-bold">What you see</h3>
                  </div>
                  <ul className="space-y-3">
                    {[
                      "Daily, weekly, monthly active users",
                      "Message volume trends over time",
                      "Most active channels",
                      "Top contributors (anonymous ranks)",
                      "Cohort retention week over week",
                      "Shareable dashboard for board reports",
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2.5 text-sm">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-hearth-500" aria-hidden="true" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-success-200/60 bg-gradient-to-br from-success-50/50 to-transparent">
                <CardContent className="pt-6">
                  <div className="mb-5 flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success-100 text-success-600">
                      <EyeOff className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <h3 className="text-lg font-bold">What we never touch</h3>
                  </div>
                  <ul className="space-y-3">
                    {[
                      "Message content, never read or stored",
                      "Direct messages, zero access",
                      "Real names or emails, IDs are hashed",
                      "Files and attachments, not accessed",
                      "Channels you don't opt in, ignored",
                      "Data sold to third parties, never",
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2.5 text-sm">
                        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-success-600" aria-hidden="true" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* CTA / access note */}
        <section className="border-t">
          <div className="container py-16 md:py-20">
            <div className="mx-auto max-w-2xl text-center">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl hearth-gradient text-white shadow-lg hearth-glow" aria-hidden="true">
                <Flame className="h-7 w-7" />
              </div>
              <h2 className="mt-6 text-xl font-bold tracking-tight md:text-2xl">
                Invite-only access
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Hearth is currently in pilot with the Fishburners community.
                Sign up to request access, an admin will review and approve
                within a few business days.
              </p>
              <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <Button asChild size="lg" className="gap-2">
                  <Link href="/auth/signup">
                    Request access
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="ghost" size="lg">
                  <Link href="/auth/login">Already a member? Sign in</Link>
                </Button>
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
  accent,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  accent: string;
}) {
  return (
    <div className="group relative rounded-xl border bg-card p-6 transition-all duration-200 hover:shadow-md">
      <div
        className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${accent} text-white shadow-sm`}
      >
        {icon}
      </div>
      <h3 className="mb-2 font-bold">{title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}
