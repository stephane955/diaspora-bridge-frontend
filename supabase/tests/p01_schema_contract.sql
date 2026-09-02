-- =============================================================================
-- P01 schema contract — run after clean db reset
-- =============================================================================

DO $$
BEGIN
  -- Required P01 tables
  IF to_regclass('public.project_applications') IS NULL THEN
    RAISE EXCEPTION 'P01 FAIL: project_applications missing';
  END IF;
  IF to_regclass('public.messages') IS NULL THEN
    RAISE EXCEPTION 'P01 FAIL: messages missing';
  END IF;
  IF to_regclass('public.notifications') IS NULL THEN
    RAISE EXCEPTION 'P01 FAIL: notifications missing';
  END IF;
  IF to_regclass('public.platform_admins') IS NULL THEN
    RAISE EXCEPTION 'P01 FAIL: platform_admins missing';
  END IF;

  -- Forbidden future objects (C06+ remain absent; C05 is now in active chain)
  IF to_regclass('public.payments') IS NOT NULL THEN
    RAISE EXCEPTION 'P01 FAIL: payments must not exist before C06';
  END IF;
  IF to_regprocedure('public.rpc_release_milestone(uuid)') IS NOT NULL THEN
    RAISE EXCEPTION 'P01 FAIL: rpc_release_milestone must not exist before C07';
  END IF;
  IF to_regprocedure('public.release_milestone(uuid,numeric)') IS NOT NULL THEN
    RAISE EXCEPTION 'P01 FAIL: legacy release_milestone must not exist';
  END IF;

  -- P00 functions
  IF to_regprocedure('public.has_admin_role(public.platform_admin_role)') IS NULL THEN
    RAISE EXCEPTION 'P01 FAIL: has_admin_role missing';
  END IF;
  IF to_regprocedure('public.user_can_write_project(uuid)') IS NULL THEN
    RAISE EXCEPTION 'P01 FAIL: user_can_write_project missing';
  END IF;
  IF to_regprocedure('public.ledger_healthcheck()') IS NULL THEN
    RAISE EXCEPTION 'P01 FAIL: ledger_healthcheck missing';
  END IF;

  -- RLS on legacy financial tables
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.transactions'::regclass) THEN
    RAISE EXCEPTION 'P01 FAIL: transactions RLS must be ON';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.withdrawals'::regclass) THEN
    RAISE EXCEPTION 'P01 FAIL: withdrawals RLS must be ON';
  END IF;

  -- Canonical money columns
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'milestones' AND column_name = 'amount_minor'
  ) THEN
    RAISE EXCEPTION 'P01 FAIL: milestones.amount_minor missing';
  END IF;
END $$;

SELECT 'p01_schema_contract.sql: PASS' AS result;
