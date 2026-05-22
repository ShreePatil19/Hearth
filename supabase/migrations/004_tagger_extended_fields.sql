-- Migration 004: Extended tagger fields
-- Adds 5 new columns to support richer opportunity classification

ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS equity_free       BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS support_types     TEXT[]  NOT NULL DEFAULT '{funding}',
  ADD COLUMN IF NOT EXISTS impact_focus      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS revenue_required  BOOLEAN,
  ADD COLUMN IF NOT EXISTS application_cycle TEXT    NOT NULL DEFAULT 'ongoing';

-- Partial index for common filter: equity-free opportunities
CREATE INDEX IF NOT EXISTS idx_opportunities_equity_free
  ON opportunities (equity_free)
  WHERE equity_free = TRUE;

-- Partial index for impact-focused filter
CREATE INDEX IF NOT EXISTS idx_opportunities_impact
  ON opportunities (impact_focus)
  WHERE impact_focus = TRUE;
