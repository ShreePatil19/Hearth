-- Reverses 001_create_opportunities.sql
-- Drops the opportunities table (RLS policies and indexes go with it via CASCADE)
-- and the opportunity_type enum. Leaves pgcrypto in place since other migrations
-- depend on it.

DROP TABLE IF EXISTS public.opportunities CASCADE;
DROP TYPE IF EXISTS public.opportunity_type;
