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

      <main className="container mx-auto flex-1 px-4 py-6">
        <Link
          href="/"
          className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to all opportunities
        </Link>

        <Card className="mt-4">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle className="text-2xl">{opp.name}</CardTitle>
                {opp.organisation && (
                  <p className="mt-1 text-muted-foreground">{opp.organisation}</p>
                )}
              </div>
              <Badge variant="secondary">{typeLabel}</Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {opp.description && (
              <div>
                <h3 className="mb-1 font-semibold">About</h3>
                <p className="text-sm leading-relaxed">{opp.description}</p>
              </div>
            )}

            {opp.eligibility_summary && (
              <div className="rounded-md bg-slate-50 p-4">
                <h3 className="mb-1 font-semibold">Eligibility</h3>
                <p className="text-sm leading-relaxed">{opp.eligibility_summary}</p>
              </div>
            )}

            <Separator />

            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              <div>
                <h4 className="text-xs font-medium uppercase text-muted-foreground">Amount</h4>
                <p className="mt-1 font-medium">
                  {formatCurrency(opp.amount_min, opp.amount_max, opp.currency)}
                </p>
              </div>

              <div>
                <h4 className="text-xs font-medium uppercase text-muted-foreground">Deadline</h4>
                <p className="mt-1 font-medium">
                  {opp.deadline
                    ? new Date(opp.deadline).toLocaleDateString("en-AU", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })
                    : "Rolling / Ongoing"}
                </p>
              </div>

              <div>
                <h4 className="text-xs font-medium uppercase text-muted-foreground">Currency</h4>
                <p className="mt-1 font-medium">{opp.currency}</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <h4 className="text-xs font-medium uppercase text-muted-foreground">Stage</h4>
                <div className="mt-1 flex flex-wrap gap-1">
                  {opp.stage?.map((s: string) => (
                    <Badge key={s} variant="outline" className="text-xs">
                      {s.replace(/_/g, " ")}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-medium uppercase text-muted-foreground">Industry</h4>
                <div className="mt-1 flex flex-wrap gap-1">
                  {opp.industry?.map((i: string) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {i.replace(/_/g, " ")}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-medium uppercase text-muted-foreground">Region</h4>
                <div className="mt-1 flex flex-wrap gap-1">
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
              <Button asChild size="lg">
                <a href={applyUrl} target="_blank" rel="noopener noreferrer">
                  Apply on Source Site
                  <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>

              <Button variant="outline" asChild>
                <a href={opp.source_url} target="_blank" rel="noopener noreferrer">
                  View Original Listing
                  <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
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
