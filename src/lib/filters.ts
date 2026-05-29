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

