-- =============================================================================
-- C06-R disposable funding tests (LOCAL ONLY)
-- Prerequisites: active C05 chain, then manually apply future C06 SQL.
-- No external PSP. Reset afterward to C05 baseline (payments ABSENT).
-- After C12 candidate: historical rpc_create_payment_intent is internal;
-- XAF tests use rpc_create_xaf_payment_intent. Financial assertions unchanged.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.c06_test_create_intent(
  p_project_id uuid, p_amount_xaf bigint, p_psp_provider text, p_client_request_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF to_regclass('public.payment_attempts') IS NOT NULL THEN
    RETURN public.rpc_create_xaf_payment_intent(p_project_id, p_amount_xaf, p_psp_provider, p_client_request_id);
  END IF;
  RETURN public.rpc_create_payment_intent(p_project_id, p_amount_xaf, p_psp_provider, p_client_request_id);
END;
$$;

DO $$
DECLARE
  u_owner uuid := gen_random_uuid();
  u_a uuid := gen_random_uuid();
  u_b uuid := gen_random_uuid();
  u_other uuid := gen_random_uuid();
  u_prov uuid := gen_random_uuid();
  v_project uuid;
  r0 uuid := gen_random_uuid();
  r1 uuid := gen_random_uuid();
  r2 uuid := gen_random_uuid();
  v_res jsonb;
  v_pay uuid;
  v_pay2 uuid;
  v_journal uuid;
  v_jcount int;
  v_escrow bigint;
  v_err text;
  v_status text;
BEGIN
  IF to_regclass('public.payments') IS NULL THEN
    RAISE EXCEPTION 'C06 FAIL: apply future C06 SQL on disposable local DB first';
  END IF;
  IF to_regclass('public.escrow_funding_requests') IS NULL THEN
    RAISE EXCEPTION 'C06 FAIL: C05 escrow_funding_requests required';
  END IF;

  INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, instance_id, confirmation_token, recovery_token, email_change_token_new, email_change)
  VALUES
    (u_owner, 'authenticated', 'authenticated', 'c06_o_' || u_owner::text || '@test.local', crypt('x', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000', '', '', '', ''),
    (u_a, 'authenticated', 'authenticated', 'c06_a_' || u_a::text || '@test.local', crypt('x', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000', '', '', '', ''),
    (u_b, 'authenticated', 'authenticated', 'c06_b_' || u_b::text || '@test.local', crypt('x', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000', '', '', '', ''),
    (u_other, 'authenticated', 'authenticated', 'c06_x_' || u_other::text || '@test.local', crypt('x', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000', '', '', '', ''),
    (u_prov, 'authenticated', 'authenticated', 'c06_p_' || u_prov::text || '@test.local', crypt('x', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000', '', '', '', '');

  INSERT INTO public.profiles (id, role) VALUES
    (u_owner, 'client'), (u_a, 'client'), (u_b, 'client'), (u_other, 'client'), (u_prov, 'provider');

  INSERT INTO public.projects (owner_id, assigned_provider_id, funder_ids, status, title)
  VALUES (u_owner, u_prov, ARRAY[]::uuid[], 'open', 'c06-fund')
  RETURNING id INTO v_project;

  -- ---- 0 co-funders: request + intent ----
  PERFORM set_config('request.jwt.claim.sub', u_owner::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM public.rpc_create_funding_request(v_project, 100000, r0);
  v_res := public.c06_test_create_intent(v_project, 100000, 'momo', r0);
  v_pay := (v_res->>'payment_id')::uuid;
  IF v_pay IS NULL THEN
    RAISE EXCEPTION 'C06 FAIL: 0-cofunder intent create';
  END IF;

  -- Idempotent retry
  v_res := public.c06_test_create_intent(v_project, 100000, 'momo', r0);
  IF (v_res->>'idempotent_replay')::boolean IS DISTINCT FROM true
     OR (v_res->>'payment_id')::uuid IS DISTINCT FROM v_pay THEN
    RAISE EXCEPTION 'C06 FAIL: idempotent intent retry';
  END IF;

  -- Amount mismatch
  BEGIN
    PERFORM public.c06_test_create_intent(v_project, 100001, 'momo', r0);
    RAISE EXCEPTION 'C06 FAIL: amount mismatch should DENY';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err ILIKE '%C06 FAIL%' THEN RAISE; END IF;
  END;

  -- PSP mismatch
  BEGIN
    PERFORM public.c06_test_create_intent(v_project, 100000, 'stripe', r0);
    RAISE EXCEPTION 'C06 FAIL: psp mismatch should DENY';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err ILIKE '%C06 FAIL%' THEN RAISE; END IF;
  END;

  -- Different requester
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', u_other::text, true);
    PERFORM public.c06_test_create_intent(v_project, 100000, 'momo', r0);
    RAISE EXCEPTION 'C06 FAIL: other requester should DENY';
  EXCEPTION WHEN raise_exception OR insufficient_privilege THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err ILIKE '%C06 FAIL%' THEN RAISE; END IF;
  END;

  -- Client cannot mark succeeded
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', u_owner::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    PERFORM public.rpc_mark_payment_succeeded(v_pay, 'momo_ref_1', 100000, 'XAF', 'momo');
    RAISE EXCEPTION 'C06 FAIL: client mark succeeded should DENY';
  EXCEPTION WHEN raise_exception OR insufficient_privilege THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err ILIKE '%C06 FAIL%' THEN RAISE; END IF;
  END;

  -- Pending payment cannot post
  BEGIN
    PERFORM set_config('request.jwt.claim.role', 'service_role', true);
    PERFORM public.rpc_post_escrow_funding(v_pay);
    RAISE EXCEPTION 'C06 FAIL: post before succeeded should DENY';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err ILIKE '%C06 FAIL%' THEN RAISE; END IF;
  END;

  -- Service attach + mark succeeded
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM public.rpc_attach_payment_psp_ref(v_pay, 'momo_ref_1');
  -- overwrite different ref DENY
  BEGIN
    PERFORM public.rpc_attach_payment_psp_ref(v_pay, 'momo_ref_OTHER');
    RAISE EXCEPTION 'C06 FAIL: psp_ref overwrite should DENY';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err ILIKE '%C06 FAIL%' THEN RAISE; END IF;
  END;
  -- same ref idempotent
  v_res := public.rpc_attach_payment_psp_ref(v_pay, 'momo_ref_1');
  IF (v_res->>'idempotent_replay')::boolean IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'C06 FAIL: identical psp_ref attach should be idempotent';
  END IF;

  PERFORM public.rpc_mark_payment_succeeded(v_pay, 'momo_ref_1', 100000, 'XAF', 'momo');
  -- idempotent mark
  PERFORM public.rpc_mark_payment_succeeded(v_pay, 'momo_ref_1', 100000, 'XAF', 'momo');

  -- Post funding (gross)
  v_res := public.rpc_post_escrow_funding(v_pay);
  v_journal := (v_res->>'journal_id')::uuid;
  IF v_journal IS NULL THEN
    RAISE EXCEPTION 'C06 FAIL: journal missing';
  END IF;
  IF (v_res->>'platform_fee_xaf')::bigint IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'C06 FAIL: platform fee must be 0 (deferred C04)';
  END IF;
  IF (v_res->>'project_escrow_credit_xaf')::bigint IS DISTINCT FROM 100000 THEN
    RAISE EXCEPTION 'C06 FAIL: escrow credit must equal gross';
  END IF;

  SELECT count(*)::int INTO v_jcount FROM ledger_journals WHERE id = v_journal;
  IF v_jcount <> 1 THEN
    RAISE EXCEPTION 'C06 FAIL: expected 1 journal row';
  END IF;

  SELECT balance_xaf INTO v_escrow
  FROM ledger_accounts
  WHERE purpose = 'project_escrow' AND owner_type = 'project' AND owner_id = v_project;
  IF v_escrow IS DISTINCT FROM 100000 THEN
    RAISE EXCEPTION 'C06 FAIL: project_escrow balance %, expected 100000', v_escrow;
  END IF;

  -- Retry post → same journal, no double credit
  v_res := public.rpc_post_escrow_funding(v_pay);
  IF (v_res->>'journal_id')::uuid IS DISTINCT FROM v_journal THEN
    RAISE EXCEPTION 'C06 FAIL: post retry must return same journal';
  END IF;
  IF (SELECT count(*) FROM ledger_journals WHERE idempotency_key = 'escrow_funding:' || v_pay::text) <> 1 THEN
    RAISE EXCEPTION 'C06 FAIL: duplicate journals for payment';
  END IF;
  SELECT balance_xaf INTO v_escrow
  FROM ledger_accounts
  WHERE purpose = 'project_escrow' AND owner_type = 'project' AND owner_id = v_project;
  IF v_escrow IS DISTINCT FROM 100000 THEN
    RAISE EXCEPTION 'C06 FAIL: double post changed balance';
  END IF;

  -- Webhook event dedup (provider-namespaced)
  v_res := public.rpc_begin_psp_webhook_event('momo', 'EVT-1', 'payment.succeeded', 'momo_ref_1');
  IF (v_res->>'is_new')::boolean IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'C06 FAIL: first momo EVT-1 should be new';
  END IF;
  v_res := public.rpc_begin_psp_webhook_event('momo', 'EVT-1', 'payment.succeeded', 'momo_ref_1');
  IF (v_res->>'is_new')::boolean IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'C06 FAIL: duplicate momo EVT-1 should not be new';
  END IF;
  -- Cross-provider same raw ID is independent
  v_res := public.rpc_begin_psp_webhook_event('orange', 'EVT-1', 'payment.succeeded', 'orange_ref_1');
  IF (v_res->>'is_new')::boolean IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'C06 FAIL: orange EVT-1 must be independent of momo EVT-1';
  END IF;
  IF (SELECT count(*) FROM ledger_posted_events WHERE psp_event_id IN ('momo:EVT-1', 'orange:EVT-1')) <> 2 THEN
    RAISE EXCEPTION 'C06 FAIL: expected 2 namespaced event rows';
  END IF;

  -- Cross-provider same raw psp_ref allowed on different payments
  -- (covered after second payment gets a ref under orange with same string)
  -- ---- 1 co-funder ----
  PERFORM set_config('request.jwt.claim.sub', u_owner::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM public.rpc_set_project_funders(v_project, ARRAY[u_a]);
  PERFORM public.rpc_create_funding_request(v_project, 50000, r1);
  BEGIN
    PERFORM public.c06_test_create_intent(v_project, 50000, 'momo', r1);
    RAISE EXCEPTION 'C06 FAIL: 1-cofunder missing approval must DENY';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err ILIKE '%C06 FAIL%' THEN RAISE; END IF;
  END;
  PERFORM set_config('request.jwt.claim.sub', u_a::text, true);
  PERFORM public.rpc_approve_funding_request(r1);
  PERFORM set_config('request.jwt.claim.sub', u_owner::text, true);
  v_res := public.c06_test_create_intent(v_project, 50000, 'orange', r1);
  v_pay2 := (v_res->>'payment_id')::uuid;

  -- Same raw psp_ref across providers must NOT collide
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM public.rpc_attach_payment_psp_ref(v_pay2, 'momo_ref_1');
  IF (SELECT count(*) FROM payments WHERE psp_ref = 'momo_ref_1') <> 2 THEN
    RAISE EXCEPTION 'C06 FAIL: cross-provider identical psp_ref must be allowed';
  END IF;
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  -- ---- 2 co-funders ----
  PERFORM public.rpc_set_project_funders(v_project, ARRAY[u_a, u_b]);
  PERFORM public.rpc_create_funding_request(v_project, 75000, r2);
  BEGIN
    PERFORM public.c06_test_create_intent(v_project, 75000, 'momo', r2);
    RAISE EXCEPTION 'C06 FAIL: 2-cofunder missing approvals must DENY';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err ILIKE '%C06 FAIL%' THEN RAISE; END IF;
  END;
  PERFORM set_config('request.jwt.claim.sub', u_a::text, true);
  PERFORM public.rpc_approve_funding_request(r2);
  PERFORM set_config('request.jwt.claim.sub', u_b::text, true);
  PERFORM public.rpc_approve_funding_request(r2);
  PERFORM set_config('request.jwt.claim.sub', u_owner::text, true);
  v_res := public.c06_test_create_intent(v_project, 75000, 'momo', r2);
  IF (v_res->>'payment_id') IS NULL THEN
    RAISE EXCEPTION 'C06 FAIL: 2-cofunder intent after approvals';
  END IF;

  -- No release coupling
  IF to_regprocedure('public.rpc_release_milestone(uuid)') IS NOT NULL THEN
    RAISE EXCEPTION 'C06 FAIL: release RPC must remain absent';
  END IF;

  -- No insurance fee strings in post result path already checked
  SELECT status INTO v_status FROM payments WHERE id = v_pay;
  IF v_status IS DISTINCT FROM 'succeeded' THEN
    RAISE EXCEPTION 'C06 FAIL: payment status after post %', v_status;
  END IF;

  RAISE NOTICE 'c06_phase3b_funding.sql: PASS';
END;
$$;

DROP FUNCTION IF EXISTS public.c06_test_create_intent(uuid, bigint, text, uuid);

SELECT 'c06_phase3b_funding.sql: PASS' AS result;
