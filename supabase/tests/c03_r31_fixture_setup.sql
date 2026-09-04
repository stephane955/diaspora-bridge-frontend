-- =============================================================================
-- C03-R3.1 fixture for two-session lock-order concurrency (disposable local)
-- Writes public.c03_r31_fixture for cross-session reads.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.c03_r31_fixture (
  k text PRIMARY KEY,
  v text NOT NULL
);
TRUNCATE public.c03_r31_fixture;

DO $$
DECLARE
  u_owner uuid := gen_random_uuid();
  u_cof uuid := gen_random_uuid();
  u_prov uuid := gen_random_uuid();
  v_project uuid;
  r0 uuid := gen_random_uuid();
  r1 uuid := gen_random_uuid();
  r2 uuid := gen_random_uuid();
  r3 uuid := gen_random_uuid();
  v_q uuid;
  v_q3 uuid;
  v_res jsonb;
BEGIN
  INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, instance_id, confirmation_token, recovery_token, email_change_token_new, email_change)
  VALUES
    (u_owner, 'authenticated', 'authenticated', 'r31_o_' || u_owner::text || '@test.local', crypt('x', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000', '', '', '', ''),
    (u_cof, 'authenticated', 'authenticated', 'r31_c_' || u_cof::text || '@test.local', crypt('x', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000', '', '', '', ''),
    (u_prov, 'authenticated', 'authenticated', 'r31_p_' || u_prov::text || '@test.local', crypt('x', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000', '', '', '', '');

  INSERT INTO public.profiles (id, role) VALUES
    (u_owner, 'client'), (u_cof, 'client'), (u_prov, 'provider');

  INSERT INTO public.projects (owner_id, assigned_provider_id, funder_ids, status, title)
  VALUES (u_owner, u_prov, ARRAY[u_cof]::uuid[], 'open', 'c03-r31')
  RETURNING id INTO v_project;

  -- r0: pending + usable quote (forced record vs wrapper overlap)
  PERFORM set_config('request.jwt.claim.sub', u_owner::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM public.rpc_create_funding_request(v_project, 500000, r0);
  PERFORM set_config('request.jwt.claim.sub', u_cof::text, true);
  PERFORM public.rpc_approve_funding_request(r0);
  v_res := public.rpc_record_fx_quote(
    r0, 'EUR', 76200, 'fixture_fx', 'R31-Q0',
    clock_timestamp() + interval '1 hour', NULL, gen_random_uuid()
  );
  v_q := (v_res->>'fx_quote_id')::uuid;

  -- r1: concurrent quote replacement (pending, no payment)
  PERFORM set_config('request.jwt.claim.sub', u_owner::text, true);
  PERFORM public.rpc_create_funding_request(v_project, 200000, r1);
  PERFORM set_config('request.jwt.claim.sub', u_cof::text, true);
  PERFORM public.rpc_approve_funding_request(r1);

  -- r2: failed payment for success-race
  PERFORM set_config('request.jwt.claim.sub', u_owner::text, true);
  PERFORM public.rpc_create_funding_request(v_project, 100000, r2);
  PERFORM set_config('request.jwt.claim.sub', u_cof::text, true);
  PERFORM public.rpc_approve_funding_request(r2);
  v_res := public.rpc_record_fx_quote(
    r2, 'EUR', 15000, 'fixture_fx', 'R31-Q2INIT',
    clock_timestamp() + interval '1 hour', NULL, gen_random_uuid()
  );
  PERFORM set_config('request.jwt.claim.sub', u_owner::text, true);
  v_res := public.rpc_create_cross_border_payment_intent(
    (v_res->>'fx_quote_id')::uuid, 'stripe'
  );
  UPDATE public.payments
  SET status = 'failed'
  WHERE id = (v_res->>'payment_id')::uuid;

  -- r3: concurrent initial wrappers (same quote)
  PERFORM set_config('request.jwt.claim.sub', u_owner::text, true);
  PERFORM public.rpc_create_funding_request(v_project, 300000, r3);
  PERFORM set_config('request.jwt.claim.sub', u_cof::text, true);
  PERFORM public.rpc_approve_funding_request(r3);
  v_res := public.rpc_record_fx_quote(
    r3, 'EUR', 45000, 'fixture_fx', 'R31-Q3',
    clock_timestamp() + interval '1 hour', NULL, gen_random_uuid()
  );
  v_q3 := (v_res->>'fx_quote_id')::uuid;

  INSERT INTO public.c03_r31_fixture(k, v) VALUES
    ('owner', u_owner::text),
    ('r0', r0::text),
    ('q0', v_q::text),
    ('r1', r1::text),
    ('r2', r2::text),
    ('r3', r3::text),
    ('q3', v_q3::text);
END;
$$;
