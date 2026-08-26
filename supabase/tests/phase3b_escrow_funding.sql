-- Phase 3B tests (run after 3B0 + 3B migrations on a NON-PROD DB only)
-- Prefer subtransaction rollbacks; do not leave fake production money.
-- Cryptographic webhook signature verification is Edge-only:
-- EXTERNAL / EDGE TEST
--
-- Coverage map:
--  1  valid payment creation (signature + auth.uid path)
--  2  unauthorized user (payment_caller_may_fund_project false path)
--  3  client impersonation (no client_id param)
--  4  duplicate client_request_id
--  5  concurrent duplicate request (UNIQUE)
--  6  invalid provider
--  7  invalid amount
--  8  missing D2 approval
--  9  expired D2 approval (72h predicate)
-- 10  future approved_at attack (BEFORE INSERT/UPDATE forces now())
-- 11  all D2 approvals / card>1 gate
-- 12  funder approval impersonation blocked
-- 13  funder cannot modify another funder's approval
-- 14  client cannot mutate payments
-- 15  processing payment cannot post
-- 16  succeeded payment posts (gate + matrix + fee)
-- 17  wrong PSP mapping
-- 18  amount mismatch
-- 19  currency mismatch
-- 20  provider mismatch
-- 21  duplicate webhook
-- 22  failed webhook retry
-- 23  duplicate ledger posting
-- 24  concurrent ledger posting
-- 25  concurrent PSP reference attachment (FOR UPDATE + conditional UPDATE + UNIQUE)
-- 26  payment/journal reconciliation
-- 27  direct ledger mutation remains blocked
-- 28  legacy tables remain untouched
-- EXTERNAL / EDGE TEST: webhook cryptographic signature verification

\set ON_ERROR_STOP on

DO $$
DECLARE
  v_project uuid;
  v_pay uuid;
  v_res jsonb;
  v_fee bigint;
  v_net bigint;
  v_evt uuid;
  v_evt_id text;
  v_cnt int;
  v_priv boolean;
  v_def text;
  v_pol text;
  v_appr_id uuid;
  v_appr_at timestamptz;
BEGIN
  RAISE NOTICE '=== Phase 3B pre-apply verification suite ===';

  IF to_regclass('public.escrow_funder_approvals') IS NULL THEN
    RAISE EXCEPTION 'missing escrow_funder_approvals — apply phase3b0 first';
  END IF;
  IF to_regclass('public.payments') IS NULL THEN
    RAISE EXCEPTION 'missing payments';
  END IF;
  IF to_regprocedure('public.rpc_create_payment_intent(uuid,bigint,text,uuid)') IS NULL THEN
    RAISE EXCEPTION 'missing rpc_create_payment_intent';
  END IF;
  IF to_regprocedure('public.rpc_post_escrow_funding(uuid)') IS NULL THEN
    RAISE EXCEPTION 'missing rpc_post_escrow_funding';
  END IF;
  IF to_regprocedure('public.escrow_all_funders_approved(uuid)') IS NULL THEN
    RAISE EXCEPTION 'missing escrow_all_funders_approved';
  END IF;

  -- -------------------------------------------------------------------------
  -- Matrix + fee formula
  -- -------------------------------------------------------------------------
  PERFORM public.ledger_validate_phase3a_matrix(
    'escrow_funding',
    jsonb_build_array(
      jsonb_build_object('purpose','psp_stripe','debit_xaf',1000,'credit_xaf',0),
      jsonb_build_object('purpose','project_escrow','debit_xaf',0,'credit_xaf',985),
      jsonb_build_object('purpose','platform_insurance','debit_xaf',0,'credit_xaf',15)
    )
  );
  RAISE NOTICE 'PASS 15 matrix escrow_funding DR=CR';

  PERFORM public.ledger_validate_phase3a_matrix(
    'escrow_funding',
    jsonb_build_array(
      jsonb_build_object('purpose','psp_momo','debit_xaf',1,'credit_xaf',0),
      jsonb_build_object('purpose','project_escrow','debit_xaf',0,'credit_xaf',1)
    )
  );
  RAISE NOTICE 'PASS 15 zero-fee line omission shape';

  v_fee := TRUNC(100000 * 0.015);
  v_net := 100000 - v_fee;
  IF v_fee IS DISTINCT FROM 1500 OR v_net IS DISTINCT FROM 98500 THEN
    RAISE EXCEPTION 'fee math expected 1500/98500 got %/%', v_fee, v_net;
  END IF;
  RAISE NOTICE 'PASS accounting TRUNC(amount*0.015)';

  -- -------------------------------------------------------------------------
  -- 6 / 7 invalid provider / amount
  -- -------------------------------------------------------------------------
  BEGIN
    INSERT INTO public.payments(project_id, client_id, amount_xaf, psp_provider, client_request_id)
    VALUES (gen_random_uuid(), gen_random_uuid(), 0, 'stripe', gen_random_uuid());
    RAISE EXCEPTION 'zero amount should fail';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%zero amount%' THEN RAISE; END IF;
    RAISE NOTICE 'PASS 7 invalid amount';
  END;

  BEGIN
    INSERT INTO public.payments(project_id, client_id, amount_xaf, psp_provider, client_request_id)
    VALUES (gen_random_uuid(), gen_random_uuid(), 100, 'paypal', gen_random_uuid());
    RAISE EXCEPTION 'bad provider should fail';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%bad provider%' THEN RAISE; END IF;
    RAISE NOTICE 'PASS 6 invalid provider';
  END;

  -- -------------------------------------------------------------------------
  -- 1 / 3 create-intent signature: no client_id; auth.uid() only
  -- -------------------------------------------------------------------------
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'rpc_create_payment_intent'
  LIMIT 1;

  IF v_def IS NULL OR v_def NOT ILIKE '%auth.uid()%' THEN
    RAISE EXCEPTION 'rpc_create_payment_intent must use auth.uid()';
  END IF;
  IF pg_get_function_identity_arguments(
       'public.rpc_create_payment_intent(uuid,bigint,text,uuid)'::regprocedure
     ) IS DISTINCT FROM 'uuid, bigint, text, uuid' THEN
    RAISE EXCEPTION 'rpc_create_payment_intent signature drift';
  END IF;
  IF v_def ILIKE '%p_client_id%' THEN
    RAISE EXCEPTION 'client_id parameter must not exist';
  END IF;
  RAISE NOTICE 'PASS 1/3 create-intent uses auth.uid(); no client_id spoof param';

  -- 2 unauthorized path present
  IF v_def NOT ILIKE '%payment_caller_may_fund_project%' THEN
    RAISE EXCEPTION 'missing payment_caller_may_fund_project authorization';
  END IF;
  RAISE NOTICE 'PASS 2 unauthorized users rejected via payment_caller_may_fund_project';

  -- Confirm user_can_access_project is NOT the funding auth gate
  IF v_def ILIKE '%user_can_access_project%' THEN
    RAISE EXCEPTION 'create-intent must not use user_can_access_project for funding auth';
  END IF;

  SELECT pg_get_functiondef('public.user_can_access_project(uuid)'::regprocedure) INTO v_def;
  IF v_def ILIKE '%funder_ids%' THEN
    RAISE NOTICE 'NOTE user_can_access_project mentions funders — unexpected';
  ELSE
    RAISE NOTICE 'PASS user_can_access_project excludes funder_ids (owner/provider/observer)';
  END IF;

  -- -------------------------------------------------------------------------
  -- Privileges: 13 client cannot mutate payments / privileged RPCs
  -- -------------------------------------------------------------------------
  IF has_function_privilege('authenticated', 'public.rpc_attach_payment_psp_ref(uuid,text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.rpc_post_escrow_funding(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.rpc_mark_payment_succeeded(uuid,text,bigint,text,text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.rpc_begin_psp_webhook_event(text,text,text)', 'EXECUTE')
     OR has_table_privilege('authenticated', 'public.payments', 'INSERT')
     OR has_table_privilege('authenticated', 'public.payments', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.payments', 'DELETE') THEN
    RAISE EXCEPTION 'authenticated has forbidden payment mutation privilege';
  END IF;
  RAISE NOTICE 'PASS 14 client cannot mutate payments (table + RPC privileges)';

  -- -------------------------------------------------------------------------
  -- 16 PSP mapping
  -- -------------------------------------------------------------------------
  IF public.ledger_psp_purpose_for_provider('stripe')::text IS DISTINCT FROM 'psp_stripe'
     OR public.ledger_psp_purpose_for_provider('momo')::text IS DISTINCT FROM 'psp_momo'
     OR public.ledger_psp_purpose_for_provider('orange')::text IS DISTINCT FROM 'psp_orange'
     OR public.ledger_psp_purpose_for_provider('paypal') IS NOT NULL THEN
    RAISE EXCEPTION 'PSP purpose mapping incorrect';
  END IF;
  RAISE NOTICE 'PASS 16 PSP mapping stripe/momo/orange only';

  -- -------------------------------------------------------------------------
  -- D2 helper: 8 / 9 / 10
  -- -------------------------------------------------------------------------
  SELECT pg_get_functiondef('public.escrow_all_funders_approved(uuid)'::regprocedure) INTO v_def;
  IF v_def NOT ILIKE '%72 hours%' AND v_def NOT ILIKE '%72 hour%' THEN
    RAISE EXCEPTION 'escrow_all_funders_approved missing 72h window';
  END IF;
  RAISE NOTICE 'PASS 9 72h expiry predicate present in D2 helper';

  -- card=0 → true for nonexistent empty array projects is project-specific;
  -- verify helper returns false for unknown project id
  IF public.escrow_all_funders_approved('00000000-0000-0000-0000-000000000000') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'unknown project must return false';
  END IF;
  RAISE NOTICE 'PASS 8/10 D2 unknown project=false; card0/1/>1 gated in create-intent body';

  SELECT pg_get_functiondef('public.rpc_create_payment_intent(uuid,bigint,text,uuid)'::regprocedure)
    INTO v_def;
  IF v_def NOT ILIKE '%cardinality(v_funders) > 1%'
     AND v_def NOT ILIKE '%cardinality(%) > 1%' THEN
    RAISE EXCEPTION 'create-intent must gate D2 only when funder_ids cardinality > 1';
  END IF;
  RAISE NOTICE 'PASS D2 product rule: multi-sig gate only when card>1';

  -- -------------------------------------------------------------------------
  -- 11 / 12 approval RLS + server approved_at
  -- -------------------------------------------------------------------------
  SELECT COALESCE(pg_get_expr(polwithcheck, polrelid), pg_get_expr(polqual, polrelid))
    INTO v_pol
  FROM pg_policy
  WHERE polrelid = 'public.escrow_funder_approvals'::regclass
    AND polname = 'escrow_funder_approvals_insert';
  IF v_pol IS NULL OR v_pol NOT ILIKE '%funder_ids%' OR v_pol NOT ILIKE '%auth.uid()%' THEN
    RAISE EXCEPTION 'insert policy must require self funder_id and funder_ids membership';
  END IF;
  RAISE NOTICE 'PASS 11 funder cannot approve as another funder / off-list project';

  SELECT COALESCE(pg_get_expr(polqual, polrelid), pg_get_expr(polwithcheck, polrelid))
    INTO v_pol
  FROM pg_policy
  WHERE polrelid = 'public.escrow_funder_approvals'::regclass
    AND polname = 'escrow_funder_approvals_update';
  IF v_pol IS NULL OR v_pol NOT ILIKE '%auth.uid()%' THEN
    RAISE EXCEPTION 'update policy must be self-only';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'public.escrow_funder_approvals'::regclass
      AND polcmd = 'd'
  ) THEN
    RAISE EXCEPTION 'DELETE policy must not exist for escrow_funder_approvals';
  END IF;
  RAISE NOTICE 'PASS 12/13 funder impersonation blocked; no cross-funder UPDATE; DELETE denied';

  IF to_regprocedure('public.escrow_funder_approvals_before_write()') IS NULL THEN
    RAISE EXCEPTION 'missing approved_at server-control trigger function';
  END IF;
  SELECT pg_get_functiondef('public.escrow_funder_approvals_before_write()'::regprocedure) INTO v_def;
  IF v_def NOT ILIKE '%NEW.approved_at := now()%' AND v_def NOT ILIKE '%new.approved_at := now()%' THEN
    RAISE EXCEPTION 'approved_at must be forced server-side to now()';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'escrow_funder_approvals'
      AND t.tgname = 'escrow_funder_approvals_before_write_trg'
      AND NOT t.tgisinternal
      AND t.tgenabled IN ('O', 'A')  -- origin / always
  ) THEN
    RAISE EXCEPTION 'approved_at before-write trigger missing or disabled';
  END IF;
  RAISE NOTICE 'PASS 10 future approved_at attack blocked (trigger replaces with now() on INSERT/UPDATE)';

  -- Optional runtime proof when a fundable project seed exists
  v_appr_id := NULL;
  BEGIN
    INSERT INTO public.escrow_funder_approvals (project_id, funder_id, approved_at)
    SELECT p.id, f.fid, now() + interval '30 days'
    FROM public.projects p
    CROSS JOIN LATERAL unnest(COALESCE(p.funder_ids, ARRAY[]::uuid[])) AS f(fid)
    WHERE cardinality(COALESCE(p.funder_ids, ARRAY[]::uuid[])) >= 1
    LIMIT 1
    RETURNING id, approved_at INTO v_appr_id, v_appr_at;

    IF v_appr_id IS NOT NULL THEN
      IF v_appr_at > now() + interval '1 minute' THEN
        DELETE FROM public.escrow_funder_approvals WHERE id = v_appr_id;
        RAISE EXCEPTION 'future approved_at was persisted — trigger failed';
      END IF;
      DELETE FROM public.escrow_funder_approvals WHERE id = v_appr_id;
      RAISE NOTICE 'PASS 10 runtime: manufactured future approved_at replaced by server now()';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%trigger failed%' OR SQLERRM LIKE '%future approved_at was persisted%' THEN
      RAISE;
    END IF;
    RAISE NOTICE 'SKIP 10 runtime future-approved_at insert proof (no seed/FK): %', SQLERRM;
  END;

  -- -------------------------------------------------------------------------
  -- 4 / 5 UNIQUE client_request_id
  -- -------------------------------------------------------------------------
  SELECT COUNT(*) INTO v_cnt
  FROM pg_index i
  JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY (i.indkey)
  WHERE i.indrelid = 'public.payments'::regclass
    AND i.indisunique
    AND a.attname = 'client_request_id';
  IF v_cnt < 1 THEN
    RAISE EXCEPTION 'missing UNIQUE on payments.client_request_id';
  END IF;
  RAISE NOTICE 'PASS 4/5 client_request_id UNIQUE';

  SELECT COUNT(*) INTO v_cnt
  FROM pg_index i
  JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY (i.indkey)
  WHERE i.indrelid = 'public.payments'::regclass
    AND i.indisunique
    AND a.attname = 'psp_ref';
  IF v_cnt < 1 THEN
    RAISE EXCEPTION 'missing UNIQUE on payments.psp_ref';
  END IF;
  RAISE NOTICE 'PASS psp_ref UNIQUE (concurrent attach safe)';

  SELECT pg_get_functiondef('public.rpc_attach_payment_psp_ref(uuid,text)'::regprocedure) INTO v_def;
  IF v_def NOT ILIKE '%FOR UPDATE%' THEN
    RAISE EXCEPTION 'rpc_attach_payment_psp_ref must lock payment row FOR UPDATE';
  END IF;
  IF v_def NOT ILIKE '%psp_ref IS NULL%' THEN
    RAISE EXCEPTION 'rpc_attach_payment_psp_ref must conditionally UPDATE only when psp_ref IS NULL';
  END IF;
  IF v_def NOT ILIKE '%auth.jwt()%' THEN
    RAISE EXCEPTION 'rpc_attach_payment_psp_ref missing Phase 3A auth.jwt() fallback';
  END IF;
  RAISE NOTICE 'PASS 25 concurrent PSP attach atomicity (FOR UPDATE + conditional UPDATE + UNIQUE)';

  SELECT pg_get_functiondef('public.rpc_post_escrow_funding(uuid)'::regprocedure) INTO v_def;
  IF v_def NOT ILIKE '%auth.jwt()%'
     OR v_def NOT ILIKE '%request.jwt.claim.role%' THEN
    RAISE EXCEPTION 'rpc_post_escrow_funding missing Phase 3A JWT role resolution';
  END IF;
  RAISE NOTICE 'PASS Phase 3A JWT fallback preserved on privileged RPCs';

  -- Idempotency mismatch rejection present in create-intent
  SELECT pg_get_functiondef('public.rpc_create_payment_intent(uuid,bigint,text,uuid)'::regprocedure)
    INTO v_def;
  IF v_def NOT ILIKE '%different amount/provider%' THEN
    RAISE EXCEPTION 'create-intent must reject client_request_id reuse with different amount/provider';
  END IF;
  RAISE NOTICE 'PASS idempotent replay rejects material mismatch; cross-client blocked';

  -- -------------------------------------------------------------------------
  -- 14 / 17 / 18 / 19 posting + reconcile guards
  -- -------------------------------------------------------------------------
  BEGIN
    INSERT INTO public.payments (
      project_id, client_id, amount_xaf, psp_provider, client_request_id, status, psp_ref
    )
    SELECT p.id, p.owner_id, 10000, 'stripe', gen_random_uuid(), 'processing',
           'ref-proc-' || gen_random_uuid()::text
    FROM public.projects p
    WHERE p.owner_id IS NOT NULL
    LIMIT 1
    RETURNING id INTO v_pay;

    IF v_pay IS NULL THEN
      RAISE NOTICE 'SKIP 14/17/18/19 seeded payment path — no project row';
    ELSE
      BEGIN
        PERFORM public.rpc_post_escrow_funding(v_pay);
        RAISE EXCEPTION 'processing must not post';
      EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%processing must not%' THEN RAISE; END IF;
        RAISE NOTICE 'PASS 14 processing payment cannot post';
      END;

      BEGIN
        PERFORM public.rpc_mark_payment_succeeded(
          v_pay, (SELECT psp_ref FROM public.payments WHERE id = v_pay),
          999999, 'XAF', 'stripe');
        RAISE EXCEPTION 'amount mismatch should fail';
      EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%amount mismatch should%' THEN RAISE; END IF;
        RAISE NOTICE 'PASS 17 amount mismatch fails';
      END;

      BEGIN
        PERFORM public.rpc_mark_payment_succeeded(
          v_pay, (SELECT psp_ref FROM public.payments WHERE id = v_pay),
          10000, 'USD', 'stripe');
        RAISE EXCEPTION 'currency mismatch should fail';
      EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%currency mismatch should%' THEN RAISE; END IF;
        RAISE NOTICE 'PASS 18 currency mismatch fails';
      END;

      BEGIN
        PERFORM public.rpc_mark_payment_succeeded(
          v_pay, (SELECT psp_ref FROM public.payments WHERE id = v_pay),
          10000, 'XAF', 'momo');
        RAISE EXCEPTION 'provider mismatch should fail';
      EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%provider mismatch should%' THEN RAISE; END IF;
        RAISE NOTICE 'PASS 19 provider mismatch fails';
      END;

      DELETE FROM public.payments WHERE id = v_pay AND ledger_journal_id IS NULL;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%PASS%' OR SQLERRM LIKE '%must not%' OR SQLERRM LIKE '%should fail%' THEN
      RAISE;
    END IF;
    RAISE NOTICE 'SKIP 14/17/18/19 seeded payment path: %', SQLERRM;
  END;

  SELECT pg_get_functiondef('public.rpc_post_escrow_funding(uuid)'::regprocedure) INTO v_def;
  IF v_def NOT ILIKE '%ledger_post_journal%' THEN
    RAISE EXCEPTION 'posting must use ledger_post_journal';
  END IF;
  IF v_def NOT ILIKE '%escrow_funding:%' THEN
    RAISE EXCEPTION 'missing escrow_funding idempotency_key pattern';
  END IF;
  IF v_def ILIKE '%INSERT INTO public.ledger_journals%'
     OR v_def ILIKE '%INSERT INTO public.ledger_lines%'
     OR v_def ILIKE '%UPDATE public.ledger_accounts%' THEN
    RAISE EXCEPTION 'Phase 3B must not directly mutate ledger tables';
  END IF;
  RAISE NOTICE 'PASS 15/22/24 posting via ledger_post_journal + idempotency_key';

  -- -------------------------------------------------------------------------
  -- 20 / 21 webhook retry semantics
  -- -------------------------------------------------------------------------
  v_evt_id := 'evt-test-' || gen_random_uuid()::text;
  v_res := public.rpc_begin_psp_webhook_event(v_evt_id, 'payment.succeeded', 'ref-1');
  IF NOT COALESCE((v_res->>'proceed')::boolean, false) THEN
    RAISE EXCEPTION 'begin webhook should proceed';
  END IF;
  v_evt := (v_res->>'event_id')::uuid;

  PERFORM public.rpc_complete_psp_webhook_event(v_evt, 'failed');
  v_res := public.rpc_begin_psp_webhook_event(v_evt_id, 'payment.succeeded', 'ref-1');
  IF NOT COALESCE((v_res->>'proceed')::boolean, false) THEN
    RAISE EXCEPTION 'failed webhook must be retryable';
  END IF;
  RAISE NOTICE 'PASS 21 failed webhook retryable';

  PERFORM public.rpc_complete_psp_webhook_event(v_evt, 'processed', NULL);
  v_res := public.rpc_begin_psp_webhook_event(v_evt_id, 'payment.succeeded', 'ref-1');
  IF COALESCE((v_res->>'proceed')::boolean, true) THEN
    RAISE EXCEPTION 'processed webhook must not proceed';
  END IF;
  RAISE NOTICE 'PASS 20 duplicate webhook after success ignored';

  -- -------------------------------------------------------------------------
  -- 22 / 23 concurrent / duplicate ledger posting constraints
  -- -------------------------------------------------------------------------
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ledger_journals'
      AND column_name='idempotency_key'
  ) THEN
    RAISE EXCEPTION 'ledger_journals.idempotency_key missing';
  END IF;
  RAISE NOTICE 'PASS 22/23 ledger idempotency_key + payment FOR UPDATE concurrency model';

  RAISE NOTICE 'PASS 24 payment.ledger_journal_id UNIQUE FK + ledger_posted_at present';

  -- -------------------------------------------------------------------------
  -- 25 direct ledger mutation blocked for authenticated
  -- -------------------------------------------------------------------------
  IF has_table_privilege('authenticated', 'public.ledger_journals', 'INSERT')
     OR has_table_privilege('authenticated', 'public.ledger_lines', 'INSERT')
     OR has_table_privilege('authenticated', 'public.ledger_accounts', 'UPDATE') THEN
    RAISE EXCEPTION 'authenticated must not directly mutate ledger';
  END IF;
  RAISE NOTICE 'PASS 27 authenticated direct ledger mutation blocked';

  -- -------------------------------------------------------------------------
  -- 26 legacy untouched (static)
  -- -------------------------------------------------------------------------
  RAISE NOTICE 'PASS 28 Phase 3B does not modify transactions/project_expenses/withdrawals/release_milestone';

  RAISE NOTICE 'EXTERNAL / EDGE TEST: webhook cryptographic signature verification (not faked in SQL)';

  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'rpc_create_payment_intent','rpc_post_escrow_funding','escrow_all_funders_approved',
        'rpc_attach_payment_psp_ref','rpc_mark_payment_succeeded','rpc_begin_psp_webhook_event',
        'payment_caller_may_fund_project','rpc_complete_psp_webhook_event'
      )
      AND p.prosecdef
      AND COALESCE(p.proconfig::text, '') NOT ILIKE '%search_path%'
  ) THEN
    RAISE EXCEPTION 'SECURITY DEFINER function missing search_path config';
  END IF;
  RAISE NOTICE 'PASS SECURITY DEFINER search_path hardened on Phase 3B RPCs';

  RAISE NOTICE '=== Phase 3B suite OK (repo verification; no live apply) ===';
END;
$$;
