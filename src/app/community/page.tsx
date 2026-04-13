import Link from "next/link";
import {
  Flame,
  Shield,
  BarChart3,
  Users,
  Lock,
  Clock,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function CommunityLandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-orange-400 to-orange-600 text-white">
              <Flame className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold leading-tight">Hearth</span>
              <span className="text-[11px] text-muted-foreground">Community Dashboard</span>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/auth/login" className="text-sm text-muted-foreground hover:text-foreground">
              Sign In
            </Link>
            <Button size="sm" className="bg-orange-500 hover:bg-orange-600" asChild>
              <Link href="/auth/signup">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b bg-gradient-to-b from-orange-50 to-background">
        <div className="container py-16 md:py-24 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-orange-100 px-4 py-1.5 text-sm font-medium text-orange-700 mb-6">
            <Shield className="h-4 w-4" />
            Privacy-first analytics
          </div>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl mb-4">
            Understand your community
            <br />
            <span className="text-orange-500">without compromising trust</span>
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground mb-8">
            Free analytics for Slack communities running women-founder groups.
            See who&apos;s engaged, what&apos;s growing, and where to focus —
            without ever reading a single message.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button size="lg" className="bg-orange-500 hover:bg-orange-600" asChild>
              <Link href="/auth/signup">
                Connect Your Slack
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/privacy">How We Protect Data</Link>
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Free forever. No credit card. 30-second setup.
          </p>
        </div>
      </section>

      {/* What You See vs What We Don't */}
      <section className="container py-16 md:py-20">
        <h2 className="text-2xl font-bold text-center mb-12">
          What you get vs what we never touch
        </h2>
        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          <Card className="border-orange-200 bg-orange-50/30">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-4">
                <Eye className="h-5 w-5 text-orange-500" />
                <h3 className="font-semibold text-lg">What you see</h3>
              </div>
              <ul className="space-y-3">
                {[
                  "Daily, weekly, monthly active users",
                  "Message volume trends over time",
                  "Most active channels",
                  "Top contributors (anonymous ranks)",
                  "New vs returning member breakdown",
                  "Cohort retention week over week",
                  "Lurker ratio (readers vs posters)",
                  "Shareable dashboard for board reports",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="border-green-200 bg-green-50/30">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-4">
                <EyeOff className="h-5 w-5 text-green-600" />
                <h3 className="font-semibold text-lg">What we never touch</h3>
              </div>
              <ul className="space-y-3">
                {[
                  "Message content — never read or stored",
                  "Direct messages — zero access",
                  "Real names or emails — IDs are hashed",
                  "Files and attachments — not accessed",
                  "Channels you don't opt in — ignored",
                  "Browsing or click data — not tracked",
                  "Data sold to third parties — never",
                  "Cross-community correlation — impossible",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm">
                    <Lock className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Features */}
      <section className="border-t bg-white">
        <div className="container py-16 md:py-20">
          <h2 className="text-2xl font-bold text-center mb-12">
            Built for community managers who care about privacy
          </h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              {
                icon: BarChart3,
                title: "Engagement Analytics",
                desc: "DAU/WAU/MAU, message volume, channel breakdown — see exactly what's working in your community.",
              },
              {
                icon: Users,
                title: "Anonymous Contributors",
                desc: "See who's most active without revealing identities. Contributors are ranked, never named.",
              },
              {
                icon: Shield,
                title: "Per-Channel Control",
                desc: "Every channel starts OFF. You choose exactly which ones to monitor. Revoke anytime with one click.",
              },
              {
                icon: Clock,
                title: "Daily Auto-Refresh",
                desc: "Data syncs every day at 2am UTC. No manual effort — your dashboard is always up to date.",
              },
              {
                icon: Lock,
                title: "Encrypted Tokens",
                desc: "Your Slack OAuth token is encrypted at rest. It never exists in plain text in our database.",
              },
              {
                icon: ArrowRight,
                title: "Shareable Reports",
                desc: "Generate a read-only dashboard link for board reports or team updates. Revoke anytime.",
              },
            ].map((feature) => (
              <div key={feature.title} className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-orange-100 mb-4">
                  <feature.icon className="h-6 w-6 text-orange-600" />
                </div>
                <h3 className="font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t bg-gradient-to-b from-background to-orange-50">
        <div className="container py-16 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Ready to understand your community?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto">
            Free, privacy-first, 30-second setup. No credit card required.
          </p>
          <Button size="lg" className="bg-orange-500 hover:bg-orange-600" asChild>
            <Link href="/auth/signup">
              Get Started
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white py-8">
        <div className="container text-center text-xs text-muted-foreground">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Flame className="h-4 w-4 text-orange-400" />
            <span className="font-medium">Hearth</span>
          </div>
          <div className="flex items-center justify-center gap-4">
            <Link href="/" className="hover:text-orange-600">Funding Radar</Link>
            <span>&middot;</span>
            <Link href="/privacy" className="hover:text-orange-600">Privacy</Link>
            <span>&middot;</span>
            <span>Built for women founders</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
