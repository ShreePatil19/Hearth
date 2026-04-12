import { z } from "zod";

export const opportunityTypeEnum = z.enum([
  "grant",
  "accelerator",
  "pitch_competition",
  "fund",
  "fellowship",
  "other",
]);

export const stageEnum = z.enum([
  "idea",
  "pre_seed",
  "seed",
  "series_a",
  "growth",
  "any",
]);

export const industryEnum = z.enum([
  "tech",
  "health",
  "climate",
  "fintech",
  "edtech",
  "agritech",
  "consumer",
  "deep_tech",
  "social",
  "any",
]);

export const geoEnum = z.enum(["AU", "US", "UK", "EU", "Global", "APAC"]);

export const taggedFieldsSchema = z.object({
  type: opportunityTypeEnum,
  description: z.string().max(500),
  eligibility_summary: z.string().max(500).nullable(),
  stage: z.array(stageEnum).min(1),
  industry: z.array(industryEnum).min(1),
  geo: z.array(geoEnum).min(1),
  amount_min: z.number().int().nonnegative().nullable(),
  amount_max: z.number().int().nonnegative().nullable(),
  currency: z.string().default("AUD"),
  deadline: z.string().nullable(), // ISO date string
  women_focused: z.boolean().default(true),
});

export const opportunitySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  organisation: z.string().nullable(),
  slug: z.string().min(1),
  source_url: z.string().url(),
  application_url: z.string().url().nullable(),
  content_hash: z.string().nullable(),
  first_seen_at: z.string(),
  last_checked_at: z.string(),
  is_active: z.boolean().default(true),
  ...taggedFieldsSchema.shape,
});

export type Opportunity = z.infer<typeof opportunitySchema>;
export type TaggedFields = z.infer<typeof taggedFieldsSchema>;
