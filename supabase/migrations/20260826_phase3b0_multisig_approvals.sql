-- =============================================================================
-- Diaspora Bridge — Phase 3B.0 surgical multi-sig dependency
-- Extracted from compliance_aml_escrow_insurance.sql (multi-sig section only).
-- Adds D2 72-hour expiry on approved_at (frozen financial decision).
-- DOES NOT include: AML columns, insurance columns,
--                   release_escrow_after_approvals (legacy release_milestone).
-- Adds funder_ids via ADD COLUMN IF NOT EXISTS only (no-op when already present).
-- Does NOT modify compliance_aml_escrow_insurance.sql.
-- DO NOT apply to live until operator requests.
-- =============================================================================

-- Prerequisite: multi-sig funder list column (no-op if already present)
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS funder_ids uuid[] DEFAULT '{}';

-- Table + indexes (repository design preserved)
CREATE TABLE IF NOT EXISTS public.escrow_funder_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  funder_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  approval_signature_hash text,
  approved_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, funder_id)
);

CREATE INDEX IF NOT EXISTS idx_escrow_funder_approvals_project
  ON public.escrow_funder_approvals (project_id);

CREATE INDEX IF NOT EXISTS idx_escrow_funder_approvals_funder
  ON public.escrow_funder_approvals (funder_id);

ALTER TABLE public.escrow_funder_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "escrow_funder_approvals_select" ON public.escrow_funder_approvals;
DROP POLICY IF EXISTS "escrow_funder_approvals_insert" ON public.escrow_funder_approvals;
DROP POLICY IF EXISTS "escrow_funder_approvals_update" ON public.escrow_funder_approvals;
DROP POLICY IF EXISTS "escrow_funder_approvals_delete" ON public.escrow_funder_approvals;

-- SELECT: own approval rows, or project participants via user_can_access_project
-- (owner / assigned provider / observer — does NOT authorize funders for writes)
CREATE POLICY "escrow_funder_approvals_select" ON public.escrow_funder_approvals
  FOR SELECT USING (
    funder_id = auth.uid()
    OR public.user_can_access_project(project_id)
  );

-- INSERT/UPDATE: must be self AND listed on projects.funder_ids (user_can_access_project excludes funders)
CREATE POLICY "escrow_funder_approvals_insert" ON public.escrow_funder_approvals
  FOR INSERT WITH CHECK (
    funder_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = project_id
        AND auth.uid() = ANY (COALESCE(p.funder_ids, ARRAY[]::uuid[]))
    )
  );

CREATE POLICY "escrow_funder_approvals_update" ON public.escrow_funder_approvals
  FOR UPDATE
  USING (
    funder_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = project_id
        AND auth.uid() = ANY (COALESCE(p.funder_ids, ARRAY[]::uuid[]))
    )
  )
  WITH CHECK (
    funder_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = project_id
        AND auth.uid() = ANY (COALESCE(p.funder_ids, ARRAY[]::uuid[]))
    )
  );

-- No DELETE policy → deny for non-owner roles under RLS

-- Server-controlled approved_at + immutable identity keys.
-- Clients may INSERT/UPDATE only via RLS; they cannot set future/past approved_at
-- or move an approval to another project/funder.
CREATE OR REPLACE FUNCTION public.escrow_funder_approvals_before_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.project_id IS DISTINCT FROM OLD.project_id
       OR NEW.funder_id IS DISTINCT FROM OLD.funder_id
       OR NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'escrow_funder_approvals project_id/funder_id/id are immutable'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- Always server-side clock (blocks manufactured future/past validity windows)
  NEW.approved_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS escrow_funder_approvals_immutable_keys_trg
  ON public.escrow_funder_approvals;
DROP TRIGGER IF EXISTS escrow_funder_approvals_before_write_trg
  ON public.escrow_funder_approvals;
CREATE TRIGGER escrow_funder_approvals_before_write_trg
  BEFORE INSERT OR UPDATE ON public.escrow_funder_approvals
  FOR EACH ROW
  EXECUTE FUNCTION public.escrow_funder_approvals_before_write();

-- Fail loud if a pre-existing table lacks the Phase 3B0 contract
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'escrow_funder_approvals'
      AND column_name = 'approved_at'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.escrow_funder_approvals'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) ILIKE '%project_id%'
      AND pg_get_constraintdef(oid) ILIKE '%funder_id%'
  ) THEN
    RAISE EXCEPTION
      'public.escrow_funder_approvals exists but does not match Phase 3B0 schema — STOP'
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

REVOKE ALL ON TABLE public.escrow_funder_approvals FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.escrow_funder_approvals TO authenticated;
REVOKE DELETE ON TABLE public.escrow_funder_approvals FROM authenticated;
GRANT SELECT ON TABLE public.escrow_funder_approvals TO service_role;
REVOKE ALL ON FUNCTION public.escrow_funder_approvals_before_write() FROM PUBLIC, anon, authenticated;
-- Drop superseded trigger function if present from earlier hardening
DROP FUNCTION IF EXISTS public.escrow_funder_approvals_immutable_keys();

-- D2: N-of-N + 72h unexpired approvals (approved_at window)
CREATE OR REPLACE FUNCTION public.escrow_all_funders_approved(p_project_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_funders uuid[];
  v_needed int;
  v_ok int;
BEGIN
  SELECT COALESCE(funder_ids, ARRAY[]::uuid[])
    INTO v_funders
  FROM public.projects
  WHERE id = p_project_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  v_needed := cardinality(v_funders);
  IF v_needed = 0 THEN
    RETURN true;
  END IF;

  SELECT COUNT(*)::integer
    INTO v_ok
  FROM unnest(v_funders) AS f(fid)
  WHERE EXISTS (
    SELECT 1
    FROM public.escrow_funder_approvals a
    WHERE a.project_id = p_project_id
      AND a.funder_id = f.fid
      AND a.approved_at >= (now() - interval '72 hours')
  );

  RETURN v_ok = v_needed;
END;
$$;

COMMENT ON FUNCTION public.escrow_all_funders_approved(uuid) IS
  'D2 helper semantics: card(funder_ids)=0 → true; card>=1 → every listed funder has approval with server approved_at within 72h. Phase 3B rpc_create_payment_intent invokes this only when card>1 (card 0/1 funding gate skipped per product rule).';

COMMENT ON TABLE public.escrow_funder_approvals IS
  'Multi-sig funder approvals (N-of-N). Extracted for Phase 3B; 72h validity enforced by escrow_all_funders_approved.';

REVOKE ALL ON FUNCTION public.escrow_all_funders_approved(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.escrow_all_funders_approved(uuid) TO authenticated, service_role;
