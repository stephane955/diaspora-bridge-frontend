-- =============================================================================
-- P01.10 — favorite_providers (omitted from P01 core; required by app contract)
-- Additive only. No financial objects. No Phase 3B.
-- Source shape: supabase/legacy/20260328_enterprise_disputes_favorites_support.sql
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.favorite_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT favorite_providers_unique UNIQUE (client_id, provider_id),
  CONSTRAINT favorite_providers_no_self CHECK (client_id <> provider_id)
);

CREATE INDEX IF NOT EXISTS favorite_providers_client_id_idx
  ON public.favorite_providers(client_id);
CREATE INDEX IF NOT EXISTS favorite_providers_provider_id_idx
  ON public.favorite_providers(provider_id);

ALTER TABLE public.favorite_providers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "favorites_select_own" ON public.favorite_providers;
CREATE POLICY "favorites_select_own"
  ON public.favorite_providers FOR SELECT TO authenticated
  USING (client_id = auth.uid());

DROP POLICY IF EXISTS "favorites_insert_own" ON public.favorite_providers;
CREATE POLICY "favorites_insert_own"
  ON public.favorite_providers FOR INSERT TO authenticated
  WITH CHECK (client_id = auth.uid() AND client_id <> provider_id);

DROP POLICY IF EXISTS "favorites_delete_own" ON public.favorite_providers;
CREATE POLICY "favorites_delete_own"
  ON public.favorite_providers FOR DELETE TO authenticated
  USING (client_id = auth.uid());

COMMENT ON TABLE public.favorite_providers IS
  'Client saved providers. P01.10 additive — non-financial.';

REVOKE ALL ON TABLE public.favorite_providers FROM PUBLIC, anon;
GRANT SELECT, INSERT, DELETE ON TABLE public.favorite_providers TO authenticated;
GRANT ALL ON TABLE public.favorite_providers TO service_role;
