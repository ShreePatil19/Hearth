-- Hearth Funding Radar — Phase 1 Schema
-- Run this in the Supabase Dashboard SQL Editor

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Opportunity type enum
CREATE TYPE opportunity_type AS ENUM (
  'grant',
  'accelerator',
  'pitch_competition',
  'fund',
  'fellowship',
  'other'
);

-- Core opportunities table
CREATE TABLE opportunities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  organisation    TEXT,
  slug            TEXT UNIQUE NOT NULL,
  type            opportunity_type NOT NULL DEFAULT 'other',
  description     TEXT,
  eligibility_summary TEXT,
  stage           TEXT[] NOT NULL DEFAULT '{}',
  industry        TEXT[] NOT NULL DEFAULT '{}',
  geo             TEXT[] NOT NULL DEFAULT '{}',
  amount_min      INTEGER,
  amount_max      INTEGER,
  currency        TEXT NOT NULL DEFAULT 'AUD',
  deadline        DATE,
  application_url TEXT,
  source_url      TEXT NOT NULL,
  women_focused   BOOLEAN NOT NULL DEFAULT TRUE,
  content_hash    TEXT,
  first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE
);

-- Indexes
CREATE INDEX idx_opportunities_deadline ON opportunities (deadline ASC NULLS LAST);
CREATE INDEX idx_opportunities_is_active ON opportunities (is_active);
CREATE INDEX idx_opportunities_slug ON opportunities (slug);
CREATE INDEX idx_opportunities_stage ON opportunities USING GIN (stage);
CREATE INDEX idx_opportunities_industry ON opportunities USING GIN (industry);
CREATE INDEX idx_opportunities_geo ON opportunities USING GIN (geo);

-- RLS: public read-only, no client writes
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access"
  ON opportunities
  FOR SELECT
  USING (true);

-- No INSERT/UPDATE/DELETE policies — service_role key bypasses RLS
