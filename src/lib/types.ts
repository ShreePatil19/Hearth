// Convenience re-exports for the most commonly consumed domain types.
// Re-export from this barrel only when adding a non-trivial subset of
// schemas.ts would harm grep-ability. Otherwise import directly from
// "@/lib/schemas".
export type { Opportunity, TaggedFields } from "./schemas";
export type { Community, Channel, MessageEvent } from "./schemas";
