-- =============================================================================
-- Diaspora Bridge — Phase 1 operational ledger schema
-- Additive only. Does not alter legacy tables, RLS, RPCs, or functions.
-- UUID defaults use gen_random_uuid() (PostgreSQL 13+ core; this project is 17.x).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enumerations (create if missing; PostgreSQL has no CREATE TYPE IF NOT EXISTS)
-- After create-or-skip, assert labels match the frozen Phase 1 set.
-- -----------------------------------------------------------------------------

DO $$
BEGIN
  CREATE TYPE public.ledger_owner_type AS ENUM (
    'user',
    'project',
    'platform',
    'psp',
    'supplier'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
DECLARE
  v_actual text[];
  v_expected text[] := ARRAY['user', 'project', 'platform', 'psp', 'supplier'];
BEGIN
  SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder)
    INTO v_actual
  FROM pg_enum e
  JOIN pg_type t ON t.oid = e.enumtypid
  JOIN pg_namespace n ON n.oid = t.typnamespace
  WHERE n.nspname = 'public' AND t.typname = 'ledger_owner_type';

  IF v_actual IS DISTINCT FROM v_expected THEN
    RAISE EXCEPTION
      'ledger_owner_type labels mismatch: expected %, got %',
      v_expected, v_actual;
  END IF;
END
$$;

DO $$
BEGIN
  CREATE TYPE public.ledger_account_purpose AS ENUM (
    'psp_stripe',
    'psp_momo',
    'psp_orange',
    'platform_credit',
    'user_available',
    'user_payout_clearing',
    'user_refund_clearing',
    'project_escrow',
    'project_retainage',
    'project_materials_escrow',
    'provider_payable',
    'supplier_payable',
    'platform_compliance_hold',
    'platform_suspense',
    'platform_fees',
    'platform_insurance',
    'platform_equity',
    'platform_loss'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
DECLARE
  v_actual text[];
  v_expected text[] := ARRAY[
    'psp_stripe',
    'psp_momo',
    'psp_orange',
    'platform_credit',
    'user_available',
    'user_payout_clearing',
    'user_refund_clearing',
    'project_escrow',
    'project_retainage',
    'project_materials_escrow',
    'provider_payable',
    'supplier_payable',
    'platform_compliance_hold',
    'platform_suspense',
    'platform_fees',
    'platform_insurance',
    'platform_equity',
    'platform_loss'
  ];
BEGIN
  SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder)
    INTO v_actual
  FROM pg_enum e
  JOIN pg_type t ON t.oid = e.enumtypid
  JOIN pg_namespace n ON n.oid = t.typnamespace
  WHERE n.nspname = 'public' AND t.typname = 'ledger_account_purpose';

  IF v_actual IS DISTINCT FROM v_expected THEN
    RAISE EXCEPTION
      'ledger_account_purpose labels mismatch: expected %, got %',
      v_expected, v_actual;
  END IF;
END
$$;

DO $$
BEGIN
  CREATE TYPE public.ledger_journal_type AS ENUM (
    'escrow_funding',
    'compliance_hold',
    'compliance_release',
    'insurance_fee',
    'platform_fee',
    'milestone_release',
    'retainage_release',
    'wallet_credit',
    'wallet_debit',
    'payout_requested',
    'payout_settled',
    'payout_failed',
    'refund',
    'refund_settled',
    'provider_advance_disbursement',
    'provider_advance_repayment',
    'material_funding',
    'supplier_payment',
    'milestone_release_reversal',
    'chargeback',
    'platform_capital_injection',
    'payout_reversed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
DECLARE
  v_actual text[];
  v_expected text[] := ARRAY[
    'escrow_funding',
    'compliance_hold',
    'compliance_release',
    'insurance_fee',
    'platform_fee',
    'milestone_release',
    'retainage_release',
    'wallet_credit',
    'wallet_debit',
    'payout_requested',
    'payout_settled',
    'payout_failed',
    'refund',
    'refund_settled',
    'provider_advance_disbursement',
    'provider_advance_repayment',
    'material_funding',
    'supplier_payment',
    'milestone_release_reversal',
    'chargeback',
    'platform_capital_injection',
    'payout_reversed'
  ];
BEGIN
  SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder)
    INTO v_actual
  FROM pg_enum e
  JOIN pg_type t ON t.oid = e.enumtypid
  JOIN pg_namespace n ON n.oid = t.typnamespace
  WHERE n.nspname = 'public' AND t.typname = 'ledger_journal_type';

  IF v_actual IS DISTINCT FROM v_expected THEN
    RAISE EXCEPTION
      'ledger_journal_type labels mismatch: expected %, got %',
      v_expected, v_actual;
  END IF;
END
$$;

DO $$
BEGIN
  CREATE TYPE public.ledger_journal_source AS ENUM (
    'rpc',
    'webhook',
    'backfill',
    'ops'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
DECLARE
  v_actual text[];
  v_expected text[] := ARRAY['rpc', 'webhook', 'backfill', 'ops'];
BEGIN
  SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder)
    INTO v_actual
  FROM pg_enum e
  JOIN pg_type t ON t.oid = e.enumtypid
  JOIN pg_namespace n ON n.oid = t.typnamespace
  WHERE n.nspname = 'public' AND t.typname = 'ledger_journal_source';

  IF v_actual IS DISTINCT FROM v_expected THEN
    RAISE EXCEPTION
      'ledger_journal_source labels mismatch: expected %, got %',
      v_expected, v_actual;
  END IF;
END
$$;

DO $$
BEGIN
  CREATE TYPE public.ledger_event_status AS ENUM (
    'received',
    'processed',
    'ignored',
    'failed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
DECLARE
  v_actual text[];
  v_expected text[] := ARRAY['received', 'processed', 'ignored', 'failed'];
BEGIN
  SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder)
    INTO v_actual
  FROM pg_enum e
  JOIN pg_type t ON t.oid = e.enumtypid
  JOIN pg_namespace n ON n.oid = t.typnamespace
  WHERE n.nspname = 'public' AND t.typname = 'ledger_event_status';

  IF v_actual IS DISTINCT FROM v_expected THEN
    RAISE EXCEPTION
      'ledger_event_status labels mismatch: expected %, got %',
      v_expected, v_actual;
  END IF;
END
$$;

-- -----------------------------------------------------------------------------
-- ledger_accounts
-- balance_xaf is the stored lockable balance for future posting (SELECT FOR UPDATE).
-- This migration does not mutate balances or implement posting.
-- -----------------------------------------------------------------------------

CREATE TABLE public.ledger_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purpose public.ledger_account_purpose NOT NULL,
  owner_type public.ledger_owner_type NOT NULL,
  owner_id uuid NULL,
  currency char(3) NOT NULL DEFAULT 'XAF',
  balance_xaf bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ledger_accounts_currency_xaf_chk
    CHECK (currency = 'XAF'),
  CONSTRAINT ledger_accounts_owner_id_consistency_chk
    CHECK (
      (owner_type IN ('user', 'project', 'supplier') AND owner_id IS NOT NULL)
      OR (owner_type IN ('platform', 'psp'))
    ),
  CONSTRAINT ledger_accounts_balance_nonneg_chk
    CHECK (
      purpose IN ('psp_stripe', 'psp_momo', 'psp_orange', 'platform_suspense')
      OR balance_xaf >= 0
    )
);

COMMENT ON TABLE public.ledger_accounts IS
  'Operational ledger accounts and stored integer XAF balances.';
COMMENT ON COLUMN public.ledger_accounts.balance_xaf IS
  'Stored integer XAF balance. Future posting will lock this row FOR UPDATE. psp_* and platform_suspense may be negative.';

-- UNIQUE(purpose, owner_type, owner_id, currency) is insufficient for NULL owner_id.
CREATE UNIQUE INDEX IF NOT EXISTS ledger_accounts_unique_owned_uidx
  ON public.ledger_accounts (purpose, owner_type, owner_id, currency)
  WHERE owner_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ledger_accounts_unique_unowned_uidx
  ON public.ledger_accounts (purpose, owner_type, currency)
  WHERE owner_id IS NULL;

-- -----------------------------------------------------------------------------
-- ledger_journals
-- -----------------------------------------------------------------------------

CREATE TABLE public.ledger_journals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_type public.ledger_journal_type NOT NULL,
  idempotency_key text NOT NULL,
  currency char(3) NOT NULL DEFAULT 'XAF',
  posted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  source public.ledger_journal_source NOT NULL,
  created_by uuid NULL,
  business_object_type text NULL,
  business_object_id uuid NULL,
  reversal_of_journal_id uuid NULL,
  psp_ref text NULL,
  CONSTRAINT ledger_journals_idempotency_key_key UNIQUE (idempotency_key),
  CONSTRAINT ledger_journals_currency_xaf_chk
    CHECK (currency = 'XAF'),
  CONSTRAINT ledger_journals_no_self_reversal_chk
    CHECK (reversal_of_journal_id IS NULL OR reversal_of_journal_id <> id),
  CONSTRAINT ledger_journals_reversal_fk
    FOREIGN KEY (reversal_of_journal_id)
    REFERENCES public.ledger_journals (id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT
);

COMMENT ON TABLE public.ledger_journals IS
  'Append-only operational journals. Corrections use compensating journals only.';

CREATE INDEX IF NOT EXISTS ledger_journals_journal_type_idx
  ON public.ledger_journals (journal_type);

CREATE INDEX IF NOT EXISTS ledger_journals_posted_at_idx
  ON public.ledger_journals (posted_at);

CREATE INDEX IF NOT EXISTS ledger_journals_business_object_id_idx
  ON public.ledger_journals (business_object_id);

CREATE INDEX IF NOT EXISTS ledger_journals_psp_ref_idx
  ON public.ledger_journals (psp_ref);

CREATE INDEX IF NOT EXISTS ledger_journals_reversal_of_journal_id_idx
  ON public.ledger_journals (reversal_of_journal_id);

-- -----------------------------------------------------------------------------
-- ledger_lines
-- -----------------------------------------------------------------------------

CREATE TABLE public.ledger_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_id uuid NOT NULL,
  account_id uuid NOT NULL,
  debit_xaf bigint NOT NULL,
  credit_xaf bigint NOT NULL,
  project_id uuid NULL,
  milestone_id uuid NULL,
  payment_id uuid NULL,
  advance_id uuid NULL,
  CONSTRAINT ledger_lines_journal_fk
    FOREIGN KEY (journal_id)
    REFERENCES public.ledger_journals (id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  CONSTRAINT ledger_lines_account_fk
    FOREIGN KEY (account_id)
    REFERENCES public.ledger_accounts (id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  CONSTRAINT ledger_lines_amounts_nonneg_chk
    CHECK (debit_xaf >= 0 AND credit_xaf >= 0),
  CONSTRAINT ledger_lines_exactly_one_side_chk
    CHECK (
      (debit_xaf > 0 AND credit_xaf = 0)
      OR (credit_xaf > 0 AND debit_xaf = 0)
    )
);

COMMENT ON TABLE public.ledger_lines IS
  'Append-only integer XAF lines. Exactly one of debit_xaf or credit_xaf is positive.';

CREATE INDEX IF NOT EXISTS ledger_lines_journal_id_idx
  ON public.ledger_lines (journal_id);

CREATE INDEX IF NOT EXISTS ledger_lines_account_id_idx
  ON public.ledger_lines (account_id);

CREATE INDEX IF NOT EXISTS ledger_lines_project_id_idx
  ON public.ledger_lines (project_id);

CREATE INDEX IF NOT EXISTS ledger_lines_milestone_id_idx
  ON public.ledger_lines (milestone_id);

CREATE INDEX IF NOT EXISTS ledger_lines_payment_id_idx
  ON public.ledger_lines (payment_id);

CREATE INDEX IF NOT EXISTS ledger_lines_advance_id_idx
  ON public.ledger_lines (advance_id);

-- -----------------------------------------------------------------------------
-- ledger_posted_events (webhook/PSP dedup only; no posting in Phase 1)
-- -----------------------------------------------------------------------------

CREATE TABLE public.ledger_posted_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  psp_event_id text NOT NULL,
  event_type text NULL,
  psp_ref text NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz NULL,
  journal_id uuid NULL,
  status public.ledger_event_status NOT NULL DEFAULT 'received',
  CONSTRAINT ledger_posted_events_psp_event_id_key UNIQUE (psp_event_id),
  CONSTRAINT ledger_posted_events_journal_fk
    FOREIGN KEY (journal_id)
    REFERENCES public.ledger_journals (id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT
);

COMMENT ON TABLE public.ledger_posted_events IS
  'PSP/webhook event deduplication. Does not post journals.';

CREATE INDEX IF NOT EXISTS ledger_posted_events_psp_ref_idx
  ON public.ledger_posted_events (psp_ref);

CREATE INDEX IF NOT EXISTS ledger_posted_events_status_idx
  ON public.ledger_posted_events (status);

CREATE INDEX IF NOT EXISTS ledger_posted_events_journal_id_idx
  ON public.ledger_posted_events (journal_id);

-- -----------------------------------------------------------------------------
-- Deferred balance check: a committed journal must be balanced.
-- INITIALLY DEFERRED allows inserting the journal then all lines in one TX.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ledger_assert_journal_balanced(p_journal_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_lines integer;
  v_debit bigint;
  v_credit bigint;
BEGIN
  SELECT COUNT(*)::integer,
         COALESCE(SUM(debit_xaf), 0),
         COALESCE(SUM(credit_xaf), 0)
    INTO v_lines, v_debit, v_credit
  FROM public.ledger_lines
  WHERE journal_id = p_journal_id;

  IF v_lines < 2 THEN
    RAISE EXCEPTION 'ledger journal % must have at least two lines', p_journal_id
      USING ERRCODE = '23514';
  END IF;

  IF v_debit <> v_credit THEN
    RAISE EXCEPTION 'ledger journal % is unbalanced: debit % <> credit %',
      p_journal_id, v_debit, v_credit
      USING ERRCODE = '23514';
  END IF;

  IF v_debit = 0 THEN
    RAISE EXCEPTION 'ledger journal % total must be greater than zero', p_journal_id
      USING ERRCODE = '23514';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.ledger_journals_balance_trg()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  PERFORM public.ledger_assert_journal_balanced(NEW.id);
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.ledger_lines_balance_trg()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  PERFORM public.ledger_assert_journal_balanced(NEW.journal_id);
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER ledger_journals_must_balance_trg
  AFTER INSERT ON public.ledger_journals
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.ledger_journals_balance_trg();

CREATE CONSTRAINT TRIGGER ledger_lines_must_balance_trg
  AFTER INSERT ON public.ledger_lines
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.ledger_lines_balance_trg();

-- -----------------------------------------------------------------------------
-- Append-only: journals and lines (privileges + triggers)
-- Spec names: ledger_reject_journal_mutation / ledger_reject_line_mutation
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ledger_reject_journal_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION '% is append-only; corrections require a compensating journal', TG_TABLE_NAME
    USING ERRCODE = '55000';
END;
$$;

CREATE OR REPLACE FUNCTION public.ledger_reject_line_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION '% is append-only; corrections require a compensating journal', TG_TABLE_NAME
    USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER ledger_journals_no_update_delete_trg
  BEFORE UPDATE OR DELETE ON public.ledger_journals
  FOR EACH ROW
  EXECUTE FUNCTION public.ledger_reject_journal_mutation();

CREATE TRIGGER ledger_lines_no_update_delete_trg
  BEFORE UPDATE OR DELETE ON public.ledger_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.ledger_reject_line_mutation();

CREATE TRIGGER ledger_journals_no_truncate_trg
  BEFORE TRUNCATE ON public.ledger_journals
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.ledger_reject_journal_mutation();

CREATE TRIGGER ledger_lines_no_truncate_trg
  BEFORE TRUNCATE ON public.ledger_lines
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.ledger_reject_line_mutation();

-- -----------------------------------------------------------------------------
-- Privileges: JWT roles get no ledger access. service_role may insert/select.
-- Journals/lines have no UPDATE/DELETE. Accounts may be updated later by posting.
-- -----------------------------------------------------------------------------

REVOKE ALL ON TABLE public.ledger_accounts FROM PUBLIC;
REVOKE ALL ON TABLE public.ledger_journals FROM PUBLIC;
REVOKE ALL ON TABLE public.ledger_lines FROM PUBLIC;
REVOKE ALL ON TABLE public.ledger_posted_events FROM PUBLIC;

REVOKE ALL ON TABLE public.ledger_accounts FROM anon, authenticated;
REVOKE ALL ON TABLE public.ledger_journals FROM anon, authenticated;
REVOKE ALL ON TABLE public.ledger_lines FROM anon, authenticated;
REVOKE ALL ON TABLE public.ledger_posted_events FROM anon, authenticated;

REVOKE ALL ON FUNCTION public.ledger_assert_journal_balanced(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ledger_journals_balance_trg() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ledger_lines_balance_trg() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ledger_reject_journal_mutation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ledger_reject_line_mutation() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.ledger_assert_journal_balanced(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.ledger_journals_balance_trg() TO service_role;
GRANT EXECUTE ON FUNCTION public.ledger_lines_balance_trg() TO service_role;
GRANT EXECUTE ON FUNCTION public.ledger_reject_journal_mutation() TO service_role;
GRANT EXECUTE ON FUNCTION public.ledger_reject_line_mutation() TO service_role;

GRANT SELECT, INSERT, UPDATE ON TABLE public.ledger_accounts TO service_role;
GRANT SELECT, INSERT ON TABLE public.ledger_journals TO service_role;
GRANT SELECT, INSERT ON TABLE public.ledger_lines TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.ledger_posted_events TO service_role;

REVOKE DELETE, TRUNCATE ON TABLE public.ledger_accounts FROM service_role;
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public.ledger_journals FROM service_role;
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public.ledger_lines FROM service_role;
REVOKE DELETE, TRUNCATE ON TABLE public.ledger_posted_events FROM service_role;

GRANT USAGE ON TYPE public.ledger_owner_type TO service_role;
GRANT USAGE ON TYPE public.ledger_account_purpose TO service_role;
GRANT USAGE ON TYPE public.ledger_journal_type TO service_role;
GRANT USAGE ON TYPE public.ledger_journal_source TO service_role;
GRANT USAGE ON TYPE public.ledger_event_status TO service_role;

REVOKE USAGE ON TYPE public.ledger_owner_type FROM PUBLIC, anon, authenticated;
REVOKE USAGE ON TYPE public.ledger_account_purpose FROM PUBLIC, anon, authenticated;
REVOKE USAGE ON TYPE public.ledger_journal_type FROM PUBLIC, anon, authenticated;
REVOKE USAGE ON TYPE public.ledger_journal_source FROM PUBLIC, anon, authenticated;
REVOKE USAGE ON TYPE public.ledger_event_status FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- RLS: no policies for anon/authenticated (deny). Existing tables unchanged.
-- service_role bypasses RLS and uses table grants above.
-- -----------------------------------------------------------------------------

ALTER TABLE public.ledger_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_journals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_posted_events ENABLE ROW LEVEL SECURITY;
