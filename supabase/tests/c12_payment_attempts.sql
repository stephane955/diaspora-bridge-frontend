-- =============================================================================
-- C12-R disposable local tests (NOT in CI until C12 APPLY)
-- Prerequisites: npx supabase db reset --local (11-migration chain including C12).
-- No external PSP / C11.
-- =============================================================================

DO $$
DECLARE
  u_owner uuid := gen_random_uuid();
  u_cof uuid := gen_random_uuid();
  u_obs uuid := gen_random_uuid();
  u_prov uuid := gen_random_uuid();
  u_rand uuid := gen_random_uuid();
  v_project uuid;
  r0 uuid := gen_random_uuid();
  r1 uuid := gen_random_uuid();
  r2 uuid := gen_random_uuid();
  v_res jsonb;
  v_q1 uuid;
  v_q2 uuid;
  v_pay uuid;
  v_pay_xaf uuid;
  v_a1 uuid;
  v_a2 uuid;
  v_req1 uuid := gen_random_uuid();
  v_req2 uuid := gen_random_uuid();
  v_j uuid;
  v_jcount int;
  v_escrow bigint;
  v_err text;
  v_st text;
  v_has boolean;
BEGIN
  IF to_regclass('public.payment_attempts') IS NULL THEN
    RAISE EXCEPTION 'C12 FAIL: apply future C12 SQL first';
  END IF;

  INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, instance_id, confirmation_token, recovery_token, email_change_token_new, email_change)
  VALUES
    (u_owner, 'authenticated', 'authenticated', 'c12_o_' || u_owner::text || '@test.local', crypt('x', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000', '', '', '', ''),
    (u_cof, 'authenticated', 'authenticated', 'c12_c_' || u_cof::text || '@test.local', crypt('x', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000', '', '', '', ''),
    (u_obs, 'authenticated', 'authenticated', 'c12_z_' || u_obs::text || '@test.local', crypt('x', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000', '', '', '', ''),
    (u_prov, 'authenticated', 'authenticated', 'c12_p_' || u_prov::text || '@test.local', crypt('x', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000', '', '', '', ''),
    (u_rand, 'authenticated', 'authenticated', 'c12_r_' || u_rand::text || '@test.local', crypt('x', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000', '', '', '', '');

  INSERT INTO public.profiles (id, role) VALUES
    (u_owner, 'client'), (u_cof, 'client'), (u_obs, 'observer'), (u_prov, 'provider'), (u_rand, 'client');

  INSERT INTO public.projects (owner_id, assigned_provider_id, funder_ids, status, title)
  VALUES (u_owner, u_prov, ARRAY[u_cof]::uuid[], 'open', 'c12-r')
  RETURNING id INTO v_project;

  -- Grants: authenticated must not EXECUTE historical C06 create
  IF has_function_privilege('authenticated', 'public.rpc_create_payment_intent(uuid,bigint,text,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'C12 FAIL: authenticated still has rpc_create_payment_intent';
  END IF;
  IF has_function_privilege('authenticated', 'public.rpc_finalize_payment_attempt_success(uuid,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'C12 FAIL: authenticated must not finalize success';
  END IF;
  IF has_function_privilege('authenticated', 'public.rpc_create_payment_attempt(uuid,uuid,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'C12 FAIL: authenticated must not create attempts';
  END IF;

  -- RLS
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.payment_attempts'::regclass) THEN
    RAISE EXCEPTION 'C12 FAIL: payment_attempts RLS OFF';
  END IF;
  SELECT has_table_privilege('authenticated', 'public.payment_attempts', 'INSERT') INTO v_has;
  IF v_has THEN RAISE EXCEPTION 'C12 FAIL: authenticated INSERT attempts'; END IF;

  -- ---- Unclassified payment cannot commit (deferred constraint) ----
  PERFORM set_config('request.jwt.claim.sub', u_owner::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM public.rpc_create_funding_request(v_project, 400000, r2);
  PERFORM set_config('request.jwt.claim.sub', u_cof::text, true);
  PERFORM public.rpc_approve_funding_request(r2);
  PERFORM set_config('request.jwt.claim.sub', u_owner::text, true);
  BEGIN
    PERFORM public.rpc_create_payment_intent(v_project, 400000, 'stripe', r2);
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'C12 FAIL: unclassified payment should not commit';
  EXCEPTION
    WHEN not_null_violation OR check_violation OR raise_exception THEN
      GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
      IF v_err ILIKE '%C12 FAIL%' THEN RAISE; END IF;
      IF v_err NOT ILIKE '%funding_mode%' AND v_err NOT ILIKE '%unclassified%' THEN
        RAISE EXCEPTION 'C12 FAIL: expected funding_mode deny, got %', v_err;
      END IF;
  END;

  -- Authenticated cannot EXECUTE historical C06 create
  BEGIN
    SET LOCAL ROLE authenticated;
    PERFORM public.rpc_create_payment_intent(v_project, 400000, 'stripe', r2);
    RESET ROLE;
    RAISE EXCEPTION 'C12 FAIL: authenticated direct C06 create should DENY';
  EXCEPTION WHEN insufficient_privilege THEN
    RESET ROLE;
  WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    RESET ROLE;
    IF v_err ILIKE '%C12 FAIL%' THEN RAISE; END IF;
  END;

  IF (SELECT count(*) FROM public.payments WHERE funding_mode IS NULL) <> 0 THEN
    RAISE EXCEPTION 'C12 FAIL: unclassified committed payment exists';
  END IF;

  -- ---- XAF native wrapper ----
  PERFORM set_config('request.jwt.claim.sub', u_owner::text, true);
  PERFORM public.rpc_create_funding_request(v_project, 200000, r1);
  PERFORM set_config('request.jwt.claim.sub', u_cof::text, true);
  PERFORM public.rpc_approve_funding_request(r1);
  PERFORM set_config('request.jwt.claim.sub', u_owner::text, true);
  v_res := public.rpc_create_xaf_payment_intent(v_project, 200000, 'momo', r1);
  v_pay_xaf := (v_res->>'payment_id')::uuid;
  IF (SELECT funding_mode FROM public.payments WHERE id = v_pay_xaf) IS DISTINCT FROM 'xaf_native' THEN
    RAISE EXCEPTION 'C12 FAIL: native funding_mode';
  END IF;

  BEGIN
    UPDATE public.payments SET funding_mode = 'cross_border' WHERE id = v_pay_xaf;
    RAISE EXCEPTION 'C12 FAIL: mode switch should DENY';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err ILIKE '%C12 FAIL%' THEN RAISE; END IF;
  END;

  -- Native attempt with quote DENY
  v_a1 := NULL;
  BEGIN
    -- need a quote on another request; native attempt on r1 with random quote
    PERFORM public.rpc_create_payment_attempt(v_pay_xaf, gen_random_uuid(), gen_random_uuid());
    RAISE EXCEPTION 'C12 FAIL: native+quote should DENY';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err ILIKE '%C12 FAIL%' THEN RAISE; END IF;
  END;

  v_res := public.rpc_create_payment_attempt(v_pay_xaf, gen_random_uuid(), NULL);
  IF (v_res->>'attempt_id') IS NULL THEN
    RAISE EXCEPTION 'C12 FAIL: native A1';
  END IF;
  PERFORM public.rpc_fail_payment_attempt((v_res->>'attempt_id')::uuid, 'failed');

  -- ---- Cross-border path ----
  PERFORM set_config('request.jwt.claim.sub', u_owner::text, true);
  PERFORM public.rpc_create_funding_request(v_project, 500000, r0);
  PERFORM set_config('request.jwt.claim.sub', u_cof::text, true);
  PERFORM public.rpc_approve_funding_request(r0);
  v_res := public.rpc_record_fx_quote(
    r0, 'EUR', 76200, 'fixture_fx', 'C12-Q1',
    clock_timestamp() + interval '1 hour', NULL, gen_random_uuid()
  );
  v_q1 := (v_res->>'fx_quote_id')::uuid;

  -- Premature requote before P1: allowed (pre-intent)
  -- After P1 before A1: DENY
  PERFORM set_config('request.jwt.claim.sub', u_owner::text, true);
  v_res := public.rpc_create_cross_border_payment_intent(v_q1, 'stripe');
  v_pay := (v_res->>'payment_id')::uuid;
  IF (SELECT funding_mode FROM public.payments WHERE id = v_pay) IS DISTINCT FROM 'cross_border' THEN
    RAISE EXCEPTION 'C12 FAIL: cross_border funding_mode';
  END IF;
  IF (SELECT status FROM public.fx_quotes WHERE id = v_q1) IS DISTINCT FROM 'consumed' THEN
    RAISE EXCEPTION 'C12 FAIL: Q1 must be consumed by C03';
  END IF;

  -- Nested DEFINER: auth.uid preserved
  IF (v_res->>'auth_uid')::uuid IS DISTINCT FROM u_owner THEN
    RAISE EXCEPTION 'C12 FAIL: nested auth.uid';
  END IF;

  -- Exact Q1 retry
  v_res := public.rpc_create_cross_border_payment_intent(v_q1, 'stripe');
  IF (v_res->>'payment_id')::uuid IS DISTINCT FROM v_pay
     OR (v_res->>'idempotent_replay')::boolean IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'C12 FAIL: Q1 exact retry';
  END IF;

  -- Premature Q2 before A1
  BEGIN
    PERFORM public.rpc_record_fx_quote(
      r0, 'EUR', 77000, 'fixture_fx', 'C12-PRE',
      clock_timestamp() + interval '1 hour', NULL, gen_random_uuid()
    );
    RAISE EXCEPTION 'C12 FAIL: premature requote should DENY';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err ILIKE '%C12 FAIL%' THEN RAISE; END IF;
    IF v_err NOT ILIKE '%previous failed%' AND v_err NOT ILIKE '%attempt required%' THEN
      RAISE EXCEPTION 'C12 FAIL: expected previous-attempt requote deny, got %', v_err;
    END IF;
  END;

  -- Cross-border attempt without using bogus quote: bootstrap
  v_res := public.rpc_create_payment_attempt(v_pay, v_req1, NULL);
  v_a1 := (v_res->>'attempt_id')::uuid;
  IF (SELECT fx_quote_id FROM public.payment_attempts WHERE id = v_a1) IS DISTINCT FROM v_q1 THEN
    RAISE EXCEPTION 'C12 FAIL: A1 must bind Q1';
  END IF;
  IF (SELECT status FROM public.fx_quotes WHERE id = v_q1) IS DISTINCT FROM 'consumed' THEN
    RAISE EXCEPTION 'C12 FAIL: Q1 re-consumed';
  END IF;
  IF (SELECT status FROM public.payments WHERE id = v_pay) IS DISTINCT FROM 'processing' THEN
    RAISE EXCEPTION 'C12 FAIL: P1 processing after A1';
  END IF;

  -- Idempotent same request
  v_res := public.rpc_create_payment_attempt(v_pay, v_req1, NULL);
  IF (v_res->>'idempotent_replay')::boolean IS DISTINCT FROM true
     OR (v_res->>'attempt_id')::uuid IS DISTINCT FROM v_a1 THEN
    RAISE EXCEPTION 'C12 FAIL: attempt request idempotency';
  END IF;

  -- Mismatch same request id
  BEGIN
    PERFORM public.rpc_create_payment_attempt(v_pay_xaf, v_req1, NULL);
    RAISE EXCEPTION 'C12 FAIL: mismatch request id should DENY';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err ILIKE '%C12 FAIL%' THEN RAISE; END IF;
  END;

  -- Second active attempt DENY
  BEGIN
    PERFORM public.rpc_create_payment_attempt(v_pay, gen_random_uuid(), NULL);
    RAISE EXCEPTION 'C12 FAIL: second active attempt';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err ILIKE '%C12 FAIL%' THEN RAISE; END IF;
  END;

  -- Cross-border attempt with extra quote while bootstrapping already done — still active
  -- Fail A1 retryably
  v_res := public.rpc_fail_payment_attempt(v_a1, 'failed', 'card_declined', 'declined');
  IF (SELECT status FROM public.payment_attempts WHERE id = v_a1) IS DISTINCT FROM 'failed' THEN
    RAISE EXCEPTION 'C12 FAIL: A1 failed';
  END IF;
  IF (SELECT status FROM public.payments WHERE id = v_pay) IS DISTINCT FROM 'requires_action' THEN
    RAISE EXCEPTION 'C12 FAIL: P1 requires_action after A1 fail';
  END IF;
  IF (SELECT status FROM public.payments WHERE id = v_pay) = 'failed' THEN
    RAISE EXCEPTION 'C12 FAIL: P1 must not be failed';
  END IF;
  IF (SELECT status FROM public.escrow_funding_requests WHERE id = r0) IS DISTINCT FROM 'consumed' THEN
    RAISE EXCEPTION 'C12 FAIL: C05 reopened';
  END IF;

  -- Late success on failed A1
  BEGIN
    PERFORM public.rpc_finalize_payment_attempt_success(v_a1, 'late-ref', 'stripe');
    RAISE EXCEPTION 'C12 FAIL: late success should DENY';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err ILIKE '%C12 FAIL%' THEN RAISE; END IF;
    IF v_err NOT ILIKE '%late_provider_success_requires_reconciliation%' THEN
      RAISE EXCEPTION 'C12 FAIL: expected quarantine error, got %', v_err;
    END IF;
  END;
  IF (SELECT status FROM public.payment_attempts WHERE id = v_a1) IS DISTINCT FROM 'failed' THEN
    RAISE EXCEPTION 'C12 FAIL: A1 mutated by late success';
  END IF;

  -- Q2 ALLOW after failed attempt
  v_res := public.rpc_record_fx_quote(
    r0, 'EUR', 78000, 'fixture_fx', 'C12-Q2',
    clock_timestamp() + interval '1 hour', NULL, gen_random_uuid()
  );
  v_q2 := (v_res->>'fx_quote_id')::uuid;
  IF (SELECT status FROM public.fx_quotes WHERE id = v_q2) IS DISTINCT FROM 'usable' THEN
    RAISE EXCEPTION 'C12 FAIL: Q2 usable';
  END IF;

  -- Wrapper must not consume Q2
  BEGIN
    PERFORM public.rpc_create_cross_border_payment_intent(v_q2, 'stripe');
    RAISE EXCEPTION 'C12 FAIL: wrapper should payment_attempt_required';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err ILIKE '%C12 FAIL%' THEN RAISE; END IF;
    IF v_err NOT ILIKE '%payment_attempt_required%' THEN
      RAISE EXCEPTION 'C12 FAIL: expected payment_attempt_required, got %', v_err;
    END IF;
  END;
  IF (SELECT status FROM public.fx_quotes WHERE id = v_q2) IS DISTINCT FROM 'usable' THEN
    RAISE EXCEPTION 'C12 FAIL: Q2 consumed by wrapper';
  END IF;

  -- Forced A2 rollback: consume then raise via savepoint
  BEGIN
    PERFORM public.rpc_create_payment_attempt(v_pay, v_req2, v_q2);
    RAISE EXCEPTION 'c12_forced_a2_rollback';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err NOT ILIKE '%c12_forced_a2_rollback%' THEN RAISE; END IF;
  END;
  IF (SELECT status FROM public.fx_quotes WHERE id = v_q2) IS DISTINCT FROM 'usable' THEN
    RAISE EXCEPTION 'C12 FAIL: Q2 not rolled back';
  END IF;
  IF EXISTS (SELECT 1 FROM public.payment_attempts WHERE attempt_request_id = v_req2) THEN
    RAISE EXCEPTION 'C12 FAIL: A2 not rolled back';
  END IF;
  IF (SELECT status FROM public.payments WHERE id = v_pay) IS DISTINCT FROM 'requires_action' THEN
    RAISE EXCEPTION 'C12 FAIL: P1 after A2 rollback';
  END IF;

  -- Real A2
  v_res := public.rpc_create_payment_attempt(v_pay, v_req2, v_q2);
  v_a2 := (v_res->>'attempt_id')::uuid;
  IF (SELECT status FROM public.fx_quotes WHERE id = v_q2) IS DISTINCT FROM 'consumed' THEN
    RAISE EXCEPTION 'C12 FAIL: Q2 not consumed with A2';
  END IF;
  IF (SELECT status FROM public.payments WHERE id = v_pay) IS DISTINCT FROM 'processing' THEN
    RAISE EXCEPTION 'C12 FAIL: P1 processing after A2';
  END IF;

  -- Q3 while A2 active DENY
  BEGIN
    PERFORM public.rpc_record_fx_quote(
      r0, 'EUR', 79000, 'fixture_fx', 'C12-Q3',
      clock_timestamp() + interval '1 hour', NULL, gen_random_uuid()
    );
    RAISE EXCEPTION 'C12 FAIL: Q3 during active attempt';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err ILIKE '%C12 FAIL%' THEN RAISE; END IF;
  END;

  -- Attach-once
  PERFORM public.rpc_attach_payment_attempt_ref(v_a2, 'win-ref-1');
  BEGIN
    PERFORM public.rpc_attach_payment_attempt_ref(v_a2, 'win-ref-2');
    RAISE EXCEPTION 'C12 FAIL: ref overwrite';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err ILIKE '%C12 FAIL%' THEN RAISE; END IF;
  END;

  -- Success mismatch provider
  BEGIN
    PERFORM public.rpc_finalize_payment_attempt_success(v_a2, 'win-ref-1', 'momo');
    RAISE EXCEPTION 'C12 FAIL: provider mismatch should DENY';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err ILIKE '%C12 FAIL%' THEN RAISE; END IF;
  END;

  -- Forced ledger failure rollback
  CREATE OR REPLACE FUNCTION public.c12_test_abort_journal()
  RETURNS trigger LANGUAGE plpgsql AS $t$
  BEGIN
    IF current_setting('c12.abort_journal', true) = '1' THEN
      RAISE EXCEPTION 'c12 test forced ledger failure';
    END IF;
    RETURN NEW;
  END;
  $t$;
  DROP TRIGGER IF EXISTS c12_abort_journal_trg ON public.ledger_journals;
  CREATE TRIGGER c12_abort_journal_trg
    BEFORE INSERT ON public.ledger_journals
    FOR EACH ROW EXECUTE FUNCTION public.c12_test_abort_journal();

  BEGIN
    PERFORM set_config('c12.abort_journal', '1', true);
    PERFORM public.rpc_finalize_payment_attempt_success(v_a2, 'win-ref-1', 'stripe');
    RAISE EXCEPTION 'C12 FAIL: forced ledger failure should abort';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err ILIKE '%C12 FAIL%' THEN RAISE; END IF;
    IF v_err NOT ILIKE '%forced ledger%' THEN
      RAISE EXCEPTION 'C12 FAIL: expected forced ledger, got %', v_err;
    END IF;
  END;

  IF (SELECT status FROM public.payment_attempts WHERE id = v_a2) IS DISTINCT FROM 'submitted'
     AND (SELECT status FROM public.payment_attempts WHERE id = v_a2) IS DISTINCT FROM 'created'
     AND (SELECT status FROM public.payment_attempts WHERE id = v_a2) IS DISTINCT FROM 'processing' THEN
    RAISE EXCEPTION 'C12 FAIL: attempt succeeded after rollback, status=%',
      (SELECT status FROM public.payment_attempts WHERE id = v_a2);
  END IF;
  IF (SELECT status FROM public.payments WHERE id = v_pay) IS DISTINCT FROM 'processing' THEN
    RAISE EXCEPTION 'C12 FAIL: payment status after rollback %',
      (SELECT status FROM public.payments WHERE id = v_pay);
  END IF;
  IF (SELECT psp_ref FROM public.payments WHERE id = v_pay) IS NOT NULL THEN
    RAISE EXCEPTION 'C12 FAIL: psp_ref promoted after rollback';
  END IF;
  IF (SELECT ledger_journal_id FROM public.payments WHERE id = v_pay) IS NOT NULL THEN
    RAISE EXCEPTION 'C12 FAIL: journal after rollback';
  END IF;

  DROP TRIGGER IF EXISTS c12_abort_journal_trg ON public.ledger_journals;
  DROP FUNCTION public.c12_test_abort_journal();
  PERFORM set_config('c12.abort_journal', '', true);

  -- Happy-path success
  v_jcount := (SELECT count(*) FROM public.ledger_journals);
  v_res := public.rpc_finalize_payment_attempt_success(v_a2, 'win-ref-1', 'stripe');
  IF (SELECT status FROM public.payment_attempts WHERE id = v_a2) IS DISTINCT FROM 'succeeded' THEN
    RAISE EXCEPTION 'C12 FAIL: A2 succeeded';
  END IF;
  IF (SELECT psp_ref FROM public.payments WHERE id = v_pay) IS DISTINCT FROM 'win-ref-1' THEN
    RAISE EXCEPTION 'C12 FAIL: winner psp_ref';
  END IF;
  IF (SELECT status FROM public.payments WHERE id = v_pay) IS DISTINCT FROM 'succeeded' THEN
    RAISE EXCEPTION 'C12 FAIL: P1 succeeded';
  END IF;
  SELECT ledger_journal_id INTO v_j FROM public.payments WHERE id = v_pay;
  IF v_j IS NULL THEN
    RAISE EXCEPTION 'C12 FAIL: ledger_journal_id';
  END IF;
  IF (SELECT count(*) FROM public.ledger_journals) <> v_jcount + 1 THEN
    RAISE EXCEPTION 'C12 FAIL: expected +1 journal';
  END IF;
  SELECT COALESCE(sum(credit_xaf),0) INTO v_escrow
  FROM public.ledger_lines
  WHERE journal_id = v_j AND account_id IN (
    SELECT id FROM public.ledger_accounts WHERE purpose = 'project_escrow'
  );
  IF v_escrow <> 500000 THEN
    RAISE EXCEPTION 'C12 FAIL: escrow credit %', v_escrow;
  END IF;
  IF (SELECT count(*) FROM public.payment_attempts WHERE payment_id = v_pay AND status = 'succeeded') <> 1 THEN
    RAISE EXCEPTION 'C12 FAIL: one success';
  END IF;

  -- Replay success
  v_res := public.rpc_finalize_payment_attempt_success(v_a2, 'win-ref-1', 'stripe');
  IF (v_res->>'idempotent_replay')::boolean IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'C12 FAIL: success replay';
  END IF;
  IF (SELECT count(*) FROM public.ledger_journals) <> v_jcount + 1 THEN
    RAISE EXCEPTION 'C12 FAIL: second journal on replay';
  END IF;

  -- Requote after success DENY
  BEGIN
    PERFORM public.rpc_record_fx_quote(
      r0, 'EUR', 80000, 'fixture_fx', 'C12-AFTER-SUCC',
      clock_timestamp() + interval '1 hour', NULL, gen_random_uuid()
    );
    RAISE EXCEPTION 'C12 FAIL: requote after success';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err ILIKE '%C12 FAIL%' THEN RAISE; END IF;
  END;

  -- Abandon native payment (requires_action after fail)
  PERFORM public.rpc_abandon_payment(v_pay_xaf, 'canceled');
  BEGIN
    PERFORM public.rpc_create_payment_attempt(v_pay_xaf, gen_random_uuid(), NULL);
    RAISE EXCEPTION 'C12 FAIL: attempt after canceled P1';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err ILIKE '%C12 FAIL%' THEN RAISE; END IF;
  END;

  -- Amount invariant
  IF (SELECT p.amount_xaf = q.target_amount_xaf AND p.amount_xaf = r.amount_xaf
      FROM public.payments p
      JOIN public.fx_quotes q ON q.id = v_q2
      JOIN public.escrow_funding_requests r ON r.id = r0
      WHERE p.id = v_pay) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'C12 FAIL: amount invariant';
  END IF;

  RAISE NOTICE 'C12-R local proof PASS';
END;
$$;

SELECT 'c12_payment_attempts.sql: PASS' AS result;
