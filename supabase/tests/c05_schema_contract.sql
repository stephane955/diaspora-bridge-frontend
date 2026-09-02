-- =============================================================================
-- C05 schema contract — run after clean db reset with C05 active (8 migrations)
-- =============================================================================

DO $$
DECLARE
  v_has_insert boolean;
BEGIN
  -- Foundation still present
  IF to_regclass('public.projects') IS NULL THEN
    RAISE EXCEPTION 'C05 FAIL: projects missing';
  END IF;
  IF to_regclass('public.platform_admins') IS NULL THEN
    RAISE EXCEPTION 'C05 FAIL: platform_admins missing';
  END IF;
  IF to_regprocedure('public.user_can_write_project(uuid)') IS NULL THEN
    RAISE EXCEPTION 'C05 FAIL: user_can_write_project missing';
  END IF;

  -- C05 objects present
  IF to_regclass('public.escrow_funding_requests') IS NULL THEN
    RAISE EXCEPTION 'C05 FAIL: escrow_funding_requests missing';
  END IF;
  IF to_regclass('public.escrow_funder_approvals') IS NULL THEN
    RAISE EXCEPTION 'C05 FAIL: escrow_funder_approvals missing';
  END IF;

  -- Required columns on funding requests
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='escrow_funding_requests' AND column_name='amount_xaf'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='escrow_funding_requests' AND column_name='requested_by'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='escrow_funding_requests' AND column_name='status'
  ) THEN
    RAISE EXCEPTION 'C05 FAIL: escrow_funding_requests missing required columns';
  END IF;

  -- Approval unique (request, funder)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'escrow_funder_approvals_request_funder_uidx'
  ) THEN
    RAISE EXCEPTION 'C05 FAIL: UNIQUE(funding_request_id, funder_id) missing';
  END IF;

  -- No signature hash theater
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='escrow_funder_approvals'
      AND column_name='approval_signature_hash'
  ) THEN
    RAISE EXCEPTION 'C05 FAIL: approval_signature_hash must not exist';
  END IF;

  -- RPCs / helpers
  IF to_regprocedure('public.rpc_create_funding_request(uuid,bigint,uuid)') IS NULL THEN
    RAISE EXCEPTION 'C05 FAIL: rpc_create_funding_request missing';
  END IF;
  IF to_regprocedure('public.rpc_approve_funding_request(uuid)') IS NULL THEN
    RAISE EXCEPTION 'C05 FAIL: rpc_approve_funding_request missing';
  END IF;
  IF to_regprocedure('public.rpc_revoke_funding_approval(uuid)') IS NULL THEN
    RAISE EXCEPTION 'C05 FAIL: rpc_revoke_funding_approval missing';
  END IF;
  IF to_regprocedure('public.rpc_set_project_funders(uuid,uuid[])') IS NULL THEN
    RAISE EXCEPTION 'C05 FAIL: rpc_set_project_funders missing';
  END IF;
  IF to_regprocedure('public.escrow_all_funders_approved_for_request(uuid)') IS NULL THEN
    RAISE EXCEPTION 'C05 FAIL: escrow_all_funders_approved_for_request missing';
  END IF;
  IF to_regprocedure('public.escrow_all_funders_approved(uuid)') IS NOT NULL THEN
    RAISE EXCEPTION 'C05 FAIL: legacy project-scoped helper must be absent';
  END IF;

  -- RLS enabled
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.escrow_funding_requests'::regclass) THEN
    RAISE EXCEPTION 'C05 FAIL: escrow_funding_requests RLS must be ON';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.escrow_funder_approvals'::regclass) THEN
    RAISE EXCEPTION 'C05 FAIL: escrow_funder_approvals RLS must be ON';
  END IF;

  -- Direct INSERT privilege denied for authenticated
  SELECT has_table_privilege('authenticated', 'public.escrow_funding_requests', 'INSERT')
    INTO v_has_insert;
  IF v_has_insert THEN
    RAISE EXCEPTION 'C05 FAIL: authenticated INSERT on escrow_funding_requests must be denied';
  END IF;
  SELECT has_table_privilege('authenticated', 'public.escrow_funder_approvals', 'INSERT')
    INTO v_has_insert;
  IF v_has_insert THEN
    RAISE EXCEPTION 'C05 FAIL: authenticated INSERT on escrow_funder_approvals must be denied';
  END IF;

  -- C06 / release still absent from C05 contract perspective:
  -- After C06 apply, payments MAY exist. Assert release still absent.
  IF to_regprocedure('public.rpc_release_milestone(uuid)') IS NOT NULL THEN
    RAISE EXCEPTION 'C05 FAIL: rpc_release_milestone must remain absent';
  END IF;

  -- Ledger clean invariant
  IF (SELECT count(*) FROM public.ledger_journals) <> 0 THEN
    RAISE EXCEPTION 'C05 FAIL: ledger journals must be 0';
  END IF;
  IF (SELECT COALESCE(sum(balance_xaf),0) FROM public.ledger_accounts) <> 0 THEN
    RAISE EXCEPTION 'C05 FAIL: ledger XAF must be 0';
  END IF;
END $$;

SELECT 'c05_schema_contract.sql: PASS' AS result;
