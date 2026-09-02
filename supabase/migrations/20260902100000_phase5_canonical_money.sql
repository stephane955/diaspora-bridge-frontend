-- =============================================================================
-- Diaspora Bridge — Phase 5: Canonical financial model (XAF settlement)
-- Additive only. Does NOT mutate ledger balances or backfill legacy money.
-- Does NOT apply Phase 3B. Staging/production-safe idempotent column adds.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Settlement currency registry (XAF only for Phase 5)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.platform_currencies (
  code char(3) PRIMARY KEY,
  minor_units smallint NOT NULL CHECK (minor_units BETWEEN 0 AND 4),
  name text NOT NULL,
  is_settlement boolean NOT NULL DEFAULT false,
  is_funding boolean NOT NULL DEFAULT false
);

INSERT INTO public.platform_currencies (code, minor_units, name, is_settlement, is_funding)
VALUES ('XAF', 0, 'CFA Franc BEAC', true, true)
ON CONFLICT (code) DO NOTHING;

COMMENT ON TABLE public.platform_currencies IS
  'Controlled currency registry. Phase 5: XAF only. FX/funding currencies deferred.';

-- -----------------------------------------------------------------------------
-- 2. Integer fee helpers (deterministic; no floating point)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.platform_fee_bps_minor(
  p_amount_minor bigint,
  p_basis_points integer
)
RETURNS bigint
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT (p_amount_minor * p_basis_points::bigint) / 10000;
$$;

COMMENT ON FUNCTION public.platform_fee_bps_minor(bigint, integer) IS
  'Fee as basis points on integer minor units; truncates toward zero.';

CREATE OR REPLACE FUNCTION public.platform_fee_insurance_minor(p_gross_minor bigint)
RETURNS bigint
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT public.platform_fee_bps_minor(p_gross_minor, 150);
$$;

COMMENT ON FUNCTION public.platform_fee_insurance_minor(bigint) IS
  'Insurance fee at 1.5% (150 bps). Matches Phase 3B TRUNC(amount_xaf * 0.015) for non-negative integers.';

CREATE OR REPLACE FUNCTION public.platform_assert_settlement_currency(p_currency char(3))
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_currency IS NULL OR p_currency <> 'XAF' THEN
    RAISE EXCEPTION 'invalid settlement currency: % (Phase 5: XAF only)', p_currency
      USING ERRCODE = '23514';
  END IF;
END;
$$;

-- Resolve canonical minor from legacy dual columns (read helper; does not write)
CREATE OR REPLACE FUNCTION public.platform_resolve_amount_minor(
  p_amount_minor bigint,
  p_amount_cfa numeric,
  p_amount numeric
)
RETURNS bigint
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    p_amount_minor,
    CASE WHEN p_amount_cfa IS NOT NULL THEN trunc(p_amount_cfa)::bigint END,
    CASE WHEN p_amount IS NOT NULL THEN trunc(p_amount)::bigint END,
    0::bigint
  );
$$;

COMMENT ON FUNCTION public.platform_resolve_amount_minor(bigint, numeric, numeric) IS
  'Precedence: amount_minor > amount_cfa > amount. Workflow/read helper only.';

-- Detect conflicting legacy milestone amounts (when columns exist)
CREATE OR REPLACE FUNCTION public.platform_milestone_amounts_conflict(
  p_amount_minor bigint,
  p_amount_cfa numeric,
  p_amount numeric
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    (p_amount_minor IS NOT NULL AND p_amount_cfa IS NOT NULL AND trunc(p_amount_cfa)::bigint IS DISTINCT FROM p_amount_minor)
    OR (p_amount_minor IS NOT NULL AND p_amount IS NOT NULL AND trunc(p_amount)::bigint IS DISTINCT FROM p_amount_minor)
    OR (p_amount_cfa IS NOT NULL AND p_amount IS NOT NULL AND trunc(p_amount_cfa)::bigint IS DISTINCT FROM trunc(p_amount)::bigint);
$$;

-- -----------------------------------------------------------------------------
-- 3. Ledger documentation (existing columns ARE canonical for XAF)
-- -----------------------------------------------------------------------------

COMMENT ON COLUMN public.ledger_accounts.currency IS
  'Settlement currency (XAF). Authoritative.';
COMMENT ON COLUMN public.ledger_accounts.balance_xaf IS
  'Authoritative stored balance in whole XAF minor units (amount_minor when currency=XAF).';

COMMENT ON COLUMN public.ledger_journals.currency IS
  'Settlement currency for journal (XAF). Authoritative.';

COMMENT ON COLUMN public.ledger_lines.debit_xaf IS
  'Debit amount in whole XAF minor units (canonical amount_minor, debit side).';
COMMENT ON COLUMN public.ledger_lines.credit_xaf IS
  'Credit amount in whole XAF minor units (canonical amount_minor, credit side).';

-- -----------------------------------------------------------------------------
-- 4. Workflow tables — add canonical columns where tables exist (staging + future)
-- -----------------------------------------------------------------------------

DO $$
BEGIN
  IF to_regclass('public.projects') IS NOT NULL THEN
    ALTER TABLE public.projects
      ADD COLUMN IF NOT EXISTS currency char(3) NOT NULL DEFAULT 'XAF';
    ALTER TABLE public.projects
      ADD COLUMN IF NOT EXISTS estimated_budget_minor bigint;
    ALTER TABLE public.projects
      ADD COLUMN IF NOT EXISTS material_budget_minor bigint;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'projects_currency_xaf_chk' AND conrelid = 'public.projects'::regclass
    ) THEN
      ALTER TABLE public.projects
        ADD CONSTRAINT projects_currency_xaf_chk CHECK (currency = 'XAF');
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'projects_estimated_budget_minor_nonneg_chk'
        AND conrelid = 'public.projects'::regclass
    ) THEN
      ALTER TABLE public.projects
        ADD CONSTRAINT projects_estimated_budget_minor_nonneg_chk
        CHECK (estimated_budget_minor IS NULL OR estimated_budget_minor >= 0);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'projects_material_budget_minor_nonneg_chk'
        AND conrelid = 'public.projects'::regclass
    ) THEN
      ALTER TABLE public.projects
        ADD CONSTRAINT projects_material_budget_minor_nonneg_chk
        CHECK (material_budget_minor IS NULL OR material_budget_minor >= 0);
    END IF;

    COMMENT ON COLUMN public.projects.estimated_budget_minor IS
      'Non-authoritative project planning estimate (whole XAF). NOT escrow funded balance.';
    COMMENT ON COLUMN public.projects.material_budget_minor IS
      'Non-authoritative materials planning estimate (whole XAF). NOT cash held.';
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass('public.milestones') IS NOT NULL THEN
    ALTER TABLE public.milestones
      ADD COLUMN IF NOT EXISTS currency char(3) NOT NULL DEFAULT 'XAF';
    ALTER TABLE public.milestones
      ADD COLUMN IF NOT EXISTS amount_minor bigint;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'milestones_currency_xaf_chk' AND conrelid = 'public.milestones'::regclass
    ) THEN
      ALTER TABLE public.milestones
        ADD CONSTRAINT milestones_currency_xaf_chk CHECK (currency = 'XAF');
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'milestones_amount_minor_nonneg_chk'
        AND conrelid = 'public.milestones'::regclass
    ) THEN
      ALTER TABLE public.milestones
        ADD CONSTRAINT milestones_amount_minor_nonneg_chk
        CHECK (amount_minor IS NULL OR amount_minor >= 0);
    END IF;

    COMMENT ON COLUMN public.milestones.amount_minor IS
      'Canonical milestone contract amount (whole XAF). Authoritative for workflow quoting; financial settlement uses ledger.';
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass('public.withdrawals') IS NOT NULL THEN
    ALTER TABLE public.withdrawals
      ADD COLUMN IF NOT EXISTS currency char(3) DEFAULT 'XAF';
    ALTER TABLE public.withdrawals
      ADD COLUMN IF NOT EXISTS amount_minor bigint;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'withdrawals_currency_xaf_chk'
        AND conrelid = 'public.withdrawals'::regclass
    ) THEN
      ALTER TABLE public.withdrawals
        ADD CONSTRAINT withdrawals_currency_xaf_chk
        CHECK (currency IS NULL OR currency = 'XAF');
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'withdrawals_amount_minor_nonneg_chk'
        AND conrelid = 'public.withdrawals'::regclass
    ) THEN
      ALTER TABLE public.withdrawals
        ADD CONSTRAINT withdrawals_amount_minor_nonneg_chk
        CHECK (amount_minor IS NULL OR amount_minor >= 0);
    END IF;

    COMMENT ON COLUMN public.withdrawals.amount IS
      'LEGACY non-authoritative numeric amount. Prefer amount_minor. Do not use for ledger truth.';
    COMMENT ON COLUMN public.withdrawals.amount_minor IS
      'Canonical requested payout amount (whole XAF). Settlement requires future payout RPC + ledger.';
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass('public.transactions') IS NOT NULL THEN
    COMMENT ON TABLE public.transactions IS
      'LEGACY compatibility/history layer. NOT authoritative operational cash. Ledger is sole authority.';
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass('public.project_expenses') IS NOT NULL THEN
    ALTER TABLE public.project_expenses
      ADD COLUMN IF NOT EXISTS currency char(3) NOT NULL DEFAULT 'XAF';
    ALTER TABLE public.project_expenses
      ADD COLUMN IF NOT EXISTS receipt_amount_minor bigint;

    COMMENT ON COLUMN public.project_expenses.receipt_amount_minor IS
      'Evidence/receipt amount (whole XAF). NOT proof money moved — accounting requires ledger journal.';
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass('public.provider_advances') IS NOT NULL THEN
    ALTER TABLE public.provider_advances
      ADD COLUMN IF NOT EXISTS currency char(3) NOT NULL DEFAULT 'XAF';
    ALTER TABLE public.provider_advances
      ADD COLUMN IF NOT EXISTS amount_minor bigint;

    COMMENT ON COLUMN public.provider_advances.amount_cfa IS
      'LEGACY numeric. Prefer amount_minor. Accounting meaning: DESIGN BLOCKER until advance ledger path exists.';
    COMMENT ON COLUMN public.provider_advances.amount_minor IS
      'Requested advance amount (whole XAF). Disbursement requires future ledger RPC.';
  END IF;
END
$$;

-- -----------------------------------------------------------------------------
-- 5. Privileges on helper functions
-- -----------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.platform_fee_bps_minor(bigint, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.platform_fee_insurance_minor(bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.platform_assert_settlement_currency(char(3)) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.platform_resolve_amount_minor(bigint, numeric, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.platform_milestone_amounts_conflict(bigint, numeric, numeric) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.platform_fee_bps_minor(bigint, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.platform_fee_insurance_minor(bigint) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.platform_assert_settlement_currency(char(3)) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.platform_resolve_amount_minor(bigint, numeric, numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.platform_milestone_amounts_conflict(bigint, numeric, numeric) TO authenticated, service_role;

ALTER TABLE public.platform_currencies ENABLE ROW LEVEL SECURITY;
-- Read-only currency registry for authenticated users
DROP POLICY IF EXISTS platform_currencies_select ON public.platform_currencies;
CREATE POLICY platform_currencies_select ON public.platform_currencies
  FOR SELECT TO authenticated, service_role
  USING (true);

GRANT SELECT ON public.platform_currencies TO authenticated, service_role;
