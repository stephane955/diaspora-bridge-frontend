-- =============================================================================
-- C05-R2 + C06 disposable integration (LOCAL ONLY)
-- Prerequisites: P01 baseline, then apply future C05, then future C06 manually.
-- No PSP. No requirement to post ledger. Reset afterward.
-- =============================================================================

DO $$
DECLARE
  u_owner uuid := gen_random_uuid();
  u_a uuid := gen_random_uuid();
  u_b uuid := gen_random_uuid();
  u_prov uuid := gen_random_uuid();
  v_project uuid;
  r1 uuid := gen_random_uuid();
  r2 uuid := gen_random_uuid();
  r3 uuid := gen_random_uuid();
  v_res jsonb;
  v_pay uuid;
  v_status text;
  v_err text;
  v_journals int;
BEGIN
  IF to_regclass('public.escrow_funding_requests') IS NULL
     OR to_regclass('public.payments') IS NULL THEN
    RAISE EXCEPTION 'INTEGRATION FAIL: apply future C05 then C06 on disposable local DB first';
  END IF;

  INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, instance_id, confirmation_token, recovery_token, email_change_token_new, email_change)
  VALUES
    (u_owner, 'authenticated', 'authenticated', 'c05i_o_' || u_owner::text || '@test.local', crypt('x', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000', '', '', '', ''),
    (u_a, 'authenticated', 'authenticated', 'c05i_a_' || u_a::text || '@test.local', crypt('x', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000', '', '', '', ''),
    (u_b, 'authenticated', 'authenticated', 'c05i_b_' || u_b::text || '@test.local', crypt('x', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000', '', '', '', ''),
    (u_prov, 'authenticated', 'authenticated', 'c05i_p_' || u_prov::text || '@test.local', crypt('x', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000', '', '', '', '');

  INSERT INTO public.profiles (id, role) VALUES
    (u_owner, 'client'), (u_a, 'client'), (u_b, 'client'), (u_prov, 'provider');

  INSERT INTO public.projects (owner_id, assigned_provider_id, funder_ids, status, title)
  VALUES (u_owner, u_prov, ARRAY[]::uuid[], 'open', 'c05-int')
  RETURNING id INTO v_project;

  -- Single co-funder bypass check: [A] without approval → DENY intent
  PERFORM set_config('request.jwt.claim.sub', u_owner::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM public.rpc_set_project_funders(v_project, ARRAY[u_a]);
  PERFORM public.rpc_create_funding_request(v_project, 100000, r1);

  BEGIN
    PERFORM public.rpc_create_payment_intent(v_project, 100000, 'momo', r1);
    RAISE EXCEPTION 'INTEGRATION FAIL: 1 co-funder missing approval must DENY intent';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err ILIKE '%INTEGRATION FAIL%' THEN RAISE; END IF;
  END;

  PERFORM set_config('request.jwt.claim.sub', u_a::text, true);
  PERFORM public.rpc_approve_funding_request(r1);

  PERFORM set_config('request.jwt.claim.sub', u_owner::text, true);
  v_res := public.rpc_create_payment_intent(v_project, 100000, 'momo', r1);
  IF (v_res->>'idempotent_replay')::boolean IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'INTEGRATION FAIL: first intent should not be replay';
  END IF;
  v_pay := (v_res->>'payment_id')::uuid;

  SELECT status INTO v_status FROM public.escrow_funding_requests WHERE id = r1;
  IF v_status IS DISTINCT FROM 'consumed' THEN
    RAISE EXCEPTION 'INTEGRATION FAIL: request must be consumed at intent create';
  END IF;

  -- Idempotent retry after consumption
  v_res := public.rpc_create_payment_intent(v_project, 100000, 'momo', r1);
  IF (v_res->>'idempotent_replay')::boolean IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'INTEGRATION FAIL: retry must return idempotent_replay';
  END IF;
  IF (v_res->>'payment_id')::uuid IS DISTINCT FROM v_pay THEN
    RAISE EXCEPTION 'INTEGRATION FAIL: retry must return same payment_id';
  END IF;

  -- Mismatched amount retry
  BEGIN
    PERFORM public.rpc_create_payment_intent(v_project, 100001, 'momo', r1);
    RAISE EXCEPTION 'INTEGRATION FAIL: amount mismatch must DENY';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err ILIKE '%INTEGRATION FAIL%' THEN RAISE; END IF;
  END;

  -- Two co-funders: owner request needs A+B
  PERFORM public.rpc_set_project_funders(v_project, ARRAY[u_a, u_b]);
  PERFORM public.rpc_create_funding_request(v_project, 200000, r2);
  BEGIN
    PERFORM public.rpc_create_payment_intent(v_project, 200000, 'momo', r2);
    RAISE EXCEPTION 'INTEGRATION FAIL: missing A+B must DENY';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err ILIKE '%INTEGRATION FAIL%' THEN RAISE; END IF;
  END;

  PERFORM set_config('request.jwt.claim.sub', u_a::text, true);
  PERFORM public.rpc_approve_funding_request(r2);
  PERFORM set_config('request.jwt.claim.sub', u_owner::text, true);
  BEGIN
    PERFORM public.rpc_create_payment_intent(v_project, 200000, 'momo', r2);
    RAISE EXCEPTION 'INTEGRATION FAIL: only A approved must DENY';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err ILIKE '%INTEGRATION FAIL%' THEN RAISE; END IF;
  END;

  PERFORM set_config('request.jwt.claim.sub', u_b::text, true);
  PERFORM public.rpc_approve_funding_request(r2);
  PERFORM set_config('request.jwt.claim.sub', u_owner::text, true);
  v_res := public.rpc_create_payment_intent(v_project, 200000, 'momo', r2);
  IF (v_res->>'payment_id') IS NULL THEN
    RAISE EXCEPTION 'INTEGRATION FAIL: A+B should ALLOW intent';
  END IF;

  -- Cross-request: new request needs new approvals
  PERFORM public.rpc_create_funding_request(v_project, 200000, r3);
  BEGIN
    PERFORM public.rpc_create_payment_intent(v_project, 200000, 'momo', r3);
    RAISE EXCEPTION 'INTEGRATION FAIL: cross-request must DENY without fresh approvals';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err ILIKE '%INTEGRATION FAIL%' THEN RAISE; END IF;
  END;

  -- No ledger posts from intent create alone
  SELECT count(*)::int INTO v_journals FROM public.ledger_journals;
  IF v_journals <> 0 THEN
    RAISE EXCEPTION 'INTEGRATION FAIL: journals must stay 0, got %', v_journals;
  END IF;

  -- Exactly one payment per request id
  IF (SELECT count(*) FROM public.payments WHERE client_request_id = r1) <> 1 THEN
    RAISE EXCEPTION 'INTEGRATION FAIL: duplicate payments for r1';
  END IF;

  RAISE NOTICE 'c05_c06_funding_integration.sql: PASS';
END;
$$;

SELECT 'c05_c06_funding_integration.sql: PASS' AS result;
