-- =============================================================================
-- P01 — Minimal application bootstrap (prerequisite for Phase 1 / 3A / 5 / P00)
-- Reproduces staging pre-ledger core tables only. NOT the full legacy app schema.
-- Source: supabase/staging/000_app_baseline_min.sql (verified staging prerequisite)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  push_token text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (id = auth.uid());
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (id = auth.uid());

CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  assigned_provider_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  funder_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.projects.funder_ids IS
  'Multi-sig funder list (C05 future). Empty until Phase 3B.0.';

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  dispute_status text NOT NULL DEFAULT 'none',
  disputed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;

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
CREATE POLICY "milestones_select" ON public.milestones
  FOR SELECT USING (public.user_can_access_project(project_id));

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

-- Legacy financial stubs (write-frozen by P00 migration)
CREATE TABLE IF NOT EXISTS public.transactions (
  id bigserial PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  amount numeric,
  description text,
  type text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.withdrawals (
  id bigserial PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  amount numeric,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
