import { Suspense } from "react";
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

  const supabase = await createClient();
  let query = supabase
    .from("opportunities")
    .select("*")
    .eq("is_active", true)
    .order("deadline", { ascending: true, nullsFirst: false });

  // Apply filters
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
  const opps = (opportunities ?? []) as Opportunity[];

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="container mx-auto flex-1 px-4 py-6">
        <div className="mb-4">
          <p className="text-sm text-muted-foreground">
            {opps.length} {opps.length === 1 ? "opportunity" : "opportunities"} found
          </p>
        </div>

        <div className="flex gap-6">
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
