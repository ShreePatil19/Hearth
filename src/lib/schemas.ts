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

export const supportTypeEnum = z.enum([
  "funding",
  "mentorship",
  "network",
  "loan",
  "education",
  "workspace",
]);

export const applicationCycleEnum = z.enum([
  "rolling",
  "annual",
  "cohort",
  "ongoing",
]);

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
  equity_free: z.boolean().default(true),
  support_types: z.array(supportTypeEnum).min(1).default(["funding"]),
  impact_focus: z.boolean().default(false),
  revenue_required: z.boolean().nullable().default(null),
  application_cycle: applicationCycleEnum.default("ongoing"),
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

// ============================================================
// Phase 2 — Community Dashboard
// ============================================================

// Login allows the legacy 6-char minimum so existing accounts created before
// the bump can still sign in. Signup enforces 8+ for new accounts.
export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const SIGNUP_PASSWORD_MIN = 8;

export const signupSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(SIGNUP_PASSWORD_MIN, `Password must be at least ${SIGNUP_PASSWORD_MIN} characters`),
  confirmPassword: z
    .string()
    .min(SIGNUP_PASSWORD_MIN, `Password must be at least ${SIGNUP_PASSWORD_MIN} characters`),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export const communityPlatformEnum = z.enum(["slack"]);
export const communityStatusEnum = z.enum(["active", "paused", "revoked"]);

export const communitySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  platform: communityPlatformEnum,
  owner_user_id: z.string().uuid(),
  slack_team_id: z.string().nullable(),
  share_token: z.string().uuid().nullable(),
  status: communityStatusEnum,
  installed_at: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const channelSchema = z.object({
  id: z.string().uuid(),
  community_id: z.string().uuid(),
  platform_channel_id: z.string(),
  name: z.string(),
  is_private: z.boolean(),
  opted_in: z.boolean(),
  member_count: z.number().nullable(),
  synced_at: z.string().nullable(),
});

export const messageEventSchema = z.object({
  id: z.string().uuid(),
  community_id: z.string().uuid(),
  channel_id: z.string().uuid(),
  hashed_user_id: z.string(),
  ts: z.string(),
  msg_length: z.number(),
  has_thread: z.boolean(),
  has_reaction: z.boolean(),
  ingested_at: z.string(),
});

export type Community = z.infer<typeof communitySchema>;
export type Channel = z.infer<typeof channelSchema>;
export type MessageEvent = z.infer<typeof messageEventSchema>;
export type SupportType = z.infer<typeof supportTypeEnum>;
export type ApplicationCycle = z.infer<typeof applicationCycleEnum>;
