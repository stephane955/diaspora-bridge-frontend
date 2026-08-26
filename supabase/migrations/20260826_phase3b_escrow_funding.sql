-- =============================================================================
-- Diaspora Bridge — Phase 3B: Payment intents + escrow funding posting
-- Requires: Phase 1, Phase 3A, Phase 3B.0 multisig surgical migration.
-- All cash movements via ledger_post_journal only.
-- DO NOT apply to live until operator requests.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Extend Phase 3A posting matrix: allow escrow_funding
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ledger_validate_phase3a_matrix(
  p_journal_type public.ledger_journal_type,
  p_lines jsonb
)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_n int;
  v_debit_purposes text[];
  v_credit_purposes text[];
  v_elem jsonb;
  v_purpose text;
  v_debit bigint;
  v_credit bigint;
BEGIN
  IF p_journal_type NOT IN (
    'wallet_credit'::public.ledger_journal_type,
    'wallet_debit'::public.ledger_journal_type,
    'platform_capital_injection'::public.ledger_journal_type,
    'compliance_hold'::public.ledger_journal_type,
    'compliance_release'::public.ledger_journal_type,
    'escrow_funding'::public.ledger_journal_type
  ) THEN
    RAISE EXCEPTION 'journal_type % not enabled for posting', p_journal_type
      USING ERRCODE = '22023';
  END IF;

  IF p_lines IS NULL OR jsonb_typeof(p_lines) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'ledger lines must be a JSON array' USING ERRCODE = '22P02';
  END IF;

  v_n := jsonb_array_length(p_lines);
  IF v_n < 2 THEN
    RAISE EXCEPTION 'journal must have at least two lines' USING ERRCODE = '23514';
  END IF;

  v_debit_purposes := ARRAY[]::text[];
  v_credit_purposes := ARRAY[]::text[];

  FOR v_elem IN SELECT value FROM jsonb_array_elements(p_lines)
  LOOP
    v_purpose := v_elem->>'purpose';
    v_debit := COALESCE((v_elem->>'debit_xaf')::bigint, -1);
    v_credit := COALESCE((v_elem->>'credit_xaf')::bigint, -1);

    IF v_purpose IS NULL THEN
      RAISE EXCEPTION 'line purpose required' USING ERRCODE = '23502';
    END IF;
    IF v_debit < 0 OR v_credit < 0 THEN
      RAISE EXCEPTION 'debit_xaf/credit_xaf must be non-negative bigint' USING ERRCODE = '23514';
    END IF;
    IF NOT (
      (v_debit > 0 AND v_credit = 0) OR (v_credit > 0 AND v_debit = 0)
    ) THEN
      RAISE EXCEPTION 'exactly one of debit_xaf/credit_xaf must be positive' USING ERRCODE = '23514';
    END IF;

    IF v_debit > 0 THEN
      v_debit_purposes := array_append(v_debit_purposes, v_purpose);
    ELSE
      v_credit_purposes := array_append(v_credit_purposes, v_purpose);
    END IF;
  END LOOP;

  CASE p_journal_type
    WHEN 'wallet_credit'::public.ledger_journal_type THEN
      IF NOT (v_credit_purposes <@ ARRAY['user_available'] AND cardinality(v_credit_purposes) >= 1) THEN
        RAISE EXCEPTION 'wallet_credit requires credit to user_available only' USING ERRCODE = '22023';
      END IF;
      IF EXISTS (
        SELECT 1 FROM unnest(v_debit_purposes) d(p)
        WHERE d.p NOT IN ('psp_stripe','psp_momo','psp_orange','platform_credit','platform_suspense')
      ) THEN
        RAISE EXCEPTION 'wallet_credit debit side invalid' USING ERRCODE = '22023';
      END IF;

    WHEN 'wallet_debit'::public.ledger_journal_type THEN
      IF NOT (v_debit_purposes <@ ARRAY['user_available'] AND cardinality(v_debit_purposes) >= 1) THEN
        RAISE EXCEPTION 'wallet_debit requires debit from user_available only' USING ERRCODE = '22023';
      END IF;
      IF EXISTS (
        SELECT 1 FROM unnest(v_credit_purposes) c(p)
        WHERE c.p NOT IN (
          'user_payout_clearing','user_refund_clearing',
          'psp_stripe','psp_momo','psp_orange','platform_suspense'
        )
      ) THEN
        RAISE EXCEPTION 'wallet_debit credit side invalid' USING ERRCODE = '22023';
      END IF;

    WHEN 'platform_capital_injection'::public.ledger_journal_type THEN
      IF v_n IS DISTINCT FROM 2 THEN
        RAISE EXCEPTION 'platform_capital_injection requires exactly two lines' USING ERRCODE = '22023';
      END IF;
      IF cardinality(v_debit_purposes) IS DISTINCT FROM 1
         OR v_debit_purposes[1] NOT IN ('psp_stripe','psp_momo','psp_orange') THEN
        RAISE EXCEPTION 'platform_capital_injection must debit exactly one psp_*' USING ERRCODE = '22023';
      END IF;
      IF cardinality(v_credit_purposes) IS DISTINCT FROM 1
         OR v_credit_purposes[1] IS DISTINCT FROM 'platform_equity' THEN
        RAISE EXCEPTION 'platform_capital_injection must credit platform_equity' USING ERRCODE = '22023';
      END IF;

    WHEN 'compliance_hold'::public.ledger_journal_type THEN
      IF v_n IS DISTINCT FROM 2 THEN
        RAISE EXCEPTION 'compliance_hold requires exactly two lines' USING ERRCODE = '22023';
      END IF;
      IF cardinality(v_debit_purposes) IS DISTINCT FROM 1
         OR v_debit_purposes[1] NOT IN ('psp_stripe','psp_momo','psp_orange') THEN
        RAISE EXCEPTION 'compliance_hold must debit exactly one psp_*' USING ERRCODE = '22023';
      END IF;
      IF cardinality(v_credit_purposes) IS DISTINCT FROM 1
         OR v_credit_purposes[1] IS DISTINCT FROM 'platform_compliance_hold' THEN
        RAISE EXCEPTION 'compliance_hold must credit platform_compliance_hold' USING ERRCODE = '22023';
      END IF;

    WHEN 'compliance_release'::public.ledger_journal_type THEN
      IF v_n IS DISTINCT FROM 2 THEN
        RAISE EXCEPTION 'compliance_release requires exactly two lines' USING ERRCODE = '22023';
      END IF;
      IF cardinality(v_debit_purposes) IS DISTINCT FROM 1
         OR v_debit_purposes[1] IS DISTINCT FROM 'platform_compliance_hold' THEN
        RAISE EXCEPTION 'compliance_release must debit platform_compliance_hold' USING ERRCODE = '22023';
      END IF;
      IF cardinality(v_credit_purposes) IS DISTINCT FROM 1
         OR v_credit_purposes[1] IS DISTINCT FROM 'project_escrow' THEN
        RAISE EXCEPTION 'compliance_release must credit project_escrow' USING ERRCODE = '22023';
      END IF;

    WHEN 'escrow_funding'::public.ledger_journal_type THEN
      -- DR exactly one psp_*; CR project_escrow; optional CR platform_insurance
      IF cardinality(v_debit_purposes) IS DISTINCT FROM 1
         OR v_debit_purposes[1] NOT IN ('psp_stripe','psp_momo','psp_orange') THEN
        RAISE EXCEPTION 'escrow_funding must debit exactly one psp_*' USING ERRCODE = '22023';
      END IF;
      IF NOT ('project_escrow' = ANY (v_credit_purposes)) THEN
        RAISE EXCEPTION 'escrow_funding must credit project_escrow' USING ERRCODE = '22023';
      END IF;
      IF EXISTS (
        SELECT 1 FROM unnest(v_credit_purposes) c(p)
        WHERE c.p NOT IN ('project_escrow','platform_insurance')
      ) THEN
        RAISE EXCEPTION 'escrow_funding credit side invalid' USING ERRCODE = '22023';
      END IF;
      IF v_n NOT IN (2, 3) THEN
        RAISE EXCEPTION 'escrow_funding expects 2 or 3 lines' USING ERRCODE = '22023';
      END IF;

    ELSE
      RAISE EXCEPTION 'unsupported journal_type %', p_journal_type USING ERRCODE = '22023';
  END CASE;
END;
$$;

-- -----------------------------------------------------------------------------
-- payments table
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
  client_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  amount_xaf bigint NOT NULL CHECK (amount_xaf > 0),
  psp_provider text NOT NULL CHECK (psp_provider IN ('stripe', 'momo', 'orange')),
  psp_ref text UNIQUE,
  status text NOT NULL DEFAULT 'requires_action'
    CHECK (status IN ('requires_action', 'processing', 'succeeded', 'failed', 'canceled')),
  client_request_id uuid NOT NULL UNIQUE,
  ledger_journal_id uuid UNIQUE
    REFERENCES public.ledger_journals(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  ledger_posted_at timestamptz
);

-- Fail loud if a pre-existing payments table does not match Phase 3B contract
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'amount_xaf'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'client_request_id'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'ledger_journal_id'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'psp_provider'
  ) THEN
    RAISE EXCEPTION
      'public.payments exists but does not match Phase 3B schema — STOP and reconcile manually'
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS payments_project_id_idx ON public.payments (project_id);
CREATE INDEX IF NOT EXISTS payments_client_id_idx ON public.payments (client_id);
CREATE INDEX IF NOT EXISTS payments_status_idx ON public.payments (status);
CREATE INDEX IF NOT EXISTS payments_psp_ref_idx ON public.payments (psp_ref)
  WHERE psp_ref IS NOT NULL;

CREATE OR REPLACE FUNCTION public.payments_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payments_set_updated_at_trg ON public.payments;
CREATE TRIGGER payments_set_updated_at_trg
  BEFORE UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.payments_set_updated_at();

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payments_select_own" ON public.payments;
CREATE POLICY "payments_select_own" ON public.payments
  FOR SELECT USING (client_id = auth.uid());

-- No INSERT/UPDATE/DELETE policies for authenticated (deny by default)

REVOKE ALL ON TABLE public.payments FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.payments TO authenticated;
GRANT SELECT ON TABLE public.payments TO service_role;
-- Mutations only via SECURITY DEFINER RPCs (table owner)

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ledger_psp_purpose_for_provider(p_psp_provider text)
RETURNS public.ledger_account_purpose
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public
AS $$
  SELECT CASE lower(p_psp_provider)
    WHEN 'stripe' THEN 'psp_stripe'::public.ledger_account_purpose
    WHEN 'momo' THEN 'psp_momo'::public.ledger_account_purpose
    WHEN 'orange' THEN 'psp_orange'::public.ledger_account_purpose
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.payment_caller_may_fund_project(p_project_id uuid, p_uid uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_owner uuid;
  v_funders uuid[];
BEGIN
  IF p_uid IS NULL THEN
    RETURN false;
  END IF;

  SELECT owner_id, COALESCE(funder_ids, ARRAY[]::uuid[])
    INTO v_owner, v_funders
  FROM public.projects
  WHERE id = p_project_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  RETURN (p_uid = v_owner) OR (p_uid = ANY (v_funders));
END;
$$;

-- -----------------------------------------------------------------------------
-- rpc_create_payment_intent
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_create_payment_intent(
  p_project_id uuid,
  p_amount_xaf bigint,
  p_psp_provider text,
  p_client_request_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_provider text := lower(trim(p_psp_provider));
  v_funders uuid[];
  v_payment_id uuid;
  v_row public.payments%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  IF p_client_request_id IS NULL THEN
    RAISE EXCEPTION 'client_request_id required' USING ERRCODE = '23502';
  END IF;

  IF p_amount_xaf IS NULL OR p_amount_xaf <= 0 THEN
    RAISE EXCEPTION 'amount_xaf must be > 0' USING ERRCODE = '23514';
  END IF;

  IF v_provider NOT IN ('stripe', 'momo', 'orange') THEN
    RAISE EXCEPTION 'invalid psp_provider' USING ERRCODE = '23514';
  END IF;

  IF NOT public.payment_caller_may_fund_project(p_project_id, v_uid) THEN
    RAISE EXCEPTION 'not authorized to fund this project' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(funder_ids, ARRAY[]::uuid[])
    INTO v_funders
  FROM public.projects
  WHERE id = p_project_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'project not found' USING ERRCODE = 'P0002';
  END IF;

  -- D2: multi-sig only when funder_ids.length > 1
  IF cardinality(v_funders) > 1 THEN
    IF NOT public.escrow_all_funders_approved(p_project_id) THEN
      RAISE EXCEPTION 'multi-sig approvals incomplete or expired (72h)'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- Idempotent create
  SELECT * INTO v_row
  FROM public.payments
  WHERE client_request_id = p_client_request_id;

  IF FOUND THEN
    IF v_row.client_id IS DISTINCT FROM v_uid
       OR v_row.project_id IS DISTINCT FROM p_project_id THEN
      RAISE EXCEPTION 'client_request_id already used' USING ERRCODE = '42501';
    END IF;
    IF v_row.amount_xaf IS DISTINCT FROM p_amount_xaf
       OR v_row.psp_provider IS DISTINCT FROM v_provider THEN
      RAISE EXCEPTION 'client_request_id reuse with different amount/provider'
        USING ERRCODE = 'P0001';
    END IF;
    RETURN jsonb_build_object(
      'payment_id', v_row.id,
      'status', v_row.status,
      'idempotent_replay', true
    );
  END IF;

  BEGIN
    INSERT INTO public.payments (
      project_id, client_id, amount_xaf, psp_provider, client_request_id, status
    ) VALUES (
      p_project_id, v_uid, p_amount_xaf, v_provider, p_client_request_id, 'requires_action'
    )
    RETURNING id INTO v_payment_id;
  EXCEPTION
    WHEN unique_violation THEN
      SELECT * INTO v_row FROM public.payments WHERE client_request_id = p_client_request_id;
      IF v_row.client_id IS DISTINCT FROM v_uid
         OR v_row.project_id IS DISTINCT FROM p_project_id THEN
        RAISE EXCEPTION 'client_request_id already used' USING ERRCODE = '42501';
      END IF;
      IF v_row.amount_xaf IS DISTINCT FROM p_amount_xaf
         OR v_row.psp_provider IS DISTINCT FROM v_provider THEN
        RAISE EXCEPTION 'client_request_id reuse with different amount/provider'
          USING ERRCODE = 'P0001';
      END IF;
      RETURN jsonb_build_object(
        'payment_id', v_row.id,
        'status', v_row.status,
        'idempotent_replay', true
      );
  END;

  RETURN jsonb_build_object(
    'payment_id', v_payment_id,
    'status', 'requires_action',
    'idempotent_replay', false
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- rpc_attach_payment_psp_ref (service_role / Edge only)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_attach_payment_psp_ref(
  p_payment_id uuid,
  p_psp_ref text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_jwt_role text;
  v_row public.payments%ROWTYPE;
  v_ref text := trim(p_psp_ref);
  v_updated uuid;
BEGIN
  v_jwt_role := NULLIF(current_setting('request.jwt.claim.role', true), '');
  BEGIN
    IF v_jwt_role IS NULL AND to_regprocedure('auth.jwt()') IS NOT NULL THEN
      v_jwt_role := NULLIF(auth.jwt()->>'role', '');
    END IF;
  EXCEPTION
    WHEN undefined_function THEN NULL;
    WHEN OTHERS THEN NULL;
  END;

  IF v_jwt_role IS DISTINCT FROM 'service_role'
     AND NOT EXISTS (
       SELECT 1 FROM pg_roles
       WHERE rolname = SESSION_USER AND (rolsuper OR rolbypassrls
         OR rolname IN ('postgres', 'supabase_admin'))
     ) THEN
    RAISE EXCEPTION 'service_role required' USING ERRCODE = '42501';
  END IF;

  IF v_ref IS NULL OR length(v_ref) = 0 THEN
    RAISE EXCEPTION 'psp_ref required' USING ERRCODE = '23502';
  END IF;

  SELECT * INTO v_row FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_row.status NOT IN ('requires_action', 'processing') THEN
    RAISE EXCEPTION 'payment status % cannot attach psp_ref', v_row.status
      USING ERRCODE = 'P0001';
  END IF;

  -- Provider is immutable: this RPC never accepts/changes psp_provider
  IF v_row.psp_ref IS NOT NULL AND v_row.psp_ref IS DISTINCT FROM v_ref THEN
    RAISE EXCEPTION 'psp_ref already set' USING ERRCODE = 'P0001';
  END IF;

  -- Identical attach is idempotent
  IF v_row.psp_ref IS NOT NULL AND v_row.psp_ref = v_ref THEN
    RETURN jsonb_build_object(
      'payment_id', p_payment_id,
      'psp_ref', v_ref,
      'status', v_row.status,
      'idempotent_replay', true
    );
  END IF;

  BEGIN
    UPDATE public.payments
    SET psp_ref = v_ref,
        status = 'processing'
    WHERE id = p_payment_id
      AND psp_ref IS NULL
    RETURNING id INTO v_updated;

    IF v_updated IS NULL THEN
      -- Lost race: re-read under same lock semantics
      SELECT * INTO v_row FROM public.payments WHERE id = p_payment_id;
      IF v_row.psp_ref IS NOT DISTINCT FROM v_ref THEN
        RETURN jsonb_build_object(
          'payment_id', p_payment_id,
          'psp_ref', v_ref,
          'status', v_row.status,
          'idempotent_replay', true
        );
      END IF;
      RAISE EXCEPTION 'psp_ref already set' USING ERRCODE = 'P0001';
    END IF;
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'psp_ref already used by another payment' USING ERRCODE = '23505';
  END;

  RETURN jsonb_build_object(
    'payment_id', p_payment_id,
    'psp_ref', v_ref,
    'status', 'processing',
    'idempotent_replay', false
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- rpc_post_escrow_funding
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_post_escrow_funding(p_payment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_jwt_role text;
  v_pay public.payments%ROWTYPE;
  v_psp_purpose public.ledger_account_purpose;
  v_fee bigint;
  v_net bigint;
  v_lines jsonb;
  v_res jsonb;
  v_journal_id uuid;
BEGIN
  v_jwt_role := NULLIF(current_setting('request.jwt.claim.role', true), '');
  BEGIN
    IF v_jwt_role IS NULL AND to_regprocedure('auth.jwt()') IS NOT NULL THEN
      v_jwt_role := NULLIF(auth.jwt()->>'role', '');
    END IF;
  EXCEPTION
    WHEN undefined_function THEN NULL;
    WHEN OTHERS THEN NULL;
  END;

  IF v_jwt_role IS DISTINCT FROM 'service_role'
     AND NOT EXISTS (
       SELECT 1 FROM pg_roles
       WHERE rolname = SESSION_USER AND (rolsuper OR rolbypassrls
         OR rolname IN ('postgres', 'supabase_admin'))
     ) THEN
    RAISE EXCEPTION 'service_role required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_pay FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_pay.ledger_journal_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'payment_id', v_pay.id,
      'journal_id', v_pay.ledger_journal_id,
      'idempotent_replay', true,
      'status', v_pay.status
    );
  END IF;

  -- Defensive reconcile: journal may exist from a prior attempt if link write failed mid-flight
  SELECT id INTO v_journal_id
  FROM public.ledger_journals
  WHERE idempotency_key = 'escrow_funding:' || p_payment_id::text;

  IF v_journal_id IS NOT NULL THEN
    UPDATE public.payments
    SET ledger_journal_id = v_journal_id,
        ledger_posted_at = COALESCE(ledger_posted_at, now()),
        status = 'succeeded'
    WHERE id = p_payment_id;
    RETURN jsonb_build_object(
      'payment_id', p_payment_id,
      'journal_id', v_journal_id,
      'idempotent_replay', true,
      'status', 'succeeded'
    );
  END IF;

  IF v_pay.status IS DISTINCT FROM 'succeeded' THEN
    RAISE EXCEPTION 'payment status must be succeeded to post escrow (got %)', v_pay.status
      USING ERRCODE = 'P0001';
  END IF;

  v_psp_purpose := public.ledger_psp_purpose_for_provider(v_pay.psp_provider);
  IF v_psp_purpose IS NULL THEN
    RAISE EXCEPTION 'unknown psp_provider' USING ERRCODE = '23514';
  END IF;

  v_fee := TRUNC(v_pay.amount_xaf * 0.015);
  v_net := v_pay.amount_xaf - v_fee;
  IF v_net <= 0 THEN
    RAISE EXCEPTION 'net escrow must be > 0' USING ERRCODE = '23514';
  END IF;

  v_lines := jsonb_build_array(
    jsonb_build_object(
      'purpose', v_psp_purpose::text,
      'owner_type', 'psp',
      'owner_id', NULL,
      'debit_xaf', v_pay.amount_xaf,
      'credit_xaf', 0,
      'project_id', v_pay.project_id,
      'payment_id', v_pay.id
    ),
    jsonb_build_object(
      'purpose', 'project_escrow',
      'owner_type', 'project',
      'owner_id', v_pay.project_id,
      'debit_xaf', 0,
      'credit_xaf', v_net,
      'project_id', v_pay.project_id,
      'payment_id', v_pay.id
    )
  );

  IF v_fee > 0 THEN
    v_lines := v_lines || jsonb_build_array(
      jsonb_build_object(
        'purpose', 'platform_insurance',
        'owner_type', 'platform',
        'owner_id', NULL,
        'debit_xaf', 0,
        'credit_xaf', v_fee,
        'project_id', v_pay.project_id,
        'payment_id', v_pay.id
      )
    );
  END IF;

  v_res := public.ledger_post_journal(
    'escrow_funding'::public.ledger_journal_type,
    'escrow_funding:' || p_payment_id::text,
    'webhook'::public.ledger_journal_source,
    v_lines,
    v_pay.client_id,
    'payment',
    p_payment_id,
    v_pay.psp_ref,
    'XAF'
  );

  v_journal_id := (v_res->>'journal_id')::uuid;

  UPDATE public.payments
  SET ledger_journal_id = v_journal_id,
      ledger_posted_at = now()
  WHERE id = p_payment_id;

  RETURN jsonb_build_object(
    'payment_id', p_payment_id,
    'journal_id', v_journal_id,
    'idempotent_replay', COALESCE((v_res->>'idempotent_replay')::boolean, false),
    'insurance_fee_xaf', v_fee,
    'net_escrow_xaf', v_net,
    'gross_xaf', v_pay.amount_xaf,
    'status', 'succeeded'
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- Webhook: begin / complete (retry-safe)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_begin_psp_webhook_event(
  p_psp_event_id text,
  p_event_type text,
  p_psp_ref text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_jwt_role text;
  v_id uuid;
  v_status public.ledger_event_status;
  v_journal uuid;
BEGIN
  v_jwt_role := NULLIF(current_setting('request.jwt.claim.role', true), '');
  BEGIN
    IF v_jwt_role IS NULL AND to_regprocedure('auth.jwt()') IS NOT NULL THEN
      v_jwt_role := NULLIF(auth.jwt()->>'role', '');
    END IF;
  EXCEPTION
    WHEN undefined_function THEN NULL;
    WHEN OTHERS THEN NULL;
  END;

  IF v_jwt_role IS DISTINCT FROM 'service_role'
     AND NOT EXISTS (
       SELECT 1 FROM pg_roles
       WHERE rolname = SESSION_USER AND (rolsuper OR rolbypassrls
         OR rolname IN ('postgres', 'supabase_admin'))
     ) THEN
    RAISE EXCEPTION 'service_role required' USING ERRCODE = '42501';
  END IF;

  IF p_psp_event_id IS NULL OR length(trim(p_psp_event_id)) = 0 THEN
    RAISE EXCEPTION 'psp_event_id required' USING ERRCODE = '23502';
  END IF;

  BEGIN
    INSERT INTO public.ledger_posted_events (psp_event_id, event_type, psp_ref, status)
    VALUES (p_psp_event_id, p_event_type, p_psp_ref, 'received')
    RETURNING id INTO v_id;

    RETURN jsonb_build_object(
      'proceed', true,
      'event_id', v_id,
      'status', 'received',
      'is_new', true
    );
  EXCEPTION
    WHEN unique_violation THEN
      SELECT id, status, journal_id
        INTO v_id, v_status, v_journal
      FROM public.ledger_posted_events
      WHERE psp_event_id = p_psp_event_id
      FOR UPDATE;

      IF v_status = 'processed'::public.ledger_event_status THEN
        RETURN jsonb_build_object(
          'proceed', false,
          'event_id', v_id,
          'status', v_status,
          'journal_id', v_journal,
          'is_new', false,
          'reason', 'already_processed'
        );
      END IF;

      -- received / failed / ignored → allow retry
      UPDATE public.ledger_posted_events
      SET event_type = COALESCE(p_event_type, event_type),
          psp_ref = COALESCE(p_psp_ref, psp_ref),
          status = 'received',
          processed_at = NULL
      WHERE id = v_id;

      RETURN jsonb_build_object(
        'proceed', true,
        'event_id', v_id,
        'status', 'received',
        'is_new', false,
        'retry', true
      );
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_complete_psp_webhook_event(
  p_event_id uuid,
  p_status public.ledger_event_status,
  p_journal_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_jwt_role text;
BEGIN
  v_jwt_role := NULLIF(current_setting('request.jwt.claim.role', true), '');
  BEGIN
    IF v_jwt_role IS NULL AND to_regprocedure('auth.jwt()') IS NOT NULL THEN
      v_jwt_role := NULLIF(auth.jwt()->>'role', '');
    END IF;
  EXCEPTION
    WHEN undefined_function THEN NULL;
    WHEN OTHERS THEN NULL;
  END;

  IF v_jwt_role IS DISTINCT FROM 'service_role'
     AND NOT EXISTS (
       SELECT 1 FROM pg_roles
       WHERE rolname = SESSION_USER AND (rolsuper OR rolbypassrls
         OR rolname IN ('postgres', 'supabase_admin'))
     ) THEN
    RAISE EXCEPTION 'service_role required' USING ERRCODE = '42501';
  END IF;

  IF p_status NOT IN (
    'processed'::public.ledger_event_status,
    'failed'::public.ledger_event_status,
    'ignored'::public.ledger_event_status
  ) THEN
    RAISE EXCEPTION 'invalid completion status' USING ERRCODE = '23514';
  END IF;

  UPDATE public.ledger_posted_events
  SET status = p_status,
      journal_id = COALESCE(p_journal_id, journal_id),
      processed_at = CASE
        WHEN p_status = 'processed'::public.ledger_event_status THEN now()
        ELSE processed_at
      END
  WHERE id = p_event_id;
END;
$$;

-- Trusted: mark payment succeeded after Edge reconciled PSP payload vs DB row
CREATE OR REPLACE FUNCTION public.rpc_mark_payment_succeeded(
  p_payment_id uuid,
  p_psp_ref text,
  p_amount_xaf bigint,
  p_currency text,
  p_psp_provider text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_jwt_role text;
  v_pay public.payments%ROWTYPE;
BEGIN
  v_jwt_role := NULLIF(current_setting('request.jwt.claim.role', true), '');
  BEGIN
    IF v_jwt_role IS NULL AND to_regprocedure('auth.jwt()') IS NOT NULL THEN
      v_jwt_role := NULLIF(auth.jwt()->>'role', '');
    END IF;
  EXCEPTION
    WHEN undefined_function THEN NULL;
    WHEN OTHERS THEN NULL;
  END;

  IF v_jwt_role IS DISTINCT FROM 'service_role'
     AND NOT EXISTS (
       SELECT 1 FROM pg_roles
       WHERE rolname = SESSION_USER AND (rolsuper OR rolbypassrls
         OR rolname IN ('postgres', 'supabase_admin'))
     ) THEN
    RAISE EXCEPTION 'service_role required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_pay FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment not found' USING ERRCODE = 'P0002';
  END IF;

  IF lower(COALESCE(p_currency, '')) IS DISTINCT FROM 'xaf' THEN
    RAISE EXCEPTION 'currency mismatch: expected XAF' USING ERRCODE = 'P0001';
  END IF;

  IF p_amount_xaf IS DISTINCT FROM v_pay.amount_xaf THEN
    RAISE EXCEPTION 'amount mismatch: payment % vs psp %', v_pay.amount_xaf, p_amount_xaf
      USING ERRCODE = 'P0001';
  END IF;

  IF lower(p_psp_provider) IS DISTINCT FROM v_pay.psp_provider THEN
    RAISE EXCEPTION 'psp_provider mismatch' USING ERRCODE = 'P0001';
  END IF;

  IF v_pay.psp_ref IS NULL OR v_pay.psp_ref IS DISTINCT FROM p_psp_ref THEN
    RAISE EXCEPTION 'psp_ref mismatch' USING ERRCODE = 'P0001';
  END IF;

  IF v_pay.status IN ('canceled', 'failed') THEN
    RAISE EXCEPTION 'payment in terminal status %', v_pay.status USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.payments
  SET status = 'succeeded'
  WHERE id = p_payment_id
    AND status IS DISTINCT FROM 'succeeded';

  RETURN jsonb_build_object('payment_id', p_payment_id, 'status', 'succeeded');
END;
$$;

-- -----------------------------------------------------------------------------
-- Privileges
-- -----------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.ledger_psp_purpose_for_provider(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.payment_caller_may_fund_project(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rpc_create_payment_intent(uuid, bigint, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_attach_payment_psp_ref(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rpc_post_escrow_funding(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rpc_begin_psp_webhook_event(text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rpc_complete_psp_webhook_event(uuid, public.ledger_event_status, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rpc_mark_payment_succeeded(uuid, text, bigint, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.payments_set_updated_at() FROM PUBLIC, anon, authenticated;

-- Table privileges: clients SELECT only; no direct DML (RLS has no write policies either)
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.payments FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.payments TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.rpc_create_payment_intent(uuid, bigint, text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_attach_payment_psp_ref(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_post_escrow_funding(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_begin_psp_webhook_event(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_complete_psp_webhook_event(uuid, public.ledger_event_status, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_mark_payment_succeeded(uuid, text, bigint, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.payment_caller_may_fund_project(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.ledger_psp_purpose_for_provider(text) TO service_role;

COMMENT ON FUNCTION public.rpc_create_payment_intent IS
  'Phase 3B: create funding intent; auth.uid() authority; D2 multi-sig when funder_ids > 1.';
COMMENT ON FUNCTION public.rpc_post_escrow_funding IS
  'Phase 3B: post escrow_funding via ledger_post_journal for succeeded payments only.';
COMMENT ON TABLE public.payments IS
  'Phase 3B PSP funding intents. Cash only after webhook success + ledger_post_journal.';
