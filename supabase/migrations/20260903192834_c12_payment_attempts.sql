-- =============================================================================
-- C12 FUTURE CANDIDATE — payment_attempts + C03/C06 additive compatibility
-- File: supabase/future_migrations/c12_payment_attempts.sql
--
-- NOT an active migration. Do NOT move into supabase/migrations/ without a
-- separate C12 APPLY task.
--
-- Frozen: Decisions #33–#38 (C12-D2). Historical C05/C06/C03 files untouched.
-- LIVE MONEY: NO. No PSP, C11, fees, or EUR funding enablement.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Decision #37 — payments.funding_mode (NULL in-txn, required at COMMIT)
-- -----------------------------------------------------------------------------
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS funding_mode text;

ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_funding_mode_chk;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_funding_mode_chk
  CHECK (funding_mode IS NULL OR funding_mode IN ('xaf_native', 'cross_border'));

CREATE OR REPLACE FUNCTION public.payments_funding_mode_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.funding_mode IS NOT NULL
     AND NEW.funding_mode IS DISTINCT FROM OLD.funding_mode THEN
    RAISE EXCEPTION 'funding_mode is immutable once set'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payments_funding_mode_immutable_trg ON public.payments;
CREATE TRIGGER payments_funding_mode_immutable_trg
  BEFORE UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.payments_funding_mode_immutable();

CREATE OR REPLACE FUNCTION public.payments_funding_mode_required_at_commit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_mode text;
BEGIN
  SELECT funding_mode INTO v_mode FROM public.payments WHERE id = NEW.id;
  IF NOT FOUND OR v_mode IS NULL THEN
    RAISE EXCEPTION 'funding_mode required: unclassified payment cannot commit'
      USING ERRCODE = '23502';
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS payments_funding_mode_required_trg ON public.payments;
CREATE CONSTRAINT TRIGGER payments_funding_mode_required_trg
  AFTER INSERT OR UPDATE OF funding_mode ON public.payments
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.payments_funding_mode_required_at_commit();

REVOKE ALL ON FUNCTION public.payments_funding_mode_immutable() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.payments_funding_mode_required_at_commit() FROM PUBLIC, anon, authenticated;

COMMENT ON COLUMN public.payments.funding_mode IS
  'C12 Decision #37. NULL only inside the creating transaction. Durable values: xaf_native | cross_border. Immutable after set. Deferred constraint forbids committed NULL.';

-- -----------------------------------------------------------------------------
-- payment_attempts
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE RESTRICT,
  attempt_request_id uuid NOT NULL,
  fx_quote_id uuid REFERENCES public.fx_quotes(id) ON DELETE RESTRICT,
  psp_provider text NOT NULL CHECK (psp_provider IN ('stripe', 'momo', 'orange')),
  provider_attempt_ref text,
  status text NOT NULL DEFAULT 'created'
    CHECK (status IN ('created', 'submitted', 'processing', 'succeeded', 'failed', 'canceled')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  submitted_at timestamptz,
  processing_at timestamptz,
  succeeded_at timestamptz,
  failed_at timestamptz,
  canceled_at timestamptz,
  failure_code text,
  failure_detail_safe text,
  CONSTRAINT payment_attempts_attempt_request_id_uidx UNIQUE (attempt_request_id)
);

COMMENT ON TABLE public.payment_attempts IS
  'C12: one real PSP execution attempt. Amounts come from payments / fx_quotes. '
  'payment_attempt.id is the future outbound PSP idempotency identity. '
  'No secrets. LIVE MONEY NO.';

CREATE UNIQUE INDEX IF NOT EXISTS payment_attempts_one_active_per_payment_uidx
  ON public.payment_attempts (payment_id)
  WHERE status IN ('created', 'submitted', 'processing');

CREATE UNIQUE INDEX IF NOT EXISTS payment_attempts_one_succeeded_per_payment_uidx
  ON public.payment_attempts (payment_id)
  WHERE status = 'succeeded';

CREATE UNIQUE INDEX IF NOT EXISTS payment_attempts_provider_ref_uidx
  ON public.payment_attempts (psp_provider, provider_attempt_ref)
  WHERE provider_attempt_ref IS NOT NULL;

CREATE INDEX IF NOT EXISTS payment_attempts_payment_id_idx
  ON public.payment_attempts (payment_id);

CREATE INDEX IF NOT EXISTS payment_attempts_fx_quote_id_idx
  ON public.payment_attempts (fx_quote_id)
  WHERE fx_quote_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.payment_attempts_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payment_attempts_set_updated_at_trg ON public.payment_attempts;
CREATE TRIGGER payment_attempts_set_updated_at_trg
  BEFORE UPDATE ON public.payment_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.payment_attempts_set_updated_at();

CREATE OR REPLACE FUNCTION public.payment_attempts_enforce_immutability()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;
  IF NEW.payment_id IS DISTINCT FROM OLD.payment_id
     OR NEW.attempt_request_id IS DISTINCT FROM OLD.attempt_request_id
     OR NEW.fx_quote_id IS DISTINCT FROM OLD.fx_quote_id
     OR NEW.psp_provider IS DISTINCT FROM OLD.psp_provider THEN
    RAISE EXCEPTION 'payment_attempt identity fields are immutable'
      USING ERRCODE = 'P0001';
  END IF;
  IF OLD.provider_attempt_ref IS NOT NULL
     AND NEW.provider_attempt_ref IS DISTINCT FROM OLD.provider_attempt_ref THEN
    RAISE EXCEPTION 'provider_attempt_ref already set'
      USING ERRCODE = 'P0001';
  END IF;
  IF OLD.status = 'succeeded' AND NEW.status IS DISTINCT FROM 'succeeded' THEN
    RAISE EXCEPTION 'succeeded payment_attempt is historical fact'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payment_attempts_immutability_trg ON public.payment_attempts;
CREATE TRIGGER payment_attempts_immutability_trg
  BEFORE UPDATE ON public.payment_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.payment_attempts_enforce_immutability();

ALTER TABLE public.payment_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_attempts_select_own ON public.payment_attempts;
CREATE POLICY payment_attempts_select_own ON public.payment_attempts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.payments p
      WHERE p.id = payment_attempts.payment_id
        AND p.client_id = auth.uid()
    )
  );

REVOKE ALL ON TABLE public.payment_attempts FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.payment_attempts TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.payment_attempts_set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.payment_attempts_enforce_immutability() FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Service-role / owner helper (same pattern as C06)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.c12_caller_is_service()
RETURNS boolean
LANGUAGE plpgsql
STABLE
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
  IF v_jwt_role IS NOT DISTINCT FROM 'service_role' THEN
    RETURN true;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM pg_roles
    WHERE rolname = SESSION_USER AND (rolsuper OR rolbypassrls
      OR rolname IN ('postgres', 'supabase_admin'))
  );
END;
$$;

REVOKE ALL ON FUNCTION public.c12_caller_is_service() FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Decision #37 wrappers — close direct C06 as external create surface
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_create_xaf_payment_intent(
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
  v_pay jsonb;
  v_id uuid;
  v_row public.payments%ROWTYPE;
BEGIN
  v_pay := public.rpc_create_payment_intent(
    p_project_id, p_amount_xaf, p_psp_provider, p_client_request_id
  );
  v_id := (v_pay->>'payment_id')::uuid;
  SELECT * INTO v_row FROM public.payments WHERE id = v_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment not found after C06 create' USING ERRCODE = 'P0002';
  END IF;
  IF v_row.funding_mode IS NULL THEN
    UPDATE public.payments SET funding_mode = 'xaf_native' WHERE id = v_id;
  ELSIF v_row.funding_mode IS DISTINCT FROM 'xaf_native' THEN
    RAISE EXCEPTION 'funding_mode mismatch: expected xaf_native'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN v_pay || jsonb_build_object('funding_mode', 'xaf_native');
END;
$$;

-- C03 wrapper: set cross_border in same txn as C06 create (additive REPLACE)
CREATE OR REPLACE FUNCTION public.rpc_create_cross_border_payment_intent(
  p_fx_quote_id uuid,
  p_psp_provider text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_funding_request_id uuid;
  v_quote public.fx_quotes%ROWTYPE;
  v_req public.escrow_funding_requests%ROWTYPE;
  v_existing public.payments%ROWTYPE;
  v_pay jsonb;
  v_payment_id uuid;
  v_was_new boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_fx_quote_id IS NULL THEN
    RAISE EXCEPTION 'fx_quote_id required' USING ERRCODE = '23502';
  END IF;

  SELECT funding_request_id INTO v_funding_request_id
  FROM public.fx_quotes WHERE id = p_fx_quote_id;
  IF v_funding_request_id IS NULL THEN
    RAISE EXCEPTION 'fx quote not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_req FROM public.escrow_funding_requests
  WHERE id = v_funding_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'funding request not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_existing FROM public.payments
  WHERE client_request_id = v_funding_request_id FOR UPDATE;

  SELECT * INTO v_quote FROM public.fx_quotes
  WHERE id = p_fx_quote_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'fx quote not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_quote.funding_request_id IS DISTINCT FROM v_funding_request_id THEN
    RAISE EXCEPTION 'fx quote funding_request changed under lock' USING ERRCODE = 'P0001';
  END IF;
  IF v_quote.requested_by IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'not authorized for this fx quote' USING ERRCODE = '42501';
  END IF;
  IF v_quote.project_id IS DISTINCT FROM v_req.project_id
     OR v_quote.requested_by IS DISTINCT FROM v_req.requested_by
     OR v_quote.target_amount_xaf IS DISTINCT FROM v_req.amount_xaf THEN
    RAISE EXCEPTION 'fx quote / funding request scope mismatch' USING ERRCODE = 'P0001';
  END IF;

  IF v_quote.status = 'consumed' THEN
    IF v_quote.payment_id IS NULL THEN
      RAISE EXCEPTION 'consumed quote missing payment_id' USING ERRCODE = 'P0001';
    END IF;
    IF v_existing.id IS NULL OR v_existing.id IS DISTINCT FROM v_quote.payment_id THEN
      RAISE EXCEPTION 'consumed quote payment mismatch' USING ERRCODE = 'P0001';
    END IF;
    IF v_existing.funding_mode IS DISTINCT FROM 'cross_border' THEN
      RAISE EXCEPTION 'funding_mode mismatch: expected cross_border' USING ERRCODE = 'P0001';
    END IF;
    RETURN jsonb_build_object(
      'payment_id', v_quote.payment_id,
      'fx_quote_id', v_quote.id,
      'status', v_existing.status,
      'funding_mode', v_existing.funding_mode,
      'idempotent_replay', true,
      'auth_uid', v_uid
    );
  END IF;

  IF v_quote.status IS DISTINCT FROM 'usable' THEN
    RAISE EXCEPTION 'fx quote not usable (status=%)', v_quote.status USING ERRCODE = 'P0001';
  END IF;
  IF v_quote.expires_at <= clock_timestamp() THEN
    UPDATE public.fx_quotes SET status = 'expired' WHERE id = v_quote.id;
    RAISE EXCEPTION 'fx quote expired' USING ERRCODE = 'P0001';
  END IF;

  IF v_existing.id IS NOT NULL THEN
    RAISE EXCEPTION 'payment_attempt_required'
      USING ERRCODE = 'P0001',
            DETAIL = 'Logical payment already exists; C12 owns retry attempts.';
  END IF;

  v_pay := public.rpc_create_payment_intent(
    v_quote.project_id, v_quote.target_amount_xaf, p_psp_provider, v_quote.funding_request_id
  );
  v_payment_id := (v_pay->>'payment_id')::uuid;
  IF v_payment_id IS NULL THEN
    RAISE EXCEPTION 'C06 did not return payment_id' USING ERRCODE = 'P0001';
  END IF;
  v_was_new := NOT COALESCE((v_pay->>'idempotent_replay')::boolean, false);
  IF NOT v_was_new THEN
    RAISE EXCEPTION 'payment_attempt_required' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.payments SET funding_mode = 'cross_border' WHERE id = v_payment_id;

  UPDATE public.fx_quotes
  SET status = 'consumed', consumed_at = clock_timestamp(), payment_id = v_payment_id
  WHERE id = v_quote.id;

  RETURN jsonb_build_object(
    'payment_id', v_payment_id,
    'fx_quote_id', v_quote.id,
    'status', v_pay->>'status',
    'funding_mode', 'cross_border',
    'idempotent_replay', false,
    'auth_uid', v_uid,
    'current_user', current_user::text,
    'session_user', session_user::text
  );
END;
$$;

-- C12-aware rpc_record_fx_quote (additive REPLACE — historical C03 file untouched)
CREATE OR REPLACE FUNCTION public.rpc_record_fx_quote(
  p_funding_request_id uuid,
  p_source_currency text,
  p_source_amount_minor bigint,
  p_fx_provider text,
  p_provider_quote_ref text,
  p_expires_at timestamptz,
  p_quoted_rate numeric DEFAULT NULL,
  p_quote_request_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_req public.escrow_funding_requests%ROWTYPE;
  v_pay public.payments%ROWTYPE;
  v_source char(3);
  v_provider text;
  v_ref text;
  v_id uuid;
  v_row public.fx_quotes%ROWTYPE;
  v_prior int;
  v_active int;
BEGIN
  IF p_funding_request_id IS NULL THEN
    RAISE EXCEPTION 'funding_request_id required' USING ERRCODE = '23502';
  END IF;
  v_source := upper(trim(p_source_currency));
  IF v_source IS NULL OR length(v_source) <> 3 THEN
    RAISE EXCEPTION 'invalid source_currency' USING ERRCODE = '23514';
  END IF;
  IF v_source = 'XAF' THEN
    RAISE EXCEPTION 'XAF-native funding does not use fx_quotes' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.platform_currencies c WHERE c.code = v_source) THEN
    RAISE EXCEPTION 'unknown source_currency %', v_source USING ERRCODE = '23503';
  END IF;
  IF p_source_amount_minor IS NULL OR p_source_amount_minor <= 0 THEN
    RAISE EXCEPTION 'source_amount_minor must be > 0' USING ERRCODE = '23514';
  END IF;
  v_provider := lower(trim(p_fx_provider));
  v_ref := trim(p_provider_quote_ref);
  IF v_provider IS NULL OR v_provider = '' OR v_ref IS NULL OR v_ref = '' THEN
    RAISE EXCEPTION 'fx_provider and provider_quote_ref required' USING ERRCODE = '23502';
  END IF;
  IF p_expires_at IS NULL OR p_expires_at <= clock_timestamp() THEN
    RAISE EXCEPTION 'expires_at must be in the future' USING ERRCODE = '23514';
  END IF;
  IF p_quoted_rate IS NOT NULL AND p_quoted_rate <= 0 THEN
    RAISE EXCEPTION 'quoted_rate must be > 0 when present' USING ERRCODE = '23514';
  END IF;

  IF p_quote_request_id IS NOT NULL THEN
    SELECT * INTO v_row FROM public.fx_quotes WHERE quote_request_id = p_quote_request_id;
    IF FOUND THEN
      IF v_row.funding_request_id IS DISTINCT FROM p_funding_request_id
         OR v_row.source_currency IS DISTINCT FROM v_source
         OR v_row.source_amount_minor IS DISTINCT FROM p_source_amount_minor
         OR v_row.fx_provider IS DISTINCT FROM v_provider
         OR v_row.provider_quote_ref IS DISTINCT FROM v_ref THEN
        RAISE EXCEPTION 'quote_request_id reuse with different fields' USING ERRCODE = 'P0001';
      END IF;
      RETURN jsonb_build_object('fx_quote_id', v_row.id, 'status', v_row.status, 'idempotent_replay', true);
    END IF;
  END IF;

  SELECT * INTO v_row FROM public.fx_quotes
  WHERE fx_provider = v_provider AND provider_quote_ref = v_ref;
  IF FOUND THEN
    IF v_row.funding_request_id IS DISTINCT FROM p_funding_request_id
       OR v_row.source_currency IS DISTINCT FROM v_source
       OR v_row.source_amount_minor IS DISTINCT FROM p_source_amount_minor THEN
      RAISE EXCEPTION 'provider_quote_ref reuse with different fields' USING ERRCODE = 'P0001';
    END IF;
    RETURN jsonb_build_object('fx_quote_id', v_row.id, 'status', v_row.status, 'idempotent_replay', true);
  END IF;

  SELECT * INTO v_req FROM public.escrow_funding_requests
  WHERE id = p_funding_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'funding request not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_req.status = 'revoked' THEN
    RAISE EXCEPTION 'funding request revoked' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_pay FROM public.payments
  WHERE client_request_id = p_funding_request_id FOR UPDATE;

  IF FOUND THEN
    IF v_pay.ledger_journal_id IS NOT NULL THEN
      RAISE EXCEPTION 'fx requote denied: payment already ledger-posted' USING ERRCODE = 'P0001';
    END IF;
    IF v_pay.status = 'succeeded' THEN
      RAISE EXCEPTION 'fx requote denied: payment already succeeded' USING ERRCODE = 'P0001';
    END IF;
    IF v_pay.status IN ('failed', 'canceled') THEN
      RAISE EXCEPTION 'fx requote denied: payment status %', v_pay.status USING ERRCODE = 'P0001';
    END IF;
    IF v_pay.status = 'processing' THEN
      RAISE EXCEPTION 'fx requote denied: payment processing' USING ERRCODE = 'P0001';
    END IF;
    IF v_pay.status IS DISTINCT FROM 'requires_action' THEN
      RAISE EXCEPTION 'fx requote denied: payment status %', v_pay.status USING ERRCODE = 'P0001';
    END IF;
    -- C12-era: requires_action alone is insufficient (initial P1 before A1)
    SELECT count(*)::int INTO v_prior FROM public.payment_attempts
    WHERE payment_id = v_pay.id AND status IN ('failed', 'canceled');
    SELECT count(*)::int INTO v_active FROM public.payment_attempts
    WHERE payment_id = v_pay.id AND status IN ('created', 'submitted', 'processing');
    IF v_active > 0 THEN
      RAISE EXCEPTION 'fx requote denied: active payment attempt exists' USING ERRCODE = 'P0001';
    END IF;
    IF v_prior < 1 THEN
      RAISE EXCEPTION 'fx requote denied: previous failed/canceled attempt required'
        USING ERRCODE = 'P0001';
    END IF;
  ELSIF v_req.status = 'consumed' THEN
    RAISE EXCEPTION 'funding request consumed without matching payment' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.fx_quotes SET status = 'superseded'
  WHERE funding_request_id = p_funding_request_id AND status = 'usable';

  INSERT INTO public.fx_quotes (
    funding_request_id, project_id, requested_by,
    source_currency, source_amount_minor, target_currency, target_amount_xaf,
    fx_provider, provider_quote_ref, quoted_rate, quote_request_id, expires_at, status
  ) VALUES (
    v_req.id, v_req.project_id, v_req.requested_by,
    v_source, p_source_amount_minor, 'XAF', v_req.amount_xaf,
    v_provider, v_ref, p_quoted_rate, p_quote_request_id, p_expires_at, 'usable'
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'fx_quote_id', v_id, 'funding_request_id', v_req.id, 'project_id', v_req.project_id,
    'requested_by', v_req.requested_by, 'source_currency', v_source,
    'source_amount_minor', p_source_amount_minor, 'target_amount_xaf', v_req.amount_xaf,
    'status', 'usable', 'idempotent_replay', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_create_payment_intent(uuid, bigint, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_create_payment_intent(uuid, bigint, text, uuid)
  TO service_role;

GRANT EXECUTE ON FUNCTION public.rpc_create_xaf_payment_intent(uuid, bigint, text, uuid)
  TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_create_xaf_payment_intent(uuid, bigint, text, uuid)
  FROM PUBLIC, anon;

-- -----------------------------------------------------------------------------
-- rpc_create_payment_attempt (service-only)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_create_payment_attempt(
  p_payment_id uuid,
  p_attempt_request_id uuid,
  p_fx_quote_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_pay public.payments%ROWTYPE;
  v_req public.escrow_funding_requests%ROWTYPE;
  v_quote public.fx_quotes%ROWTYPE;
  v_exist public.payment_attempts%ROWTYPE;
  v_id uuid;
  v_n int;
  v_q1 uuid;
  v_fr uuid;
BEGIN
  IF NOT public.c12_caller_is_service() THEN
    RAISE EXCEPTION 'service_role required' USING ERRCODE = '42501';
  END IF;
  IF p_payment_id IS NULL OR p_attempt_request_id IS NULL THEN
    RAISE EXCEPTION 'payment_id and attempt_request_id required' USING ERRCODE = '23502';
  END IF;

  SELECT * INTO v_exist FROM public.payment_attempts
  WHERE attempt_request_id = p_attempt_request_id;
  IF FOUND THEN
    IF v_exist.payment_id IS DISTINCT FROM p_payment_id THEN
      RAISE EXCEPTION 'attempt_request_id reuse with different fields' USING ERRCODE = 'P0001';
    END IF;
    IF p_fx_quote_id IS NOT NULL
       AND v_exist.fx_quote_id IS DISTINCT FROM p_fx_quote_id THEN
      RAISE EXCEPTION 'attempt_request_id reuse with different fields' USING ERRCODE = 'P0001';
    END IF;
    RETURN jsonb_build_object(
      'attempt_id', v_exist.id, 'payment_id', v_exist.payment_id,
      'status', v_exist.status, 'fx_quote_id', v_exist.fx_quote_id,
      'idempotent_replay', true
    );
  END IF;

  -- Locator (not authority): discover funding_request without locking quote
  SELECT client_request_id INTO v_fr FROM public.payments WHERE id = p_payment_id;
  IF v_fr IS NULL THEN
    RAISE EXCEPTION 'payment not found' USING ERRCODE = 'P0002';
  END IF;
  -- lock order: request → payment → quote → attempt
  SELECT * INTO v_req FROM public.escrow_funding_requests
  WHERE id = v_fr
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'funding request not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_pay FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_pay.status IN ('failed', 'canceled', 'succeeded') THEN
    RAISE EXCEPTION 'payment in terminal status %', v_pay.status USING ERRCODE = 'P0001';
  END IF;
  IF v_pay.ledger_journal_id IS NOT NULL THEN
    RAISE EXCEPTION 'payment already ledger-posted' USING ERRCODE = 'P0001';
  END IF;
  IF v_pay.status IS DISTINCT FROM 'requires_action' THEN
    RAISE EXCEPTION 'payment must be requires_action to create attempt (got %)', v_pay.status
      USING ERRCODE = 'P0001';
  END IF;
  IF v_pay.funding_mode IS NULL THEN
    RAISE EXCEPTION 'funding_mode required' USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*)::int INTO v_n FROM public.payment_attempts WHERE payment_id = v_pay.id;

  IF v_n = 0 THEN
    -- Bootstrap A1
    IF v_pay.funding_mode = 'cross_border' THEN
      SELECT id INTO v_q1 FROM public.fx_quotes
      WHERE payment_id = v_pay.id AND status = 'consumed'
      ORDER BY consumed_at ASC, created_at ASC;
      IF v_q1 IS NULL THEN
        RAISE EXCEPTION 'initial consumed quote not found for payment' USING ERRCODE = 'P0001';
      END IF;
      IF (SELECT count(*) FROM public.fx_quotes
          WHERE payment_id = v_pay.id AND status = 'consumed') <> 1 THEN
        RAISE EXCEPTION 'ambiguous initial consumed quote' USING ERRCODE = 'P0001';
      END IF;
      IF p_fx_quote_id IS NOT NULL AND p_fx_quote_id IS DISTINCT FROM v_q1 THEN
        RAISE EXCEPTION 'bootstrap fx_quote_id mismatch' USING ERRCODE = 'P0001';
      END IF;
      SELECT * INTO v_quote FROM public.fx_quotes WHERE id = v_q1 FOR UPDATE;
      IF v_quote.funding_request_id IS DISTINCT FROM v_pay.client_request_id
         OR v_quote.target_amount_xaf IS DISTINCT FROM v_pay.amount_xaf
         OR v_quote.payment_id IS DISTINCT FROM v_pay.id
         OR v_quote.status IS DISTINCT FROM 'consumed' THEN
        RAISE EXCEPTION 'initial quote / payment mismatch' USING ERRCODE = 'P0001';
      END IF;
      p_fx_quote_id := v_q1;
    ELSE
      IF p_fx_quote_id IS NOT NULL THEN
        RAISE EXCEPTION 'xaf_native attempt must not bind fx_quote_id' USING ERRCODE = 'P0001';
      END IF;
    END IF;
  ELSE
    -- Retry A2+
    IF NOT EXISTS (
      SELECT 1 FROM public.payment_attempts
      WHERE payment_id = v_pay.id AND status IN ('failed', 'canceled')
    ) THEN
      RAISE EXCEPTION 'retry requires a previous failed/canceled attempt' USING ERRCODE = 'P0001';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.payment_attempts
      WHERE payment_id = v_pay.id AND status IN ('created', 'submitted', 'processing')
    ) THEN
      RAISE EXCEPTION 'active payment attempt already exists' USING ERRCODE = 'P0001';
    END IF;
    IF v_pay.funding_mode = 'cross_border' THEN
      IF p_fx_quote_id IS NULL THEN
        RAISE EXCEPTION 'retry cross_border attempt requires usable fx_quote_id' USING ERRCODE = '23502';
      END IF;
      SELECT * INTO v_quote FROM public.fx_quotes WHERE id = p_fx_quote_id FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'fx quote not found' USING ERRCODE = 'P0002';
      END IF;
      IF v_quote.status IS DISTINCT FROM 'usable' THEN
        RAISE EXCEPTION 'fx quote not usable (status=%)', v_quote.status USING ERRCODE = 'P0001';
      END IF;
      IF v_quote.expires_at <= clock_timestamp() THEN
        UPDATE public.fx_quotes SET status = 'expired' WHERE id = v_quote.id;
        RAISE EXCEPTION 'fx quote expired' USING ERRCODE = 'P0001';
      END IF;
      IF v_quote.funding_request_id IS DISTINCT FROM v_pay.client_request_id
         OR v_quote.project_id IS DISTINCT FROM v_pay.project_id
         OR v_quote.target_amount_xaf IS DISTINCT FROM v_pay.amount_xaf THEN
        RAISE EXCEPTION 'retry quote / payment scope mismatch' USING ERRCODE = 'P0001';
      END IF;
      UPDATE public.fx_quotes
      SET status = 'consumed', consumed_at = clock_timestamp(), payment_id = v_pay.id
      WHERE id = v_quote.id;
    ELSE
      IF p_fx_quote_id IS NOT NULL THEN
        RAISE EXCEPTION 'xaf_native attempt must not bind fx_quote_id' USING ERRCODE = 'P0001';
      END IF;
    END IF;
  END IF;

  INSERT INTO public.payment_attempts (
    payment_id, attempt_request_id, fx_quote_id, psp_provider, status
  ) VALUES (
    v_pay.id, p_attempt_request_id, p_fx_quote_id, v_pay.psp_provider, 'created'
  )
  RETURNING id INTO v_id;

  UPDATE public.payments SET status = 'processing' WHERE id = v_pay.id;

  RETURN jsonb_build_object(
    'attempt_id', v_id, 'payment_id', v_pay.id, 'fx_quote_id', p_fx_quote_id,
    'status', 'created', 'payment_status', 'processing', 'idempotent_replay', false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_attach_payment_attempt_ref(
  p_attempt_id uuid,
  p_provider_attempt_ref text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_a public.payment_attempts%ROWTYPE;
  v_ref text;
BEGIN
  IF NOT public.c12_caller_is_service() THEN
    RAISE EXCEPTION 'service_role required' USING ERRCODE = '42501';
  END IF;
  v_ref := trim(p_provider_attempt_ref);
  IF v_ref IS NULL OR v_ref = '' THEN
    RAISE EXCEPTION 'provider_attempt_ref required' USING ERRCODE = '23502';
  END IF;
  SELECT * INTO v_a FROM public.payment_attempts WHERE id = p_attempt_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment_attempt not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_a.status NOT IN ('created', 'submitted', 'processing') THEN
    RAISE EXCEPTION 'attempt status % cannot attach ref', v_a.status USING ERRCODE = 'P0001';
  END IF;
  IF v_a.provider_attempt_ref IS NOT NULL AND v_a.provider_attempt_ref IS DISTINCT FROM v_ref THEN
    RAISE EXCEPTION 'provider_attempt_ref already set' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.payment_attempts
  SET provider_attempt_ref = v_ref,
      status = CASE WHEN status = 'created' THEN 'submitted' ELSE status END,
      submitted_at = COALESCE(submitted_at, clock_timestamp())
  WHERE id = p_attempt_id;
  RETURN jsonb_build_object('attempt_id', p_attempt_id, 'provider_attempt_ref', v_ref);
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_fail_payment_attempt(
  p_attempt_id uuid,
  p_outcome text DEFAULT 'failed',
  p_failure_code text DEFAULT NULL,
  p_failure_detail_safe text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_a public.payment_attempts%ROWTYPE;
  v_pay public.payments%ROWTYPE;
  v_req public.escrow_funding_requests%ROWTYPE;
  v_out text;
BEGIN
  IF NOT public.c12_caller_is_service() THEN
    RAISE EXCEPTION 'service_role required' USING ERRCODE = '42501';
  END IF;
  v_out := lower(trim(p_outcome));
  IF v_out NOT IN ('failed', 'canceled') THEN
    RAISE EXCEPTION 'outcome must be failed or canceled' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v_pay FROM public.payments
  WHERE id = (SELECT payment_id FROM public.payment_attempts WHERE id = p_attempt_id);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment_attempt not found' USING ERRCODE = 'P0002';
  END IF;
  SELECT * INTO v_req FROM public.escrow_funding_requests
  WHERE id = v_pay.client_request_id FOR UPDATE;
  SELECT * INTO v_pay FROM public.payments WHERE id = v_pay.id FOR UPDATE;
  SELECT * INTO v_a FROM public.payment_attempts WHERE id = p_attempt_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment_attempt not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_a.status NOT IN ('created', 'submitted', 'processing') THEN
    RAISE EXCEPTION 'attempt status % cannot fail/cancel', v_a.status USING ERRCODE = 'P0001';
  END IF;
  IF v_pay.status IN ('succeeded', 'failed', 'canceled') THEN
    RAISE EXCEPTION 'payment in terminal status %', v_pay.status USING ERRCODE = 'P0001';
  END IF;

  IF v_out = 'failed' THEN
    UPDATE public.payment_attempts
    SET status = 'failed', failed_at = clock_timestamp(),
        failure_code = p_failure_code, failure_detail_safe = p_failure_detail_safe
    WHERE id = p_attempt_id;
  ELSE
    UPDATE public.payment_attempts
    SET status = 'canceled', canceled_at = clock_timestamp(),
        failure_code = p_failure_code, failure_detail_safe = p_failure_detail_safe
    WHERE id = p_attempt_id;
  END IF;

  UPDATE public.payments SET status = 'requires_action' WHERE id = v_pay.id;

  RETURN jsonb_build_object(
    'attempt_id', p_attempt_id, 'attempt_status', v_out,
    'payment_id', v_pay.id, 'payment_status', 'requires_action'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_abandon_payment(
  p_payment_id uuid,
  p_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_pay public.payments%ROWTYPE;
  v_st text;
BEGIN
  IF NOT public.c12_caller_is_service() THEN
    RAISE EXCEPTION 'service_role required' USING ERRCODE = '42501';
  END IF;
  v_st := lower(trim(p_status));
  IF v_st NOT IN ('failed', 'canceled') THEN
    RAISE EXCEPTION 'abandon status must be failed or canceled' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO v_pay FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_pay.status IN ('succeeded', 'failed', 'canceled') THEN
    RAISE EXCEPTION 'payment already terminal %', v_pay.status USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.payment_attempts
    WHERE payment_id = p_payment_id AND status IN ('created', 'submitted', 'processing')
  ) THEN
    RAISE EXCEPTION 'cannot abandon payment with active attempt' USING ERRCODE = 'P0001';
  END IF;
  IF v_pay.status IS DISTINCT FROM 'requires_action' THEN
    RAISE EXCEPTION 'abandon requires requires_action (got %)', v_pay.status USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.payments SET status = v_st WHERE id = p_payment_id;
  RETURN jsonb_build_object('payment_id', p_payment_id, 'status', v_st);
END;
$$;

-- Atomic success finalization. Nested C06 runs in THIS transaction.
-- Do NOT use rpc_attach_payment_psp_ref (would attach in-flight refs / force processing).
CREATE OR REPLACE FUNCTION public.rpc_finalize_payment_attempt_success(
  p_attempt_id uuid,
  p_provider_attempt_ref text,
  p_psp_provider text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_a public.payment_attempts%ROWTYPE;
  v_pay public.payments%ROWTYPE;
  v_req public.escrow_funding_requests%ROWTYPE;
  v_quote public.fx_quotes%ROWTYPE;
  v_ref text;
  v_prov text;
  v_post jsonb;
  v_pid uuid;
  v_fr uuid;
  v_qid uuid;
BEGIN
  IF NOT public.c12_caller_is_service() THEN
    RAISE EXCEPTION 'service_role required' USING ERRCODE = '42501';
  END IF;
  v_ref := trim(p_provider_attempt_ref);
  v_prov := lower(trim(p_psp_provider));
  IF v_ref IS NULL OR v_ref = '' THEN
    RAISE EXCEPTION 'provider_attempt_ref required' USING ERRCODE = '23502';
  END IF;

  SELECT pa.payment_id, p.client_request_id, pa.fx_quote_id
    INTO v_pid, v_fr, v_qid
  FROM public.payment_attempts pa
  JOIN public.payments p ON p.id = pa.payment_id
  WHERE pa.id = p_attempt_id;
  IF v_pid IS NULL THEN
    RAISE EXCEPTION 'payment_attempt not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_req FROM public.escrow_funding_requests WHERE id = v_fr FOR UPDATE;
  SELECT * INTO v_pay FROM public.payments WHERE id = v_pid FOR UPDATE;
  IF v_qid IS NOT NULL THEN
    SELECT * INTO v_quote FROM public.fx_quotes WHERE id = v_qid FOR UPDATE;
  END IF;
  SELECT * INTO v_a FROM public.payment_attempts WHERE id = p_attempt_id FOR UPDATE;

  -- Idempotent replay of same success
  IF v_a.status = 'succeeded'
     AND v_pay.status = 'succeeded'
     AND v_pay.ledger_journal_id IS NOT NULL
     AND v_a.provider_attempt_ref IS NOT DISTINCT FROM v_ref
     AND v_a.psp_provider IS NOT DISTINCT FROM v_prov THEN
    RETURN jsonb_build_object(
      'attempt_id', v_a.id, 'payment_id', v_pay.id,
      'journal_id', v_pay.ledger_journal_id, 'idempotent_replay', true
    );
  END IF;

  -- Late success after failed/canceled attempt: fail closed (C11/C13 quarantine)
  IF v_a.status IN ('failed', 'canceled') THEN
    RAISE EXCEPTION 'late_provider_success_requires_reconciliation'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_a.status NOT IN ('created', 'submitted', 'processing') THEN
    RAISE EXCEPTION 'attempt status % cannot succeed', v_a.status USING ERRCODE = 'P0001';
  END IF;
  IF v_prov IS DISTINCT FROM v_a.psp_provider OR v_prov IS DISTINCT FROM v_pay.psp_provider THEN
    RAISE EXCEPTION 'psp_provider mismatch' USING ERRCODE = 'P0001';
  END IF;
  IF v_a.provider_attempt_ref IS NOT NULL AND v_a.provider_attempt_ref IS DISTINCT FROM v_ref THEN
    RAISE EXCEPTION 'provider_attempt_ref mismatch' USING ERRCODE = 'P0001';
  END IF;
  IF v_pay.status IN ('failed', 'canceled', 'succeeded') AND v_pay.ledger_journal_id IS NULL THEN
    IF v_pay.status = 'succeeded' THEN
      RAISE EXCEPTION 'payment already succeeded without journal' USING ERRCODE = 'P0001';
    END IF;
    RAISE EXCEPTION 'payment in terminal status %', v_pay.status USING ERRCODE = 'P0001';
  END IF;
  IF v_pay.status IS DISTINCT FROM 'processing' THEN
    RAISE EXCEPTION 'payment must be processing for success (got %)', v_pay.status
      USING ERRCODE = 'P0001';
  END IF;
  IF v_pay.ledger_journal_id IS NOT NULL THEN
    RAISE EXCEPTION 'payment already ledger-posted' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.payment_attempts
    WHERE payment_id = v_pay.id AND status = 'succeeded' AND id IS DISTINCT FROM v_a.id
  ) THEN
    RAISE EXCEPTION 'payment already has a succeeded attempt' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.payment_attempts
  SET provider_attempt_ref = COALESCE(provider_attempt_ref, v_ref),
      status = 'succeeded',
      succeeded_at = clock_timestamp(),
      processing_at = COALESCE(processing_at, clock_timestamp())
  WHERE id = v_a.id;

  -- Winner-only promotion (Decision #35). Not C06 attach RPC.
  IF v_pay.psp_ref IS NOT NULL AND v_pay.psp_ref IS DISTINCT FROM v_ref THEN
    RAISE EXCEPTION 'payments.psp_ref already set to a different winner' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.payments SET psp_ref = v_ref WHERE id = v_pay.id AND psp_ref IS NULL;

  PERFORM public.rpc_mark_payment_succeeded(
    v_pay.id, v_ref, v_pay.amount_xaf, 'XAF', v_pay.psp_provider
  );
  v_post := public.rpc_post_escrow_funding(v_pay.id);

  RETURN jsonb_build_object(
    'attempt_id', v_a.id,
    'payment_id', v_pay.id,
    'psp_ref', v_ref,
    'journal_id', v_post->>'journal_id',
    'status', 'succeeded',
    'idempotent_replay', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.c12_caller_is_service() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rpc_create_payment_attempt(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rpc_attach_payment_attempt_ref(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rpc_fail_payment_attempt(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rpc_abandon_payment(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rpc_finalize_payment_attempt_success(uuid, text, text)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.rpc_create_payment_attempt(uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_attach_payment_attempt_ref(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_fail_payment_attempt(uuid, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_abandon_payment(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_finalize_payment_attempt_success(uuid, text, text) TO service_role;

COMMENT ON FUNCTION public.rpc_create_payment_attempt(uuid, uuid, uuid) IS
  'C12 service: bootstrap A1 binds consumed Q1; retry consumes usable Qn atomically. Lock: request→payment→quote→attempt.';
COMMENT ON FUNCTION public.rpc_finalize_payment_attempt_success(uuid, text, text) IS
  'C12 service: atomic success. Nested C06 mark+post in same txn. Late failed-attempt success → late_provider_success_requires_reconciliation.';
COMMENT ON FUNCTION public.rpc_create_xaf_payment_intent(uuid, bigint, text, uuid) IS
  'C12 authenticated: XAF-native logical payment. Sets funding_mode=xaf_native. Historical rpc_create_payment_intent is internal.';
