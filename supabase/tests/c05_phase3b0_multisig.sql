-- =============================================================================
-- C05-R2 request-scoped multisig tests
-- Apply future C05 SQL on disposable LOCAL DB first, then run this file.
-- Does NOT require pgtap. Prefer full `supabase db reset --local` after.
-- =============================================================================

DO $$
DECLARE
  u_owner uuid := gen_random_uuid();
  u_a uuid := gen_random_uuid();
  u_b uuid := gen_random_uuid();
  u_c uuid := gen_random_uuid();
  u_prov uuid := gen_random_uuid();
  v_project uuid;
  v_project2 uuid;
  r0 uuid := gen_random_uuid();
  r1 uuid := gen_random_uuid();
  r2 uuid := gen_random_uuid();
  r3 uuid := gen_random_uuid();
  r4 uuid := gen_random_uuid();
  r5 uuid := gen_random_uuid();
  v_ok boolean;
  v_at timestamptz;
  v_journals int;
  v_err text;
  v_status text;
BEGIN
  IF to_regclass('public.escrow_funding_requests') IS NULL THEN
    RAISE EXCEPTION 'C05 FAIL: escrow_funding_requests missing — apply future C05 SQL first';
  END IF;
  IF to_regclass('public.escrow_funder_approvals') IS NULL THEN
    RAISE EXCEPTION 'C05 FAIL: escrow_funder_approvals missing';
  END IF;
  IF to_regprocedure('public.escrow_all_funders_approved_for_request(uuid)') IS NULL THEN
    RAISE EXCEPTION 'C05 FAIL: escrow_all_funders_approved_for_request missing';
  END IF;
  IF to_regprocedure('public.escrow_all_funders_approved(uuid)') IS NOT NULL THEN
    RAISE EXCEPTION 'C05 FAIL: legacy project-scoped escrow_all_funders_approved must be dropped';
  END IF;
  -- payments may exist once C06 is in the active chain; C05-only absence is not required here

  INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, instance_id, confirmation_token, recovery_token, email_change_token_new, email_change)
  VALUES
    (u_owner, 'authenticated', 'authenticated', 'c05r2_o_' || u_owner::text || '@test.local', crypt('x', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000', '', '', '', ''),
    (u_a, 'authenticated', 'authenticated', 'c05r2_a_' || u_a::text || '@test.local', crypt('x', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000', '', '', '', ''),
    (u_b, 'authenticated', 'authenticated', 'c05r2_b_' || u_b::text || '@test.local', crypt('x', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000', '', '', '', ''),
    (u_c, 'authenticated', 'authenticated', 'c05r2_c_' || u_c::text || '@test.local', crypt('x', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000', '', '', '', ''),
    (u_prov, 'authenticated', 'authenticated', 'c05r2_p_' || u_prov::text || '@test.local', crypt('x', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000', '', '', '', '');

  INSERT INTO public.profiles (id, role) VALUES
    (u_owner, 'client'), (u_a, 'client'), (u_b, 'client'), (u_c, 'client'), (u_prov, 'provider');

  INSERT INTO public.projects (owner_id, assigned_provider_id, funder_ids, status, title)
  VALUES (u_owner, u_prov, ARRAY[]::uuid[], 'open', 'c05-r2-a')
  RETURNING id INTO v_project;

  INSERT INTO public.projects (owner_id, assigned_provider_id, funder_ids, status, title)
  VALUES (u_owner, u_prov, ARRAY[]::uuid[], 'open', 'c05-r2-b')
  RETURNING id INTO v_project2;

  -- ---- 0 co-funders: helper true; request create by owner OK ----
  PERFORM set_config('request.jwt.claim.sub', u_owner::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM public.rpc_create_funding_request(v_project, 100000, r0);
  IF NOT public.escrow_all_funders_approved_for_request(r0) THEN
    RAISE EXCEPTION 'C05 FAIL: 0 co-funders must not require approvals';
  END IF;

  -- ---- 1 co-funder missing approval ----
  PERFORM set_config('diaspora.c05_allow_funder_ids_write', 'on', true);
  UPDATE public.projects SET funder_ids = ARRAY[u_a] WHERE id = v_project;
  PERFORM set_config('diaspora.c05_allow_funder_ids_write', '', true);

  PERFORM public.rpc_create_funding_request(v_project, 100000, r1);
  IF public.escrow_all_funders_approved_for_request(r1) THEN
    RAISE EXCEPTION 'C05 FAIL: 1 co-funder missing approval must be false';
  END IF;

  -- Observer/provider cannot approve
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', u_prov::text, true);
    PERFORM public.rpc_approve_funding_request(r1);
    RAISE EXCEPTION 'C05 FAIL: provider non-funder approve should DENY';
  EXCEPTION WHEN insufficient_privilege OR raise_exception THEN NULL;
  END;

  BEGIN
    PERFORM set_config('request.jwt.claim.sub', u_b::text, true);
    PERFORM public.rpc_approve_funding_request(r1);
    RAISE EXCEPTION 'C05 FAIL: non-roster user approve should DENY';
  EXCEPTION WHEN insufficient_privilege OR raise_exception THEN NULL;
  END;

  -- Approve as other funder attempted by spoofing — RPC uses auth.uid()
  PERFORM set_config('request.jwt.claim.sub', u_a::text, true);
  PERFORM public.rpc_approve_funding_request(r1);
  IF NOT public.escrow_all_funders_approved_for_request(r1) THEN
    RAISE EXCEPTION 'C05 FAIL: 1 co-funder approved must ALLOW helper';
  END IF;

  -- Refresh pending → server time
  SELECT approved_at INTO v_at FROM public.escrow_funder_approvals
  WHERE funding_request_id = r1 AND funder_id = u_a;
  PERFORM public.rpc_approve_funding_request(r1);
  IF (SELECT approved_at FROM public.escrow_funder_approvals WHERE funding_request_id = r1 AND funder_id = u_a) < v_at THEN
    RAISE EXCEPTION 'C05 FAIL: refresh should advance or keep server approved_at';
  END IF;

  -- ---- 2 co-funders ----
  PERFORM set_config('request.jwt.claim.sub', u_owner::text, true);
  PERFORM public.rpc_set_project_funders(v_project, ARRAY[u_a, u_b]);
  PERFORM public.rpc_create_funding_request(v_project, 250000, r2);

  IF public.escrow_all_funders_approved_for_request(r2) THEN
    RAISE EXCEPTION 'C05 FAIL: 2 co-funders zero approvals must DENY';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', u_a::text, true);
  PERFORM public.rpc_approve_funding_request(r2);
  IF public.escrow_all_funders_approved_for_request(r2) THEN
    RAISE EXCEPTION 'C05 FAIL: 2 co-funders one missing must DENY';
  END IF;

  -- Requester-as-co-funder still needs explicit approval (A already approved; B missing)
  PERFORM set_config('request.jwt.claim.sub', u_a::text, true);
  -- create request by A
  PERFORM public.rpc_create_funding_request(v_project, 300000, r3);
  PERFORM public.rpc_approve_funding_request(r3);
  IF public.escrow_all_funders_approved_for_request(r3) THEN
    RAISE EXCEPTION 'C05 FAIL: requester approval alone must not satisfy N-of-N';
  END IF;
  PERFORM set_config('request.jwt.claim.sub', u_b::text, true);
  PERFORM public.rpc_approve_funding_request(r3);
  IF NOT public.escrow_all_funders_approved_for_request(r3) THEN
    RAISE EXCEPTION 'C05 FAIL: A+B approvals must ALLOW';
  END IF;

  -- Cross-request: approvals on r3 must not authorize r2 (still only A)
  IF public.escrow_all_funders_approved_for_request(r2) THEN
    RAISE EXCEPTION 'C05 FAIL: cross-request replay must DENY';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', u_b::text, true);
  PERFORM public.rpc_approve_funding_request(r2);
  IF NOT public.escrow_all_funders_approved_for_request(r2) THEN
    RAISE EXCEPTION 'C05 FAIL: both approve r2 must ALLOW';
  END IF;

  -- Same request ID different amount → DENY on create
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', u_owner::text, true);
    PERFORM public.rpc_create_funding_request(v_project, 999999, r2);
    RAISE EXCEPTION 'C05 FAIL: same request ID different amount should DENY';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err ILIKE '%C05 FAIL%' THEN RAISE; END IF;
  END;

  -- Same request ID different requester → DENY
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', u_a::text, true);
    PERFORM public.rpc_create_funding_request(v_project, 250000, r2);
    RAISE EXCEPTION 'C05 FAIL: same request ID different requester should DENY';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err ILIKE '%C05 FAIL%' THEN RAISE; END IF;
  END;

  -- Different project → DENY
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', u_owner::text, true);
    PERFORM public.rpc_create_funding_request(v_project2, 250000, r2);
    RAISE EXCEPTION 'C05 FAIL: same request ID different project should DENY';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err ILIKE '%C05 FAIL%' THEN RAISE; END IF;
  END;

  -- 72h expiry
  ALTER TABLE public.escrow_funder_approvals DISABLE TRIGGER escrow_funder_approvals_before_write_trg;
  UPDATE public.escrow_funder_approvals
    SET approved_at = clock_timestamp() - interval '72 hours' - interval '1 second'
    WHERE funding_request_id = r2 AND funder_id = u_a;
  ALTER TABLE public.escrow_funder_approvals ENABLE TRIGGER escrow_funder_approvals_before_write_trg;
  IF public.escrow_all_funders_approved_for_request(r2) THEN
    RAISE EXCEPTION 'C05 FAIL: expired approval must DENY';
  END IF;

  ALTER TABLE public.escrow_funder_approvals DISABLE TRIGGER escrow_funder_approvals_before_write_trg;
  UPDATE public.escrow_funder_approvals
    SET approved_at = clock_timestamp() - interval '71 hours 59 minutes 59 seconds'
    WHERE funding_request_id = r2 AND funder_id = u_a;
  ALTER TABLE public.escrow_funder_approvals ENABLE TRIGGER escrow_funder_approvals_before_write_trg;
  IF NOT public.escrow_all_funders_approved_for_request(r2) THEN
    RAISE EXCEPTION 'C05 FAIL: within 72h must ALLOW';
  END IF;

  -- Exact 72h boundary (>=): set just inside the window to avoid statement clock skew
  -- (approved_at = now()-72h becomes invalid by the next clock_timestamp() call)
  ALTER TABLE public.escrow_funder_approvals DISABLE TRIGGER escrow_funder_approvals_before_write_trg;
  UPDATE public.escrow_funder_approvals
    SET approved_at = clock_timestamp() - interval '72 hours' + interval '100 milliseconds'
    WHERE funding_request_id = r2 AND funder_id = u_a;
  ALTER TABLE public.escrow_funder_approvals ENABLE TRIGGER escrow_funder_approvals_before_write_trg;
  IF NOT public.escrow_all_funders_approved_for_request(r2) THEN
    RAISE EXCEPTION 'C05 FAIL: approval at >= now()-72h boundary must ALLOW';
  END IF;

  -- Roster add before consume → new approval required
  PERFORM set_config('request.jwt.claim.sub', u_owner::text, true);
  PERFORM public.rpc_set_project_funders(v_project, ARRAY[u_a, u_b, u_c]);
  IF public.escrow_all_funders_approved_for_request(r2) THEN
    RAISE EXCEPTION 'C05 FAIL: roster add without C approval must DENY';
  END IF;

  -- Roster shrink blocked
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', u_owner::text, true);
    PERFORM public.rpc_set_project_funders(v_project, ARRAY[u_a]);
    RAISE EXCEPTION 'C05 FAIL: roster shrink should DENY';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err ILIKE '%C05 FAIL%' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM set_config('diaspora.c05_allow_funder_ids_write', '', true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    UPDATE public.projects SET funder_ids = ARRAY[u_a] WHERE id = v_project;
    RAISE EXCEPTION 'C05 FAIL: client funder_ids update should be blocked';
  EXCEPTION WHEN insufficient_privilege OR raise_exception THEN NULL;
  END;

  -- Duplicate funders safe
  PERFORM set_config('diaspora.c05_allow_funder_ids_write', 'on', true);
  UPDATE public.projects SET funder_ids = ARRAY[u_a, u_a, u_b, u_c] WHERE id = v_project;
  PERFORM set_config('diaspora.c05_allow_funder_ids_write', '', true);
  IF cardinality((SELECT funder_ids FROM projects WHERE id = v_project)) <> 3 THEN
    RAISE EXCEPTION 'C05 FAIL: duplicate funders must normalize to distinct';
  END IF;

  -- Revocation before consumption
  PERFORM set_config('request.jwt.claim.sub', u_a::text, true);
  PERFORM public.rpc_approve_funding_request(r2);
  PERFORM set_config('request.jwt.claim.sub', u_b::text, true);
  PERFORM public.rpc_approve_funding_request(r2);
  PERFORM set_config('request.jwt.claim.sub', u_c::text, true);
  PERFORM public.rpc_approve_funding_request(r2);
  IF NOT public.escrow_all_funders_approved_for_request(r2) THEN
    RAISE EXCEPTION 'C05 FAIL: A+B+C should ALLOW before revoke';
  END IF;
  PERFORM set_config('request.jwt.claim.sub', u_b::text, true);
  PERFORM public.rpc_revoke_funding_approval(r2);
  IF public.escrow_all_funders_approved_for_request(r2) THEN
    RAISE EXCEPTION 'C05 FAIL: revoked approval must DENY';
  END IF;

  -- Direct table mutation denied for authenticated (GRANT)
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', u_a::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO public.escrow_funder_approvals (funding_request_id, funder_id)
    VALUES (r2, u_a);
    RESET ROLE;
    RAISE EXCEPTION 'C05 FAIL: direct INSERT approvals should be denied';
  EXCEPTION
    WHEN insufficient_privilege OR raise_exception THEN
      RESET ROLE;
    WHEN OTHERS THEN
      RESET ROLE;
      IF SQLERRM ILIKE '%C05 FAIL%' THEN RAISE; END IF;
      -- permission denied / RLS
      NULL;
  END;

  -- Timestamp spoof overwritten if service path inserts (owner path)
  INSERT INTO public.escrow_funder_approvals (funding_request_id, funder_id, approved_at)
  VALUES (r2, u_b, clock_timestamp() + interval '10 days')
  ON CONFLICT (funding_request_id, funder_id) DO UPDATE SET approved_at = EXCLUDED.approved_at;
  SELECT approved_at INTO v_at FROM public.escrow_funder_approvals WHERE funding_request_id = r2 AND funder_id = u_b;
  IF v_at > clock_timestamp() + interval '1 minute' THEN
    RAISE EXCEPTION 'C05 FAIL: future approved_at persisted';
  END IF;

  -- Duplicate approval unique
  BEGIN
    INSERT INTO public.escrow_funder_approvals (funding_request_id, funder_id) VALUES (r2, u_b);
    RAISE EXCEPTION 'C05 FAIL: duplicate approval should violate unique';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  -- Mark consumed → refresh DENY
  PERFORM public.escrow_mark_funding_request_consumed(r2);
  SELECT status INTO v_status FROM public.escrow_funding_requests WHERE id = r2;
  IF v_status IS DISTINCT FROM 'consumed' THEN
    RAISE EXCEPTION 'C05 FAIL: mark consumed failed';
  END IF;
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', u_a::text, true);
    PERFORM public.rpc_approve_funding_request(r2);
    RAISE EXCEPTION 'C05 FAIL: approve after consumed should DENY';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err ILIKE '%C05 FAIL%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', u_a::text, true);
    PERFORM public.rpc_revoke_funding_approval(r2);
    RAISE EXCEPTION 'C05 FAIL: revoke after consumed should DENY';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err ILIKE '%C05 FAIL%' THEN RAISE; END IF;
  END;

  -- Immutable amount fields
  BEGIN
    UPDATE public.escrow_funding_requests SET amount_xaf = 1 WHERE id = r1;
    RAISE EXCEPTION 'C05 FAIL: amount mutation should DENY';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err ILIKE '%C05 FAIL%' THEN RAISE; END IF;
  END;

  IF to_regprocedure('public.rpc_release_milestone(uuid)') IS NOT NULL THEN
    RAISE EXCEPTION 'C05 FAIL: rpc_release_milestone must remain absent';
  END IF;
  SELECT count(*)::int INTO v_journals FROM public.ledger_journals;
  IF v_journals <> 0 THEN
    RAISE EXCEPTION 'C05 FAIL: ledger journals must stay 0, got %', v_journals;
  END IF;

  RAISE NOTICE 'c05_phase3b0_multisig.sql: PASS';
END;
$$;

SELECT 'c05_phase3b0_multisig.sql: PASS' AS result;
