-- Task 2: Compliance/AML, Multi-Sig Funders, Micro-Insurance
-- AML: Escrow deposit > threshold flags project for manual admin clearance.
-- Multi-sig: funder_ids array and approvals required before release.
-- Insurance: 1.5% fee to platform insurance wallet when insurance_premium = true.

-- ========== 1. AML & Compliance ==========
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS compliance_review_pending boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS compliance_cleared_at timestamptz,
  ADD COLUMN IF NOT EXISTS compliance_cleared_by uuid REFERENCES auth.users(id);

COMMENT ON COLUMN public.projects.compliance_review_pending IS 'AML: true when escrow deposit exceeds threshold; project cannot proceed until admin clears.';
COMMENT ON COLUMN public.projects.compliance_cleared_at IS 'When an admin cleared the compliance review.';
COMMENT ON COLUMN public.projects.compliance_cleared_by IS 'Admin user who cleared the compliance review.';

-- Allow status to reflect compliance hold (use existing status or keep escrow_funded gated by compliance_cleared)
-- Projects with compliance_review_pending = true should not be treated as fully escrow_funded until cleared.

-- ========== 2. Multi-Sig Family Funders ==========
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS funder_ids uuid[] DEFAULT '{}';

COMMENT ON COLUMN public.projects.funder_ids IS 'Multi-sig: array of auth.users ids who must each Approve before escrow release.';

CREATE TABLE IF NOT EXISTS public.escrow_funder_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  funder_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  approval_signature_hash text,
  approved_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, funder_id)
);

CREATE INDEX IF NOT EXISTS idx_escrow_funder_approvals_project ON public.escrow_funder_approvals(project_id);
CREATE INDEX IF NOT EXISTS idx_escrow_funder_approvals_funder ON public.escrow_funder_approvals(funder_id);

ALTER TABLE public.escrow_funder_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "escrow_funder_approvals_select" ON public.escrow_funder_approvals FOR SELECT USING (
  public.user_can_access_project(project_id) OR funder_id = auth.uid()
);
CREATE POLICY "escrow_funder_approvals_insert" ON public.escrow_funder_approvals FOR INSERT WITH CHECK (funder_id = auth.uid());
CREATE POLICY "escrow_funder_approvals_update" ON public.escrow_funder_approvals FOR UPDATE USING (funder_id = auth.uid());

-- RPC: Check if all registered funders have approved (for use by Edge Function before releasing funds)
CREATE OR REPLACE FUNCTION public.escrow_all_funders_approved(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT COUNT(*) = cardinality(COALESCE(p.funder_ids, ARRAY[]::uuid[]))
      FROM public.projects p
      LEFT JOIN public.escrow_funder_approvals a ON a.project_id = p.id AND a.funder_id = ANY(COALESCE(p.funder_ids, ARRAY[]::uuid[]))
      WHERE p.id = p_project_id
        AND (cardinality(COALESCE(p.funder_ids, ARRAY[]::uuid[])) = 0 OR a.funder_id IS NOT NULL)
    ),
    false
  );
$$;

COMMENT ON FUNCTION public.escrow_all_funders_approved IS 'Returns true if project has no funders or every funder in funder_ids has an approval row.';

-- RPC: Release escrow only when all funders have approved (then call release_milestone internally)
CREATE OR REPLACE FUNCTION public.release_escrow_after_approvals(
  p_project_id uuid,
  p_provider_id uuid,
  p_amount numeric,
  p_desc text DEFAULT 'Milestone release'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.escrow_all_funders_approved(p_project_id) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'All registered funders must approve before release. Use escrow_funder_approvals to record approvals.'
    );
  END IF;

  PERFORM public.release_milestone(p_project_id, p_provider_id, p_amount, p_desc);
  RETURN jsonb_build_object('ok', true, 'message', 'Released after multi-sig approval.');
END;
$$;

COMMENT ON FUNCTION public.release_escrow_after_approvals IS 'Multi-sig: runs release_milestone only when every funder in project.funder_ids has an approval in escrow_funder_approvals.';

-- ========== 3. Micro-Insurance ==========
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS insurance_premium boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS insurance_provider text;

COMMENT ON COLUMN public.projects.insurance_premium IS 'If true, Escrow engine splits 1.5% to platform insurance wallet on funding.';
COMMENT ON COLUMN public.projects.insurance_provider IS 'Optional provider name for the micro-insurance.';
