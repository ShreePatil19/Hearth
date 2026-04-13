-- Hearth Phase 2 — Community Dashboard Schema
-- Run this in the Supabase Dashboard SQL Editor

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS moddatetime SCHEMA extensions;

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE public.communities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'slack' CHECK (platform IN ('slack')),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slack_team_id TEXT UNIQUE,
  salt TEXT NOT NULL DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
  share_token UUID DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'revoked')),
  installed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER communities_updated_at
  BEFORE UPDATE ON public.communities
  FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime(updated_at);

CREATE TABLE public.integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  platform TEXT NOT NULL DEFAULT 'slack',
  encrypted_access_token BYTEA NOT NULL,
  encrypted_refresh_token BYTEA,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  slack_team_id TEXT,
  slack_team_name TEXT,
  installed_by UUID NOT NULL REFERENCES auth.users(id),
  installed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  UNIQUE(community_id, platform)
);

CREATE TABLE public.channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  platform_channel_id TEXT NOT NULL,
  name TEXT NOT NULL,
  is_private BOOLEAN NOT NULL DEFAULT false,
  opted_in BOOLEAN NOT NULL DEFAULT false,
  member_count INTEGER,
  synced_at TIMESTAMPTZ,
  UNIQUE(community_id, platform_channel_id)
);

CREATE TABLE public.message_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  hashed_user_id TEXT NOT NULL,
  ts TIMESTAMPTZ NOT NULL,
  msg_length INTEGER NOT NULL DEFAULT 0,
  has_thread BOOLEAN NOT NULL DEFAULT false,
  has_reaction BOOLEAN NOT NULL DEFAULT false,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for message_events
CREATE INDEX idx_message_events_community_ts ON public.message_events(community_id, ts DESC);
CREATE INDEX idx_message_events_channel_ts ON public.message_events(channel_id, ts DESC);
CREATE INDEX idx_message_events_hashed_user ON public.message_events(community_id, hashed_user_id);
CREATE UNIQUE INDEX idx_message_events_dedup ON public.message_events(community_id, channel_id, hashed_user_id, ts);

CREATE TABLE public.cohort_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  cohort_week DATE NOT NULL,
  retained_count INTEGER NOT NULL DEFAULT 0,
  total_in_cohort INTEGER NOT NULL DEFAULT 0,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(community_id, week_start, cohort_week)
);

CREATE TABLE public.ingest_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  channels_processed INTEGER DEFAULT 0,
  messages_ingested INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'error')),
  error_message TEXT
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cohort_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingest_log ENABLE ROW LEVEL SECURITY;

-- communities: owner CRUD
CREATE POLICY "communities_owner_select" ON public.communities FOR SELECT
  USING (owner_user_id = (SELECT auth.uid()));
CREATE POLICY "communities_owner_insert" ON public.communities FOR INSERT
  WITH CHECK (owner_user_id = (SELECT auth.uid()));
CREATE POLICY "communities_owner_update" ON public.communities FOR UPDATE
  USING (owner_user_id = (SELECT auth.uid()));
CREATE POLICY "communities_owner_delete" ON public.communities FOR DELETE
  USING (owner_user_id = (SELECT auth.uid()));

-- integrations: gated by community ownership
CREATE POLICY "integrations_owner_select" ON public.integrations FOR SELECT
  USING (community_id IN (SELECT id FROM public.communities WHERE owner_user_id = (SELECT auth.uid())));
CREATE POLICY "integrations_owner_insert" ON public.integrations FOR INSERT
  WITH CHECK (community_id IN (SELECT id FROM public.communities WHERE owner_user_id = (SELECT auth.uid())));
CREATE POLICY "integrations_owner_delete" ON public.integrations FOR DELETE
  USING (community_id IN (SELECT id FROM public.communities WHERE owner_user_id = (SELECT auth.uid())));

-- channels: gated by community ownership
CREATE POLICY "channels_owner_select" ON public.channels FOR SELECT
  USING (community_id IN (SELECT id FROM public.communities WHERE owner_user_id = (SELECT auth.uid())));
CREATE POLICY "channels_owner_update" ON public.channels FOR UPDATE
  USING (community_id IN (SELECT id FROM public.communities WHERE owner_user_id = (SELECT auth.uid())));

-- message_events: read-only for community owner
CREATE POLICY "message_events_owner_select" ON public.message_events FOR SELECT
  USING (community_id IN (SELECT id FROM public.communities WHERE owner_user_id = (SELECT auth.uid())));

-- cohort_snapshots: read-only for community owner
CREATE POLICY "cohort_snapshots_owner_select" ON public.cohort_snapshots FOR SELECT
  USING (community_id IN (SELECT id FROM public.communities WHERE owner_user_id = (SELECT auth.uid())));

-- ingest_log: read-only for community owner
CREATE POLICY "ingest_log_owner_select" ON public.ingest_log FOR SELECT
  USING (community_id IN (SELECT id FROM public.communities WHERE owner_user_id = (SELECT auth.uid())));

-- ============================================================
-- RPC FUNCTIONS
-- ============================================================

-- Store an encrypted integration token
CREATE OR REPLACE FUNCTION store_integration(
  p_community_id UUID,
  p_platform TEXT,
  p_access_token TEXT,
  p_refresh_token TEXT DEFAULT NULL,
  p_scopes TEXT[] DEFAULT '{}',
  p_slack_team_id TEXT DEFAULT NULL,
  p_slack_team_name TEXT DEFAULT NULL,
  p_installed_by UUID DEFAULT NULL,
  p_encryption_key TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id UUID;
  v_key TEXT;
BEGIN
  v_key := COALESCE(p_encryption_key, current_setting('app.settings.token_encryption_key', true));

  INSERT INTO public.integrations (
    community_id, platform, encrypted_access_token, encrypted_refresh_token,
    scopes, slack_team_id, slack_team_name, installed_by
  ) VALUES (
    p_community_id, p_platform,
    pgp_sym_encrypt(p_access_token, v_key),
    CASE WHEN p_refresh_token IS NOT NULL THEN pgp_sym_encrypt(p_refresh_token, v_key) ELSE NULL END,
    p_scopes, p_slack_team_id, p_slack_team_name, p_installed_by
  )
  ON CONFLICT (community_id, platform)
  DO UPDATE SET
    encrypted_access_token = pgp_sym_encrypt(p_access_token, v_key),
    encrypted_refresh_token = CASE WHEN p_refresh_token IS NOT NULL THEN pgp_sym_encrypt(p_refresh_token, v_key) ELSE integrations.encrypted_refresh_token END,
    scopes = p_scopes,
    slack_team_id = p_slack_team_id,
    slack_team_name = p_slack_team_name,
    last_used_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Get decrypted token for a community (service_role only)
CREATE OR REPLACE FUNCTION get_decrypted_token(
  p_community_id UUID,
  p_encryption_key TEXT DEFAULT NULL
)
RETURNS TABLE(access_token TEXT, refresh_token TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_key TEXT;
BEGIN
  v_key := COALESCE(p_encryption_key, current_setting('app.settings.token_encryption_key', true));

  RETURN QUERY
  SELECT
    pgp_sym_decrypt(i.encrypted_access_token, v_key) AS access_token,
    CASE WHEN i.encrypted_refresh_token IS NOT NULL
      THEN pgp_sym_decrypt(i.encrypted_refresh_token, v_key)
      ELSE NULL
    END AS refresh_token
  FROM public.integrations i
  WHERE i.community_id = p_community_id
  LIMIT 1;
END;
$$;

-- Get shared dashboard data (public, bypasses RLS)
CREATE OR REPLACE FUNCTION get_shared_dashboard(p_share_token UUID)
RETURNS TABLE(community_id UUID, community_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT c.id, c.name
  FROM public.communities c
  WHERE c.share_token = p_share_token
    AND c.status = 'active'
  LIMIT 1;
END;
$$;

-- Revoke community and cascade delete all data
CREATE OR REPLACE FUNCTION revoke_community(p_community_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- FK ON DELETE CASCADE handles everything
  DELETE FROM public.communities WHERE id = p_community_id;
  RETURN FOUND;
END;
$$;
