-- =============================================================================
-- C03-R3 / R3.1 schema + semantics regression (active migration chain)
-- Prerequisites: npx supabase db reset --local (includes C03).
-- No external FX/PSP calls.
-- =============================================================================

DO $$
DECLARE
  u_owner uuid := gen_random_uuid();
  u_cofunder uuid := gen_random_uuid();
  u_observer uuid := gen_random_uuid();
  u_other uuid := gen_random_uuid();
  u_prov uuid := gen_random_uuid();
  v_project uuid;
  r0 uuid := gen_random_uuid();
  r1 uuid := gen_random_uuid();
  q_req1 uuid := gen_random_uuid();
  q_req2 uuid := gen_random_uuid();
  q_req3 uuid := gen_random_uuid();
  q_req_bad uuid := gen_random_uuid();
  v_res jsonb;
  v_q1 uuid;
  v_q2 uuid;
  v_q3 uuid;
  v_pay uuid;
  v_pay2 uuid;
  v_status text;
  v_consumed_at timestamptz;
  v_payment_id uuid;
  v_cnt int;
  v_err text;
  v_uid_seen uuid;
  v_c12 boolean;
BEGIN
  IF to_regclass('public.fx_quotes') IS NULL THEN
    RAISE EXCEPTION 'C03 FAIL: fx_quotes missing from active migration chain';
  END IF;
  v_c12 := to_regclass('public.payment_attempts') IS NOT NULL;

  INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, instance_id, confirmation_token, recovery_token, email_change_token_new, email_change)
  VALUES
    (u_owner, 'authenticated', 'authenticated', 'c03r3_o_' || u_owner::text || '@test.local', crypt('x', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000', '', '', '', ''),
    (u_cofunder, 'authenticated', 'authenticated', 'c03r3_c_' || u_cofunder::text || '@test.local', crypt('x', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000', '', '', '', ''),
    (u_observer, 'authenticated', 'authenticated', 'c03r3_obs_' || u_observer::text || '@test.local', crypt('x', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000', '', '', '', ''),
    (u_other, 'authenticated', 'authenticated', 'c03r3_x_' || u_other::text || '@test.local', crypt('x', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000', '', '', '', ''),
    (u_prov, 'authenticated', 'authenticated', 'c03r3_p_' || u_prov::text || '@test.local', crypt('x', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000', '', '', '', '');

  INSERT INTO public.profiles (id, role) VALUES
    (u_owner, 'client'), (u_cofunder, 'client'), (u_observer, 'client'),
    (u_other, 'client'), (u_prov, 'provider');

  IF (SELECT is_funding FROM public.platform_currencies WHERE code = 'EUR') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'C03 FAIL: EUR is_funding must be false';
  END IF;

  INSERT INTO public.projects (owner_id, assigned_provider_id, funder_ids, status, title)
  VALUES (u_owner, u_prov, ARRAY[u_cofunder]::uuid[], 'open', 'c03-r3')
  RETURNING id INTO v_project;

  -- C05 request + approval
  PERFORM set_config('request.jwt.claim.sub', u_owner::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM public.rpc_create_funding_request(v_project, 500000, r0);
  PERFORM set_config('request.jwt.claim.sub', u_cofunder::text, true);
  PERFORM public.rpc_approve_funding_request(r0);

  -- ---- Test A: initial Q1 ----
  v_res := public.rpc_record_fx_quote(
    r0, 'EUR', 76200, 'fixture_fx', 'R3-Q1',
    clock_timestamp() + interval '30 minutes', 655.957, q_req1
  );
  v_q1 := (v_res->>'fx_quote_id')::uuid;

  -- Auth denials
  PERFORM set_config('request.jwt.claim.sub', u_other::text, true);
  BEGIN
    PERFORM public.rpc_create_cross_border_payment_intent(v_q1, 'stripe');
    RAISE EXCEPTION 'C03 FAIL: random user should DENY';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
    WHEN raise_exception THEN
      GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
      IF v_err ILIKE '%C03 FAIL%' THEN RAISE; END IF;
  END;

  PERFORM set_config('request.jwt.claim.sub', u_observer::text, true);
  BEGIN
    PERFORM public.rpc_create_cross_border_payment_intent(v_q1, 'stripe');
    RAISE EXCEPTION 'C03 FAIL: observer should DENY';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
    WHEN raise_exception THEN
      GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
      IF v_err ILIKE '%C03 FAIL%' THEN RAISE; END IF;
  END;

  PERFORM set_config('request.jwt.claim.sub', u_owner::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  v_res := public.rpc_create_cross_border_payment_intent(v_q1, 'stripe');
  v_pay := (v_res->>'payment_id')::uuid;
  v_uid_seen := (v_res->>'auth_uid')::uuid;
  IF v_uid_seen IS DISTINCT FROM u_owner THEN
    RAISE EXCEPTION 'C03 FAIL: nested auth.uid not requester';
  END IF;
  IF (SELECT amount_xaf FROM public.payments WHERE id = v_pay) IS DISTINCT FROM 500000 THEN
    RAISE EXCEPTION 'C03 FAIL: payment amount';
  END IF;
  SELECT status, payment_id, consumed_at
    INTO v_status, v_payment_id, v_consumed_at
  FROM public.fx_quotes WHERE id = v_q1;
  IF v_status IS DISTINCT FROM 'consumed'
     OR v_payment_id IS DISTINCT FROM v_pay
     OR v_consumed_at IS NULL THEN
    RAISE EXCEPTION 'C03 FAIL: Q1 must be consumed and linked';
  END IF;
  IF (SELECT status FROM public.escrow_funding_requests WHERE id = r0) IS DISTINCT FROM 'consumed' THEN
    RAISE EXCEPTION 'C03 FAIL: C05 must be consumed';
  END IF;

  -- ---- Test B: exact Q1 retry ----
  v_res := public.rpc_create_cross_border_payment_intent(v_q1, 'stripe');
  IF (v_res->>'payment_id')::uuid IS DISTINCT FROM v_pay
     OR (v_res->>'idempotent_replay')::boolean IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'C03 FAIL: exact Q1 retry must return same P1';
  END IF;
  SELECT count(*) INTO v_cnt FROM public.payments WHERE client_request_id = r0;
  IF v_cnt <> 1 THEN
    RAISE EXCEPTION 'C03 FAIL: second logical payment created';
  END IF;

  -- ---- Test I: requires_action → DENY post-intent requote ----
  IF (SELECT status FROM public.payments WHERE id = v_pay) IS DISTINCT FROM 'requires_action' THEN
    RAISE EXCEPTION 'C03 FAIL: expected requires_action after create';
  END IF;
  BEGIN
    PERFORM public.rpc_record_fx_quote(
      r0, 'EUR', 77000, 'fixture_fx', 'R3-RA',
      clock_timestamp() + interval '30 minutes', NULL, gen_random_uuid()
    );
    RAISE EXCEPTION 'C03 FAIL: requires_action requote should DENY';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err ILIKE '%C03 FAIL%' THEN RAISE; END IF;
    IF v_c12 THEN
      IF v_err NOT ILIKE '%previous failed%' AND v_err NOT ILIKE '%attempt required%' THEN
        RAISE EXCEPTION 'C03 FAIL: C12-era requires_action/no-attempt must deny for missing failed attempt, got %', v_err;
      END IF;
    ELSE
      IF v_err NOT ILIKE '%requires_action%' THEN
        RAISE EXCEPTION 'C03 FAIL: expected requires_action deny, got %', v_err;
      END IF;
    END IF;
  END;

  -- ---- Test F: processing → DENY ----
  UPDATE public.payments SET status = 'processing' WHERE id = v_pay;
  BEGIN
    PERFORM public.rpc_record_fx_quote(
      r0, 'EUR', 77000, 'fixture_fx', 'R3-PROC',
      clock_timestamp() + interval '30 minutes', NULL, gen_random_uuid()
    );
    RAISE EXCEPTION 'C03 FAIL: processing requote should DENY';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err ILIKE '%C03 FAIL%' THEN RAISE; END IF;
    IF v_err NOT ILIKE '%processing%' THEN
      RAISE EXCEPTION 'C03 FAIL: expected processing deny, got %', v_err;
    END IF;
  END;

  -- ---- Test C/D/E: post-intent requote (BOTH eras asserted; never skip) ----
  UPDATE public.payments SET status = 'requires_action' WHERE id = v_pay;
  IF NOT v_c12 THEN
    RAISE NOTICE 'PRE_C12_C03_REQUOTE_BRANCH';
    UPDATE public.payments SET status = 'failed' WHERE id = v_pay;
    v_res := public.rpc_record_fx_quote(
      r0, 'EUR', 78000, 'fixture_fx', 'R3-Q2',
      clock_timestamp() + interval '30 minutes', NULL, q_req2
    );
    v_q2 := (v_res->>'fx_quote_id')::uuid;
    IF (SELECT status FROM public.fx_quotes WHERE id = v_q2) IS DISTINCT FROM 'usable' THEN
      RAISE EXCEPTION 'C03 FAIL: Q2 must be usable after failed P1 (pre-C12)';
    END IF;
    PERFORM set_config('request.jwt.claim.sub', u_owner::text, true);
    BEGIN
      PERFORM public.rpc_create_cross_border_payment_intent(v_q2, 'stripe');
      RAISE EXCEPTION 'C03 FAIL: Q2 wrapper should DENY payment_attempt_required';
    EXCEPTION WHEN raise_exception THEN
      GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
      IF v_err ILIKE '%C03 FAIL%' THEN RAISE; END IF;
      IF v_err NOT ILIKE '%payment_attempt_required%' THEN
        RAISE EXCEPTION 'C03 FAIL: expected payment_attempt_required, got %', v_err;
      END IF;
    END;
    UPDATE public.payments SET status = 'canceled' WHERE id = v_pay;
    v_res := public.rpc_record_fx_quote(
      r0, 'EUR', 78100, 'fixture_fx', 'R3-Q2C',
      clock_timestamp() + interval '30 minutes', NULL, gen_random_uuid()
    );
    v_q3 := (v_res->>'fx_quote_id')::uuid;
    IF (SELECT status FROM public.fx_quotes WHERE id = v_q3) IS DISTINCT FROM 'usable' THEN
      RAISE EXCEPTION 'C03 FAIL: Q2 must be usable after canceled P1 (pre-C12)';
    END IF;
    BEGIN
      PERFORM public.rpc_create_cross_border_payment_intent(v_q3, 'stripe');
      RAISE EXCEPTION 'C03 FAIL: canceled path wrapper should DENY';
    EXCEPTION WHEN raise_exception THEN
      GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
      IF v_err ILIKE '%C03 FAIL%' THEN RAISE; END IF;
    END;
  ELSE
    RAISE NOTICE 'C12_ERA_C03_REQUOTE_BRANCH';
    UPDATE public.payments SET status = 'failed' WHERE id = v_pay;
    BEGIN
      PERFORM public.rpc_record_fx_quote(
        r0, 'EUR', 78000, 'fixture_fx', 'R3-Q2-FAILP1',
        clock_timestamp() + interval '30 minutes', NULL, q_req2
      );
      RAISE EXCEPTION 'C03 FAIL: C12-era failed P1 requote should DENY';
    EXCEPTION WHEN raise_exception THEN
      GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
      IF v_err ILIKE '%C03 FAIL%' THEN RAISE; END IF;
      IF v_err NOT ILIKE '%failed%' AND v_err NOT ILIKE '%canceled%' AND v_err NOT ILIKE '%status%' THEN
        RAISE EXCEPTION 'C03 FAIL: expected terminal-P1 deny, got %', v_err;
      END IF;
    END;
    UPDATE public.payments SET status = 'canceled' WHERE id = v_pay;
    BEGIN
      PERFORM public.rpc_record_fx_quote(
        r0, 'EUR', 78100, 'fixture_fx', 'R3-Q2-CANP1',
        clock_timestamp() + interval '30 minutes', NULL, gen_random_uuid()
      );
      RAISE EXCEPTION 'C03 FAIL: C12-era canceled P1 requote should DENY';
    EXCEPTION WHEN raise_exception THEN
      GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
      IF v_err ILIKE '%C03 FAIL%' THEN RAISE; END IF;
    END;
    -- Restore retryable idle, create/fail A1, then Q2 MUST ALLOW
    UPDATE public.payments SET status = 'requires_action' WHERE id = v_pay;
    v_res := public.rpc_create_payment_attempt(v_pay, gen_random_uuid(), NULL);
    PERFORM public.rpc_fail_payment_attempt((v_res->>'attempt_id')::uuid, 'failed');
    IF (SELECT status FROM public.payments WHERE id = v_pay) IS DISTINCT FROM 'requires_action' THEN
      RAISE EXCEPTION 'C03 FAIL: C12-era P1 must be requires_action after attempt fail';
    END IF;
    v_res := public.rpc_record_fx_quote(
      r0, 'EUR', 78200, 'fixture_fx', 'R3-Q2-AFTER-A1',
      clock_timestamp() + interval '30 minutes', NULL, gen_random_uuid()
    );
    v_q2 := (v_res->>'fx_quote_id')::uuid;
    IF (SELECT status FROM public.fx_quotes WHERE id = v_q2) IS DISTINCT FROM 'usable' THEN
      RAISE EXCEPTION 'C03 FAIL: C12-era Q2 must be usable after failed A1 + requires_action';
    END IF;
    PERFORM set_config('request.jwt.claim.sub', u_owner::text, true);
    BEGIN
      PERFORM public.rpc_create_cross_border_payment_intent(v_q2, 'stripe');
      RAISE EXCEPTION 'C03 FAIL: C12-era Q2 wrapper should DENY payment_attempt_required';
    EXCEPTION WHEN raise_exception THEN
      GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
      IF v_err ILIKE '%C03 FAIL%' THEN RAISE; END IF;
      IF v_err NOT ILIKE '%payment_attempt_required%' THEN
        RAISE EXCEPTION 'C03 FAIL: expected payment_attempt_required, got %', v_err;
      END IF;
    END;
    IF (SELECT status FROM public.fx_quotes WHERE id = v_q2) IS DISTINCT FROM 'usable' THEN
      RAISE EXCEPTION 'C03 FAIL: C12-era wrapper must not consume Q2';
    END IF;
  END IF;

  -- ---- Test G: succeeded → DENY ----
  UPDATE public.payments SET status = 'succeeded' WHERE id = v_pay;
  BEGIN
    PERFORM public.rpc_record_fx_quote(
      r0, 'EUR', 79000, 'fixture_fx', 'R3-SUCC',
      clock_timestamp() + interval '30 minutes', NULL, gen_random_uuid()
    );
    RAISE EXCEPTION 'C03 FAIL: succeeded requote should DENY';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err ILIKE '%C03 FAIL%' THEN RAISE; END IF;
    IF v_err NOT ILIKE '%succeeded%' THEN
      RAISE EXCEPTION 'C03 FAIL: expected succeeded deny, got %', v_err;
    END IF;
  END;

  -- ---- Test H: ledger-posted → DENY ----
  -- Avoid creating unbalanced journals (Phase1 balance trigger).
  -- Link payment to a journal created with lines via a savepoint-safe path:
  -- use rpc_mark_payment_succeeded + rpc_post_escrow_funding on a clean request.
  DECLARE
    r_led uuid := gen_random_uuid();
    v_qled uuid;
    v_pled uuid;
    v_j uuid;
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', u_owner::text, true);
    PERFORM public.rpc_create_funding_request(v_project, 50000, r_led);
    PERFORM set_config('request.jwt.claim.sub', u_cofunder::text, true);
    PERFORM public.rpc_approve_funding_request(r_led);

    v_res := public.rpc_record_fx_quote(
      r_led, 'EUR', 7600, 'fixture_fx', 'R3-LED-Q',
      clock_timestamp() + interval '30 minutes', NULL, gen_random_uuid()
    );
    v_qled := (v_res->>'fx_quote_id')::uuid;

    PERFORM set_config('request.jwt.claim.sub', u_owner::text, true);
    v_res := public.rpc_create_cross_border_payment_intent(v_qled, 'orange');
    v_pled := (v_res->>'payment_id')::uuid;

    -- Service-role success + post (existing C06 primitives)
    PERFORM public.rpc_attach_payment_psp_ref(v_pled, 'led-ref-1');
    PERFORM public.rpc_mark_payment_succeeded(v_pled, 'led-ref-1', 50000, 'XAF', 'orange');
    PERFORM public.rpc_post_escrow_funding(v_pled);

    SELECT ledger_journal_id INTO v_j FROM public.payments WHERE id = v_pled;
    IF v_j IS NULL THEN
      RAISE EXCEPTION 'C03 FAIL: expected ledger_journal_id after post';
    END IF;

    BEGIN
      PERFORM public.rpc_record_fx_quote(
        r_led, 'EUR', 7700, 'fixture_fx', 'R3-LED-DENY',
        clock_timestamp() + interval '30 minutes', NULL, gen_random_uuid()
      );
      RAISE EXCEPTION 'C03 FAIL: ledger-posted requote should DENY';
    EXCEPTION WHEN raise_exception THEN
      GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
      IF v_err ILIKE '%C03 FAIL%' THEN RAISE; END IF;
      IF v_err NOT ILIKE '%ledger-posted%' AND v_err NOT ILIKE '%ledger%'
         AND v_err NOT ILIKE '%succeeded%' THEN
        RAISE EXCEPTION 'C03 FAIL: expected ledger/succeeded deny, got %', v_err;
      END IF;
    END;
  END;

  -- ---- Test J/K: quote_request_id idempotency ----
  -- New funding request for clean pre-intent tests
  PERFORM set_config('request.jwt.claim.sub', u_owner::text, true);
  PERFORM public.rpc_create_funding_request(v_project, 100000, r1);
  PERFORM set_config('request.jwt.claim.sub', u_cofunder::text, true);
  PERFORM public.rpc_approve_funding_request(r1);

  v_res := public.rpc_record_fx_quote(
    r1, 'EUR', 15000, 'fixture_fx', 'R3-IDEM',
    clock_timestamp() + interval '30 minutes', NULL, q_req3
  );
  v_q1 := (v_res->>'fx_quote_id')::uuid;
  v_res := public.rpc_record_fx_quote(
    r1, 'EUR', 15000, 'fixture_fx', 'R3-IDEM',
    clock_timestamp() + interval '30 minutes', NULL, q_req3
  );
  IF (v_res->>'idempotent_replay')::boolean IS DISTINCT FROM true
     OR (v_res->>'fx_quote_id')::uuid IS DISTINCT FROM v_q1 THEN
    RAISE EXCEPTION 'C03 FAIL: quote_request_id same replay';
  END IF;

  BEGIN
    PERFORM public.rpc_record_fx_quote(
      r1, 'EUR', 15001, 'fixture_fx', 'R3-IDEM-DIFF',
      clock_timestamp() + interval '30 minutes', NULL, q_req3
    );
    RAISE EXCEPTION 'C03 FAIL: quote_request_id mismatch should DENY';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err ILIKE '%C03 FAIL%' THEN RAISE; END IF;
  END;

  -- ---- Test L: concurrent replacement → one usable ----
  v_res := public.rpc_record_fx_quote(
    r1, 'EUR', 15100, 'other_fx', 'R3-REP',
    clock_timestamp() + interval '30 minutes', NULL, gen_random_uuid()
  );
  v_q2 := (v_res->>'fx_quote_id')::uuid;
  SELECT count(*) INTO v_cnt
  FROM public.fx_quotes
  WHERE funding_request_id = r1 AND status = 'usable';
  IF v_cnt <> 1 THEN
    RAISE EXCEPTION 'C03 FAIL: expected exactly one usable quote';
  END IF;
  IF (SELECT status FROM public.fx_quotes WHERE id = v_q1) IS DISTINCT FROM 'superseded' THEN
    RAISE EXCEPTION 'C03 FAIL: prior usable should be superseded';
  END IF;

  -- Cross-provider same raw ref allowed
  v_res := public.rpc_record_fx_quote(
    r1, 'EUR', 15200, 'third_fx', 'R3-REP',
    clock_timestamp() + interval '30 minutes', NULL, gen_random_uuid()
  );
  IF (v_res->>'fx_quote_id') IS NULL THEN
    RAISE EXCEPTION 'C03 FAIL: cross-provider same raw ref must be independent';
  END IF;

  -- ---- Test M: initial wrapper on r1 ----
  PERFORM set_config('request.jwt.claim.sub', u_owner::text, true);
  SELECT id INTO v_q3 FROM public.fx_quotes
  WHERE funding_request_id = r1 AND status = 'usable';
  v_res := public.rpc_create_cross_border_payment_intent(v_q3, 'momo');
  v_pay2 := (v_res->>'payment_id')::uuid;
  IF (SELECT status FROM public.fx_quotes WHERE id = v_q3) IS DISTINCT FROM 'consumed' THEN
    RAISE EXCEPTION 'C03 FAIL: initial r1 quote must consume';
  END IF;
  SELECT count(*) INTO v_cnt FROM public.payments WHERE client_request_id = r1;
  IF v_cnt <> 1 THEN
    RAISE EXCEPTION 'C03 FAIL: r1 must have one payment';
  END IF;

  -- No fx pnl.
  IF to_regclass('public.platform_fx_pnl') IS NOT NULL THEN
    RAISE EXCEPTION 'C03 FAIL: unexpected PnL table';
  END IF;

  IF v_c12 THEN
    RAISE NOTICE 'C03-R3 C12-ERA local proof PASS';
  ELSE
    RAISE NOTICE 'C03-R3 PRE-C12 local proof PASS';
  END IF;
END;
$$;
