-- =============================================================================
-- C06 schema contract — run after clean db reset with C06 active (9 migrations)
-- =============================================================================

DO $$
DECLARE
  v_has boolean;
BEGIN
  -- C05 intact
  IF to_regclass('public.escrow_funding_requests') IS NULL
     OR to_regclass('public.escrow_funder_approvals') IS NULL THEN
    RAISE EXCEPTION 'C06 FAIL: C05 objects missing';
  END IF;
  IF to_regprocedure('public.escrow_all_funders_approved_for_request(uuid)') IS NULL THEN
    RAISE EXCEPTION 'C06 FAIL: C05 helper missing';
  END IF;

  -- payments present
  IF to_regclass('public.payments') IS NULL THEN
    RAISE EXCEPTION 'C06 FAIL: payments missing';
  END IF;

  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.payments'::regclass) THEN
    RAISE EXCEPTION 'C06 FAIL: payments RLS must be ON';
  END IF;

  SELECT has_table_privilege('authenticated', 'public.payments', 'INSERT') INTO v_has;
  IF v_has THEN RAISE EXCEPTION 'C06 FAIL: authenticated INSERT payments must be denied'; END IF;
  SELECT has_table_privilege('authenticated', 'public.payments', 'UPDATE') INTO v_has;
  IF v_has THEN RAISE EXCEPTION 'C06 FAIL: authenticated UPDATE payments must be denied'; END IF;
  SELECT has_table_privilege('authenticated', 'public.payments', 'DELETE') INTO v_has;
  IF v_has THEN RAISE EXCEPTION 'C06 FAIL: authenticated DELETE payments must be denied'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.payments'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) ILIKE '%client_request_id%'
  ) THEN
    RAISE EXCEPTION 'C06 FAIL: client_request_id unique missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payments_psp_provider_ref_uidx'
  ) THEN
    RAISE EXCEPTION 'C06 FAIL: provider-scoped psp_ref unique missing';
  END IF;

  IF to_regprocedure('public.rpc_create_payment_intent(uuid,bigint,text,uuid)') IS NULL THEN
    RAISE EXCEPTION 'C06 FAIL: rpc_create_payment_intent missing';
  END IF;
  IF to_regprocedure('public.rpc_attach_payment_psp_ref(uuid,text)') IS NULL THEN
    RAISE EXCEPTION 'C06 FAIL: rpc_attach_payment_psp_ref missing';
  END IF;
  IF to_regprocedure('public.rpc_mark_payment_succeeded(uuid,text,bigint,text,text)') IS NULL THEN
    RAISE EXCEPTION 'C06 FAIL: rpc_mark_payment_succeeded missing';
  END IF;
  IF to_regprocedure('public.rpc_post_escrow_funding(uuid)') IS NULL THEN
    RAISE EXCEPTION 'C06 FAIL: rpc_post_escrow_funding missing';
  END IF;
  IF to_regprocedure('public.rpc_begin_psp_webhook_event(text,text,text,text)') IS NULL THEN
    RAISE EXCEPTION 'C06 FAIL: provider-scoped rpc_begin_psp_webhook_event missing';
  END IF;
  IF to_regprocedure('public.ledger_canonical_psp_event_id(text,text)') IS NULL THEN
    RAISE EXCEPTION 'C06 FAIL: ledger_canonical_psp_event_id missing';
  END IF;

  -- Sensitive RPCs not executable by authenticated
  IF has_function_privilege('authenticated', 'public.rpc_mark_payment_succeeded(uuid,text,bigint,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'C06 FAIL: authenticated must not EXECUTE mark_succeeded';
  END IF;
  IF has_function_privilege('authenticated', 'public.rpc_post_escrow_funding(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'C06 FAIL: authenticated must not EXECUTE post_escrow_funding';
  END IF;
  IF has_function_privilege('authenticated', 'public.rpc_attach_payment_psp_ref(uuid,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'C06 FAIL: authenticated must not EXECUTE attach_psp_ref';
  END IF;

  -- C12-era: historical create is an internal primitive (authenticated EXECUTE revoked).
  -- Pre-C12: authenticated still EXECUTE rpc_create_payment_intent.
  IF to_regclass('public.payment_attempts') IS NULL THEN
    IF NOT has_function_privilege('authenticated', 'public.rpc_create_payment_intent(uuid,bigint,text,uuid)', 'EXECUTE') THEN
      RAISE EXCEPTION 'C06 FAIL: authenticated should EXECUTE rpc_create_payment_intent pre-C12';
    END IF;
  ELSE
    IF has_function_privilege('authenticated', 'public.rpc_create_payment_intent(uuid,bigint,text,uuid)', 'EXECUTE') THEN
      RAISE EXCEPTION 'C06 FAIL: authenticated must not EXECUTE rpc_create_payment_intent after C12';
    END IF;
    IF NOT has_function_privilege('authenticated', 'public.rpc_create_xaf_payment_intent(uuid,bigint,text,uuid)', 'EXECUTE') THEN
      RAISE EXCEPTION 'C06 FAIL: authenticated should EXECUTE rpc_create_xaf_payment_intent after C12';
    END IF;
  END IF;

  -- C07 / payout absent
  IF to_regprocedure('public.rpc_release_milestone(uuid)') IS NOT NULL THEN
    RAISE EXCEPTION 'C06 FAIL: rpc_release_milestone must remain absent';
  END IF;
  IF to_regclass('public.payout_instruments') IS NOT NULL THEN
    RAISE EXCEPTION 'C06 FAIL: payout_instruments must remain absent';
  END IF;
  -- C03 fx_quotes may exist as a later additive migration; C06 must not
  -- permanently require future phases to remain absent.

  -- No insurance fee in post function body
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'rpc_post_escrow_funding'
      AND pg_get_functiondef(oid) ILIKE '%0.015%'
  ) OR EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'rpc_post_escrow_funding'
      AND pg_get_functiondef(oid) ILIKE '%platform_insurance%'
  ) THEN
    RAISE EXCEPTION 'C06 FAIL: insurance/1.5%% must not appear in rpc_post_escrow_funding';
  END IF;

  IF (SELECT count(*) FROM ledger_journals) <> 0 THEN
    RAISE EXCEPTION 'C06 FAIL: ledger journals must be 0 on clean reset';
  END IF;
  IF (SELECT COALESCE(sum(balance_xaf),0) FROM ledger_accounts) <> 0 THEN
    RAISE EXCEPTION 'C06 FAIL: ledger XAF must be 0 on clean reset';
  END IF;
END $$;

SELECT 'c06_schema_contract.sql: PASS' AS result;
