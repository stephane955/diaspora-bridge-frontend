-- =============================================================================
-- Diaspora Bridge — Enterprise V1: disputes, favorite_providers, support_tickets
-- Apply via Supabase SQL Editor or `supabase db push`
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) disputes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  milestone_id uuid REFERENCES public.milestones(id) ON DELETE SET NULL,
  raised_by_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'under_review', 'resolved')),
  admin_decision text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS disputes_project_id_idx ON public.disputes(project_id);
CREATE INDEX IF NOT EXISTS disputes_raised_by_id_idx ON public.disputes(raised_by_id);
CREATE INDEX IF NOT EXISTS disputes_status_idx ON public.disputes(status);

ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "disputes_select_participants" ON public.disputes;
CREATE POLICY "disputes_select_participants"
  ON public.disputes FOR SELECT TO authenticated
  USING (
    raised_by_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = disputes.project_id
        AND (p.owner_id = auth.uid() OR p.assigned_provider_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "disputes_insert_own" ON public.disputes;
CREATE POLICY "disputes_insert_own"
  ON public.disputes FOR INSERT TO authenticated
  WITH CHECK (
    raised_by_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id
        AND (p.owner_id = auth.uid() OR p.assigned_provider_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "disputes_update_raiser" ON public.disputes;
CREATE POLICY "disputes_update_raiser"
  ON public.disputes FOR UPDATE TO authenticated
  USING (raised_by_id = auth.uid())
  WITH CHECK (raised_by_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 2) favorite_providers
-- ---------------------------------------------------------------------------
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
  WITH CHECK (client_id = auth.uid());

DROP POLICY IF EXISTS "favorites_delete_own" ON public.favorite_providers;
CREATE POLICY "favorites_delete_own"
  ON public.favorite_providers FOR DELETE TO authenticated
  USING (client_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 3) support_tickets
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  issue_type text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_tickets_user_id_idx ON public.support_tickets(user_id);
CREATE INDEX IF NOT EXISTS support_tickets_status_idx ON public.support_tickets(status);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "support_tickets_select_own" ON public.support_tickets;
CREATE POLICY "support_tickets_select_own"
  ON public.support_tickets FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "support_tickets_insert_own" ON public.support_tickets;
CREATE POLICY "support_tickets_insert_own"
  ON public.support_tickets FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "support_tickets_update_own" ON public.support_tickets;
CREATE POLICY "support_tickets_update_own"
  ON public.support_tickets FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMENT ON TABLE public.disputes IS 'Escrow dispute loop: client/provider raise, admin resolves';
COMMENT ON TABLE public.favorite_providers IS 'Client saved providers for retention';
COMMENT ON TABLE public.support_tickets IS 'In-app support tickets owned by the reporter';

-- Optional: allow disputed milestone status (safe if already text without check)
DO $$
BEGIN
  -- no-op placeholder for environments that use free-form text status
  NULL;
END $$;
