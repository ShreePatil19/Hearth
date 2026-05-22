export interface FilterState {
  type: string[];
  stage: string[];
  industry: string[];
  geo: string[];
  aussieOnly: boolean;
  equityFree: boolean;
  impactFocus: boolean;
  applicationCycle: string[];
}

export function parseFilters(
  searchParams: Record<string, string | string[] | undefined>
): FilterState {
  const toArray = (val: string | string[] | undefined): string[] => {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    return val.split(",").filter(Boolean);
  };

  return {
    type: toArray(searchParams.type),
    stage: toArray(searchParams.stage),
    industry: toArray(searchParams.industry),
    geo: toArray(searchParams.geo),
    aussieOnly: searchParams.aussie === "true",
    equityFree: searchParams.equity === "true",
    impactFocus: searchParams.impact === "true",
    applicationCycle: toArray(searchParams.cycle),
  };
}

export function filtersToParams(filters: FilterState): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.type.length) params.set("type", filters.type.join(","));
  if (filters.stage.length) params.set("stage", filters.stage.join(","));
  if (filters.industry.length) params.set("industry", filters.industry.join(","));
  if (filters.geo.length) params.set("geo", filters.geo.join(","));
  if (filters.aussieOnly) params.set("aussie", "true");
  if (filters.equityFree) params.set("equity", "true");
  if (filters.impactFocus) params.set("impact", "true");
  if (filters.applicationCycle.length) params.set("cycle", filters.applicationCycle.join(","));
  return params;
}
