import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { formatCurrency } from "@/lib/utils";
import type { Opportunity } from "@/lib/types";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function getOpportunity(slug: string): Promise<Opportunity | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("opportunities")
    .select("*")
    .eq("slug", slug)
    .single();
  return data as Opportunity | null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const opp = await getOpportunity(slug);
  if (!opp) return { title: "Not Found | Hearth" };
  return {
    title: `${opp.name} | Hearth Funding Radar`,
    description: opp.description ?? `Funding opportunity from ${opp.organisation}`,
  };
}

export default async function OpportunityPage({ params }: PageProps) {
  const { slug } = await params;
  const opp = await getOpportunity(slug);
  if (!opp) notFound();

  const applyUrl = opp.application_url || opp.source_url;
  const typeLabel = opp.type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="container flex-1 py-6 md:py-8">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-orange-600 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to all opportunities
        </Link>

        <Card className="mt-2 rounded-xl shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-2xl md:text-3xl">{opp.name}</CardTitle>
                {opp.organisation && (
                  <p className="mt-1.5 text-muted-foreground">{opp.organisation}</p>
                )}
              </div>
              <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">{typeLabel}</Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {opp.description && (
              <div>
                <h3 className="mb-1.5 text-sm font-semibold uppercase tracking-wider text-muted-foreground">About</h3>
                <p className="text-sm leading-relaxed">{opp.description}</p>
              </div>
            )}

            {opp.eligibility_summary && (
              <div className="rounded-lg bg-orange-50 border border-orange-100 p-4">
                <h3 className="mb-1.5 text-sm font-semibold uppercase tracking-wider text-orange-700">Eligibility</h3>
                <p className="text-sm leading-relaxed text-orange-900/80">{opp.eligibility_summary}</p>
              </div>
            )}

            <Separator />

            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              <div className="rounded-lg border p-3">
                <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Amount</h4>
                <p className="mt-1.5 text-lg font-semibold">
                  {formatCurrency(opp.amount_min, opp.amount_max, opp.currency)}
                </p>
              </div>

              <div className="rounded-lg border p-3">
                <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Deadline</h4>
                <p className="mt-1.5 text-lg font-semibold">
                  {opp.deadline
                    ? new Date(opp.deadline).toLocaleDateString("en-AU", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })
                    : "Rolling / Ongoing"}
                </p>
              </div>

              <div className="rounded-lg border p-3">
                <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Currency</h4>
                <p className="mt-1.5 text-lg font-semibold">{opp.currency}</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Stage</h4>
                <div className="flex flex-wrap gap-1.5">
                  {opp.stage?.map((s: string) => (
                    <Badge key={s} variant="outline" className="text-xs capitalize">
                      {s.replace(/_/g, " ")}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Industry</h4>
                <div className="flex flex-wrap gap-1.5">
                  {opp.industry?.map((i: string) => (
                    <Badge key={i} variant="outline" className="text-xs capitalize">
                      {i.replace(/_/g, " ")}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Region</h4>
                <div className="flex flex-wrap gap-1.5">
                  {opp.geo?.map((g: string) => (
                    <Badge key={g} variant="outline" className="text-xs">
                      {g}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <Separator />

            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-orange-500 hover:bg-orange-600">
                <a href={applyUrl} target="_blank" rel="noopener noreferrer">
                  Apply on Source Site
                  <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>

              <Button variant="outline" asChild size="lg">
                <a href={opp.source_url} target="_blank" rel="noopener noreferrer">
                  View Original Listing
                  <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </div>

            <p className="text-xs text-muted-foreground/60">
              Hearth is for discovery purposes only. Always verify eligibility and
              details on the original source site.
            </p>
          </CardContent>
        </Card>
      </main>

      <SiteFooter />
    </div>
  );
}
