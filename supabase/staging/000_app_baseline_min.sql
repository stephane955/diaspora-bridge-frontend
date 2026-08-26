-- =============================================================================
-- Diaspora Bridge — STAGING ONLY minimum application baseline
-- Target: tvorurbmzrpwvxwztpix (diaspora-bridge-staging)
-- NOT for production. NOT a Phase 1/3A/3B migration.
--
-- Source of truth (repository evidence only):
--   supabase/migrations/rls_and_auth.sql
--   supabase/migrations/apex_enterprise_schema.sql
--   supabase/migrations/compliance_aml_escrow_insurance.sql
--   supabase/migrations/20260826_phase3b0_multisig_approvals.sql (funder_ids type)
--   supabase/migrations/20260826_phase3b_escrow_funding.sql (profiles/projects FKs)
--   supabase/tests/phase3a_verify_readonly.sql (legacy table presence probes)
--
-- Schema/config only. No seed users. No financial rows.
-- =============================================================================

-- profiles: auth.users.id → public.profiles.id
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  push_token text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (id = auth.uid());

-- projects (funder_ids uuid[] DEFAULT '{}' per compliance / Phase 3B0)
CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  assigned_provider_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  funder_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.projects.funder_ids IS
  'Multi-sig: array of auth.users ids (repo compliance / Phase 3B0). Empty = no multi-sig list.';

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- milestones
CREATE TABLE IF NOT EXISTS public.milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  dispute_status text NOT NULL DEFAULT 'none',
  disputed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;

-- project_observers (user_can_access_project dependency)
CREATE TABLE IF NOT EXISTS public.project_observers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  invite_token text NOT NULL UNIQUE,
  email text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (project_id, user_id)
);

ALTER TABLE public.project_observers ENABLE ROW LEVEL SECURITY;

-- user_can_access_project: semantics from rls_and_auth.sql
CREATE OR REPLACE FUNCTION public.user_can_access_project(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = p_project_id
      AND (p.owner_id = auth.uid() OR p.assigned_provider_id = auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM public.project_observers o
    WHERE o.project_id = p_project_id AND o.user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.user_can_access_project(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_can_access_project(uuid) TO authenticated, service_role, anon;

-- RLS policies (after all tables + helper exist)
DROP POLICY IF EXISTS "projects_select" ON public.projects;
DROP POLICY IF EXISTS "projects_insert" ON public.projects;
DROP POLICY IF EXISTS "projects_update" ON public.projects;
DROP POLICY IF EXISTS "projects_delete" ON public.projects;
CREATE POLICY "projects_select" ON public.projects
  FOR SELECT USING (
    owner_id = auth.uid()
    OR assigned_provider_id = auth.uid()
    OR id IN (SELECT o.project_id FROM public.project_observers o WHERE o.user_id = auth.uid())
  );
CREATE POLICY "projects_insert" ON public.projects
  FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "projects_update" ON public.projects
  FOR UPDATE USING (owner_id = auth.uid() OR assigned_provider_id = auth.uid());
CREATE POLICY "projects_delete" ON public.projects
  FOR DELETE USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "milestones_select" ON public.milestones;
DROP POLICY IF EXISTS "milestones_insert" ON public.milestones;
DROP POLICY IF EXISTS "milestones_update" ON public.milestones;
CREATE POLICY "milestones_select" ON public.milestones FOR SELECT USING (public.user_can_access_project(project_id));
CREATE POLICY "milestones_insert" ON public.milestones FOR INSERT WITH CHECK (public.user_can_access_project(project_id));
CREATE POLICY "milestones_update" ON public.milestones FOR UPDATE USING (public.user_can_access_project(project_id));

DROP POLICY IF EXISTS "observers_select" ON public.project_observers;
DROP POLICY IF EXISTS "observers_insert" ON public.project_observers;
DROP POLICY IF EXISTS "observers_update" ON public.project_observers;
CREATE POLICY "observers_select" ON public.project_observers FOR SELECT USING (
  user_id = auth.uid() OR project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid())
);
CREATE POLICY "observers_insert" ON public.project_observers FOR INSERT WITH CHECK (
  project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid())
);
CREATE POLICY "observers_update" ON public.project_observers FOR UPDATE USING (
  user_id = auth.uid() OR project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid())
);

-- Empty legacy stubs for phase3a_verify_readonly.sql SELECT probes only
CREATE TABLE IF NOT EXISTS public.transactions (
  id bigserial PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS public.withdrawals (
  id bigserial PRIMARY KEY,
  amount numeric,
  status text
);
