-- =============================================================================
-- Phase 5 — Canonical money model tests (staging-safe; no ledger mutation)
-- Run: pipe to psql against staging OR apply after migration 20260902100000
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Currency registry
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT count(*) INTO v_count FROM public.platform_currencies WHERE code = 'XAF';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'FAIL: XAF currency row missing';
  END IF;
  RAISE NOTICE 'PASS currency XAF registered';
END
$$;

DO $$
BEGIN
  PERFORM public.platform_assert_settlement_currency('XAF');
  RAISE NOTICE 'PASS valid XAF currency accepted';
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'FAIL: XAF should be valid: %', SQLERRM;
END
$$;

DO $$
BEGIN
  PERFORM public.platform_assert_settlement_currency('EUR');
  RAISE EXCEPTION 'FAIL: EUR should be rejected in Phase 5';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM NOT LIKE '%invalid settlement currency%' THEN
    RAISE EXCEPTION 'FAIL: wrong error for invalid currency: %', SQLERRM;
  END IF;
  RAISE NOTICE 'PASS invalid currency rejected';
END
$$;

-- ---------------------------------------------------------------------------
-- Fee math (deterministic integer)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_fee bigint;
BEGIN
  v_fee := public.platform_fee_insurance_minor(0);
  IF v_fee <> 0 THEN RAISE EXCEPTION 'FAIL: zero gross fee'; END IF;

  v_fee := public.platform_fee_insurance_minor(1);
  IF v_fee <> 0 THEN RAISE EXCEPTION 'FAIL: 1 XAF fee expected 0 got %', v_fee; END IF;

  v_fee := public.platform_fee_insurance_minor(1000000);
  IF v_fee <> 15000 THEN
    RAISE EXCEPTION 'FAIL: 1M * 1.5%% expected 15000 got %', v_fee;
  END IF;

  -- Match TRUNC(numeric * 0.015) for sample
  IF public.platform_fee_insurance_minor(333333) <> trunc(333333 * 0.015)::bigint THEN
    RAISE EXCEPTION 'FAIL: fee mismatch vs TRUNC(*0.015) for 333333';
  END IF;

  RAISE NOTICE 'PASS insurance fee integer math';
END
$$;

DO $$
BEGIN
  IF public.platform_fee_bps_minor(10000, 150) <> 150 THEN
    RAISE EXCEPTION 'FAIL: bps fee calculation';
  END IF;
  RAISE NOTICE 'PASS generic bps fee';
END
$$;

-- ---------------------------------------------------------------------------
-- Amount resolution precedence
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF public.platform_resolve_amount_minor(500, 999, 888) <> 500 THEN
    RAISE EXCEPTION 'FAIL: amount_minor precedence';
  END IF;
  IF public.platform_resolve_amount_minor(NULL, 200, 100) <> 200 THEN
    RAISE EXCEPTION 'FAIL: amount_cfa fallback';
  END IF;
  IF public.platform_resolve_amount_minor(NULL, NULL, 75) <> 75 THEN
    RAISE EXCEPTION 'FAIL: amount fallback';
  END IF;
  RAISE NOTICE 'PASS amount resolution precedence';
END
$$;

DO $$
BEGIN
  IF NOT public.platform_milestone_amounts_conflict(100, 200::numeric, NULL) THEN
    RAISE EXCEPTION 'FAIL: should detect amount_minor vs amount_cfa conflict';
  END IF;
  IF public.platform_milestone_amounts_conflict(100, 100::numeric, NULL) THEN
    RAISE EXCEPTION 'FAIL: should not conflict when equal';
  END IF;
  RAISE NOTICE 'PASS dual-column conflict detection';
END
$$;

-- ---------------------------------------------------------------------------
-- Schema columns (when tables exist)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.milestones') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'milestones'
        AND column_name = 'amount_minor'
    ) THEN
      RAISE EXCEPTION 'FAIL: milestones.amount_minor missing';
    END IF;
  END IF;
  IF to_regclass('public.projects') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'projects'
        AND column_name = 'estimated_budget_minor'
    ) THEN
      RAISE EXCEPTION 'FAIL: projects.estimated_budget_minor missing';
    END IF;
  END IF;
  RAISE NOTICE 'PASS canonical columns present on workflow tables';
END
$$;

-- ---------------------------------------------------------------------------
-- Regression: ledger unchanged by Phase 5 (no journals/lines/money created)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_j int;
  v_l int;
  v_bal bigint;
BEGIN
  SELECT count(*)::int, coalesce(sum(balance_xaf), 0)::bigint
    INTO v_j, v_bal
  FROM public.ledger_accounts;

  SELECT count(*)::int INTO v_l FROM public.ledger_journals;

  IF (SELECT count(*) FROM public.ledger_lines) <> 0 THEN
    RAISE EXCEPTION 'FAIL: ledger_lines should remain empty after Phase 5';
  END IF;

  IF v_l <> 0 THEN
    RAISE EXCEPTION 'FAIL: ledger_journals should remain empty after Phase 5';
  END IF;

  IF v_bal <> 0 THEN
    RAISE EXCEPTION 'FAIL: total ledger balance must remain 0, got %', v_bal;
  END IF;

  RAISE NOTICE 'PASS ledger financially unchanged (balance=0, no journals)';
END
$$;

-- ---------------------------------------------------------------------------
-- Phase 3B objects still absent
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.payments') IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: payments table should not exist before Phase 3B apply';
  END IF;
  IF to_regclass('public.escrow_funder_approvals') IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: escrow_funder_approvals should not exist before Phase 3B.0 apply';
  END IF;
  RAISE NOTICE 'PASS Phase 3B objects still absent';
END
$$;

ROLLBACK;
