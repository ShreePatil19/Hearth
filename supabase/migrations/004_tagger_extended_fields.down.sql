-- Reverses 004_tagger_extended_fields.sql
-- Drops the five tagger columns added to opportunities and the two partial
-- indexes that depend on them.

DROP INDEX IF EXISTS public.idx_opportunities_impact;
DROP INDEX IF EXISTS public.idx_opportunities_equity_free;

ALTER TABLE public.opportunities
  DROP COLUMN IF EXISTS application_cycle,
  DROP COLUMN IF EXISTS revenue_required,
  DROP COLUMN IF EXISTS impact_focus,
  DROP COLUMN IF EXISTS support_types,
  DROP COLUMN IF EXISTS equity_free;
