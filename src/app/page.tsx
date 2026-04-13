import { Suspense } from "react";
import { Search, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { parseFilters } from "@/lib/filters";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { FilterSidebar } from "@/components/filter-sidebar";
import { OpportunityTable } from "@/components/opportunity-table";
import type { Opportunity } from "@/lib/types";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = parseFilters(params);

  let opps: Opportunity[] = [];

  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const supabase = await createClient();
    let query = supabase
      .from("opportunities")
      .select("*")
      .eq("is_active", true)
      .order("deadline", { ascending: true, nullsFirst: false });

    if (filters.type.length) {
      query = query.in("type", filters.type);
    }
    if (filters.stage.length) {
      query = query.overlaps("stage", filters.stage);
    }
    if (filters.industry.length) {
      query = query.overlaps("industry", filters.industry);
    }
    if (filters.geo.length) {
      query = query.overlaps("geo", filters.geo);
    }
    if (filters.aussieOnly) {
      query = query.contains("geo", ["AU"]);
    }

    const { data: opportunities } = await query;
    opps = (opportunities ?? []) as Opportunity[];
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      {/* Hero */}
      <section className="border-b bg-gradient-to-b from-orange-50 to-background">
        <div className="container py-10 md:py-14">
          <div className="flex items-center gap-2 text-sm font-medium text-orange-600 mb-3">
            <Sparkles className="h-4 w-4" />
            <span>Funding opportunities for women founders</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl lg:text-5xl">
            Find your next
            <span className="text-orange-500"> funding opportunity</span>
          </h1>
          <p className="mt-3 max-w-2xl text-base text-muted-foreground md:text-lg">
            Grants, accelerators, pitch competitions, and funds — all in one place.
            Filtered, searchable, and refreshed daily.
          </p>
        </div>
      </section>

      {/* Main content */}
      <main className="container flex-1 py-6 md:py-8">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium text-muted-foreground">
              {opps.length} {opps.length === 1 ? "opportunity" : "opportunities"} found
            </p>
          </div>
        </div>

        <div className="flex gap-0 md:gap-8">
          <Suspense fallback={null}>
            <FilterSidebar />
          </Suspense>

          <div className="flex-1 min-w-0">
            <OpportunityTable data={opps} />
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
