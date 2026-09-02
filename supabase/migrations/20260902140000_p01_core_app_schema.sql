-- =============================================================================
-- P01 — Core application schema (structural; no financial engines)
-- Adds app-required tables/columns after P00. Does NOT apply Phase 3B/C07/C08.
-- Legacy transactions/withdrawals remain write-frozen.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Extend profiles (marketplace + app identity)
-- -----------------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'client',
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS rating numeric(3,2),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

COMMENT ON COLUMN public.profiles.role IS 'App role hint only. Admin authority is platform_admins (P00).';

-- -----------------------------------------------------------------------------
-- 2. Extend projects (workflow fields; canonical money via Phase 5 columns)
-- -----------------------------------------------------------------------------

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS dispute_milestone_id uuid REFERENCES public.milestones(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS warranty_retainage_minor bigint,
  ADD COLUMN IF NOT EXISTS warranty_hold_until timestamptz,
  ADD COLUMN IF NOT EXISTS warranty_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

COMMENT ON COLUMN public.projects.warranty_retainage_minor IS
  'Non-authoritative planning retainage (whole XAF). NOT ledger balance.';

-- -----------------------------------------------------------------------------
-- 3. Extend milestones (workflow; amount_minor from Phase 5)
-- -----------------------------------------------------------------------------

ALTER TABLE public.milestones
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'locked',
  ADD COLUMN IF NOT EXISTS step_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- -----------------------------------------------------------------------------
-- 4. project_applications (bidding / hire)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.project_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bid_amount numeric,
  material_estimate numeric,
  time_to_completion_days integer,
  message text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, provider_id)
);

CREATE INDEX IF NOT EXISTS idx_project_applications_project ON public.project_applications(project_id);
CREATE INDEX IF NOT EXISTS idx_project_applications_provider ON public.project_applications(provider_id);

-- -----------------------------------------------------------------------------
-- 5. messages
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text,
  audio_url text,
  transcription_text text,
  translation_text text,
  translation_lang text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_project ON public.messages(project_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- 6. notifications
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  message text NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  link text,
  route text,
  is_read boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- 7. reviews
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, client_id)
);

-- -----------------------------------------------------------------------------
-- 8. project_updates (timeline / site photos — not canonical evidence)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.project_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text,
  body text,
  photo_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_updates_project ON public.project_updates(project_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- 9. project_expenses (records only — NOT money movement)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.project_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  provider_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  amount numeric,
  extracted_amount numeric,
  description text,
  receipt_url text,
  type text NOT NULL DEFAULT 'milestone',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_expenses_project ON public.project_expenses(project_id);

-- -----------------------------------------------------------------------------
-- 10. project_contracts
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.project_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE UNIQUE,
  pdf_url text,
  client_signed_at timestamptz,
  provider_signed_at timestamptz,
  client_signature_url text,
  provider_signature_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 11. project_disputes (TEMPORARY — D04 consolidation required)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.project_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  milestone_id uuid REFERENCES public.milestones(id) ON DELETE SET NULL,
  opened_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

-- -----------------------------------------------------------------------------
-- 12. suppliers + material carts (structural; P00 scan handoff disabled)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  city text,
  address text,
  contact_phone text,
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.project_material_carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE UNIQUE,
  provider_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_amount_cfa numeric NOT NULL DEFAULT 0,
  labor_amount_cfa numeric,
  status text NOT NULL DEFAULT 'draft',
  payment_status text NOT NULL DEFAULT 'unpaid',
  approved_at timestamptz,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 13. provider_advances (structural stub — accounting meaning deferred)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.provider_advances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_minor bigint,
  currency char(3) NOT NULL DEFAULT 'XAF',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 14. hidden_projects (provider market preference)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.hidden_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_id, project_id)
);

-- -----------------------------------------------------------------------------
-- 15. project_defects (warranty reporting)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.project_defects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  reported_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 16. Safe workflow RPCs (no money movement)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_provider_stats(p_provider_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT jsonb_build_object(
    'completion_rate', COALESCE(
      (SELECT CASE
        WHEN COUNT(*) FILTER (WHERE status = 'completed') = 0 THEN 0
        ELSE 100.0 * COUNT(*) FILTER (WHERE status = 'completed') / NULLIF(COUNT(*), 0)
      END
      FROM public.projects WHERE assigned_provider_id = p_provider_id),
      0
    ),
    'avg_review_score', COALESCE(
      (SELECT AVG(rating)::numeric(5,2) FROM public.reviews WHERE provider_id = p_provider_id),
      0
    ),
    'dispute_count', COALESCE(
      (SELECT COUNT(*) FROM public.project_disputes pd
       JOIN public.projects p ON p.id = pd.project_id AND p.assigned_provider_id = p_provider_id),
      0
    ),
    'completed_projects_count', COALESCE(
      (SELECT COUNT(*) FROM public.projects WHERE assigned_provider_id = p_provider_id AND status = 'completed'),
      0
    )
  );
$$;

REVOKE ALL ON FUNCTION public.get_provider_stats(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_provider_stats(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_provider_advance_eligibility(p_provider_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  WITH stats AS (
    SELECT public.get_provider_stats(p_provider_id) AS s
  )
  SELECT jsonb_build_object(
    'eligible', (
      (stats.s->>'completion_rate')::numeric >= 90
      AND ((stats.s->>'completed_projects_count')::int) >= 3
    ),
    'completion_rate', (stats.s->>'completion_rate')::numeric,
    'completed_projects_count', (stats.s->>'completed_projects_count')::int,
    'max_advance_pct', 20
  ) FROM stats;
$$;

REVOKE ALL ON FUNCTION public.get_provider_advance_eligibility(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_provider_advance_eligibility(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.trigger_dispute(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_project public.projects%ROWTYPE;
  v_admin_id uuid;
  v_count int := 0;
BEGIN
  IF NOT public.user_can_write_project(p_project_id) THEN
    RAISE EXCEPTION 'not authorized to dispute this project' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_project FROM public.projects WHERE id = p_project_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'project not found';
  END IF;

  IF v_project.status = 'disputed' THEN
    RETURN jsonb_build_object('ok', true, 'already_disputed', true);
  END IF;

  UPDATE public.projects SET status = 'disputed', updated_at = now() WHERE id = p_project_id;

  FOR v_admin_id IN
    SELECT user_id FROM public.platform_admins WHERE is_active
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type, is_read, project_id, route)
    VALUES (
      v_admin_id,
      'Project dispute opened',
      'Project "' || COALESCE(v_project.title, p_project_id::text) || '" marked disputed.',
      'project_disputed',
      false,
      p_project_id,
      'admin/disputes'
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'admins_notified', v_count);
END;
$$;

REVOKE ALL ON FUNCTION public.trigger_dispute(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.trigger_dispute(uuid) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 17. RLS — default deny; P00 predicates preserved for milestones
-- -----------------------------------------------------------------------------

ALTER TABLE public.project_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_material_carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hidden_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_defects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_applications_select" ON public.project_applications;
CREATE POLICY "project_applications_select" ON public.project_applications FOR SELECT USING (
  provider_id = auth.uid()
  OR project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid())
);
DROP POLICY IF EXISTS "project_applications_insert" ON public.project_applications;
CREATE POLICY "project_applications_insert" ON public.project_applications FOR INSERT WITH CHECK (provider_id = auth.uid());
DROP POLICY IF EXISTS "project_applications_update" ON public.project_applications;
CREATE POLICY "project_applications_update" ON public.project_applications FOR UPDATE USING (
  provider_id = auth.uid() OR project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid())
);

DROP POLICY IF EXISTS "messages_select" ON public.messages;
CREATE POLICY "messages_select" ON public.messages FOR SELECT USING (public.user_can_read_project(project_id));
DROP POLICY IF EXISTS "messages_insert" ON public.messages;
CREATE POLICY "messages_insert" ON public.messages FOR INSERT WITH CHECK (
  public.user_can_read_project(project_id) AND sender_id = auth.uid()
);

DROP POLICY IF EXISTS "notifications_select" ON public.notifications;
CREATE POLICY "notifications_select" ON public.notifications FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "notifications_update" ON public.notifications;
CREATE POLICY "notifications_update" ON public.notifications FOR UPDATE USING (user_id = auth.uid());
DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;
CREATE POLICY "notifications_insert" ON public.notifications FOR INSERT WITH CHECK (
  auth.uid() IN (
    SELECT owner_id FROM public.projects WHERE id = project_id
    UNION SELECT assigned_provider_id FROM public.projects WHERE id = project_id
  )
);

DROP POLICY IF EXISTS "reviews_select" ON public.reviews;
CREATE POLICY "reviews_select" ON public.reviews FOR SELECT USING (
  client_id = auth.uid() OR provider_id = auth.uid()
  OR project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid() OR assigned_provider_id = auth.uid())
);
DROP POLICY IF EXISTS "reviews_insert" ON public.reviews;
CREATE POLICY "reviews_insert" ON public.reviews FOR INSERT WITH CHECK (client_id = auth.uid());

DROP POLICY IF EXISTS "project_updates_select" ON public.project_updates;
CREATE POLICY "project_updates_select" ON public.project_updates FOR SELECT USING (public.user_can_read_project(project_id));
DROP POLICY IF EXISTS "project_updates_insert" ON public.project_updates;
CREATE POLICY "project_updates_insert" ON public.project_updates FOR INSERT WITH CHECK (
  public.user_can_write_project(project_id) AND author_id = auth.uid()
);

DROP POLICY IF EXISTS "project_expenses_select" ON public.project_expenses;
CREATE POLICY "project_expenses_select" ON public.project_expenses FOR SELECT USING (public.user_can_read_project(project_id));
DROP POLICY IF EXISTS "project_expenses_insert" ON public.project_expenses;
CREATE POLICY "project_expenses_insert" ON public.project_expenses FOR INSERT WITH CHECK (
  public.user_can_write_project(project_id)
);
DROP POLICY IF EXISTS "project_expenses_update" ON public.project_expenses;
CREATE POLICY "project_expenses_update" ON public.project_expenses FOR UPDATE USING (
  public.user_can_write_project(project_id)
);

DROP POLICY IF EXISTS "project_contracts_select" ON public.project_contracts;
CREATE POLICY "project_contracts_select" ON public.project_contracts FOR SELECT USING (
  public.user_can_read_project(project_id)
);
DROP POLICY IF EXISTS "project_contracts_insert" ON public.project_contracts;
CREATE POLICY "project_contracts_insert" ON public.project_contracts FOR INSERT WITH CHECK (
  public.user_can_write_project(project_id)
);
DROP POLICY IF EXISTS "project_contracts_update" ON public.project_contracts;
CREATE POLICY "project_contracts_update" ON public.project_contracts FOR UPDATE USING (
  public.user_can_write_project(project_id)
);

DROP POLICY IF EXISTS "project_disputes_select" ON public.project_disputes;
CREATE POLICY "project_disputes_select" ON public.project_disputes FOR SELECT USING (
  public.user_can_read_project(project_id)
);
DROP POLICY IF EXISTS "project_disputes_insert" ON public.project_disputes;
CREATE POLICY "project_disputes_insert" ON public.project_disputes FOR INSERT WITH CHECK (
  public.user_can_write_project(project_id)
);

DROP POLICY IF EXISTS "suppliers_select" ON public.suppliers;
CREATE POLICY "suppliers_select" ON public.suppliers FOR SELECT USING (true);

DROP POLICY IF EXISTS "material_carts_select" ON public.project_material_carts;
CREATE POLICY "material_carts_select" ON public.project_material_carts FOR SELECT USING (
  provider_id = auth.uid()
  OR project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid())
);
DROP POLICY IF EXISTS "material_carts_insert" ON public.project_material_carts;
CREATE POLICY "material_carts_insert" ON public.project_material_carts FOR INSERT WITH CHECK (provider_id = auth.uid());
DROP POLICY IF EXISTS "material_carts_update" ON public.project_material_carts;
CREATE POLICY "material_carts_update" ON public.project_material_carts FOR UPDATE USING (
  provider_id = auth.uid()
  OR project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid())
);

DROP POLICY IF EXISTS "provider_advances_select" ON public.provider_advances;
CREATE POLICY "provider_advances_select" ON public.provider_advances FOR SELECT USING (
  provider_id = auth.uid() OR project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid())
);
DROP POLICY IF EXISTS "provider_advances_insert" ON public.provider_advances;
CREATE POLICY "provider_advances_insert" ON public.provider_advances FOR INSERT WITH CHECK (provider_id = auth.uid());

DROP POLICY IF EXISTS "hidden_projects_all" ON public.hidden_projects;
CREATE POLICY "hidden_projects_all" ON public.hidden_projects FOR ALL USING (provider_id = auth.uid()) WITH CHECK (provider_id = auth.uid());

DROP POLICY IF EXISTS "project_defects_select" ON public.project_defects;
CREATE POLICY "project_defects_select" ON public.project_defects FOR SELECT USING (public.user_can_read_project(project_id));
DROP POLICY IF EXISTS "project_defects_insert" ON public.project_defects;
CREATE POLICY "project_defects_insert" ON public.project_defects FOR INSERT WITH CHECK (
  public.user_can_read_project(project_id) AND reported_by = auth.uid()
);

-- Dispute lock: block project updates when disputed (except service_role)
DROP POLICY IF EXISTS "projects_update" ON public.projects;
CREATE POLICY "projects_update" ON public.projects FOR UPDATE USING (
  (owner_id = auth.uid() OR assigned_provider_id = auth.uid())
  AND status IS DISTINCT FROM 'disputed'
);
