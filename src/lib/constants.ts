export const OPPORTUNITY_TYPES = [
  { value: "grant", label: "Grant" },
  { value: "accelerator", label: "Accelerator" },
  { value: "pitch_competition", label: "Pitch Competition" },
  { value: "fund", label: "Fund" },
  { value: "fellowship", label: "Fellowship" },
  { value: "other", label: "Other" },
] as const;

export const STAGES = [
  { value: "idea", label: "Idea" },
  { value: "pre_seed", label: "Pre-Seed" },
  { value: "seed", label: "Seed" },
  { value: "series_a", label: "Series A" },
  { value: "growth", label: "Growth" },
  { value: "any", label: "Any Stage" },
] as const;

export const INDUSTRIES = [
  { value: "tech", label: "Tech" },
  { value: "health", label: "Health" },
  { value: "climate", label: "Climate" },
  { value: "fintech", label: "Fintech" },
  { value: "edtech", label: "EdTech" },
  { value: "agritech", label: "AgriTech" },
  { value: "consumer", label: "Consumer" },
  { value: "deep_tech", label: "Deep Tech" },
  { value: "social", label: "Social Impact" },
  { value: "any", label: "Any Industry" },
] as const;

export const GEOS = [
  { value: "AU", label: "Australia" },
  { value: "US", label: "United States" },
  { value: "UK", label: "United Kingdom" },
  { value: "EU", label: "Europe" },
  { value: "APAC", label: "Asia-Pacific" },
  { value: "Global", label: "Global" },
] as const;
