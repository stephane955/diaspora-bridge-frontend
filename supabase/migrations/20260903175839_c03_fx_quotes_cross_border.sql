-- =============================================================================
-- C03 FUTURE CANDIDATE — FX quotes + cross-border payment-intent wrapper
-- File: supabase/future_migrations/c03_fx_quotes_cross_border.sql
--
-- NOT an active migration. Do NOT move into supabase/migrations/ without a
-- separate C03 APPLY task.
--
-- Frozen semantics (C03-D1):
--   TARGET-XAF-FIRST
--   Decision #11 / #32 FROZEN
--   C05 amount_xaf is target authority
--   Provider supplies source_amount_minor
--   Additive over C06 — do not edit 20260902191944
--
-- Legal-neutral: records provider quote facts. No FX PnL, no dealer journals,
-- no insurance/platform fees, no PSP attempt table (C12).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- EUR metadata ONLY (capability ≠ funding approval)
-- is_funding remains false until product activates the corridor.
-- -----------------------------------------------------------------------------
INSERT INTO public.platform_currencies (code, minor_units, name, is_settlement, is_funding)
VALUES ('EUR', 2, 'Euro', false, false)
ON CONFLICT (code) DO NOTHING;

-- -----------------------------------------------------------------------------
-- fx_quotes
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fx_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funding_request_id uuid NOT NULL
    REFERENCES public.escrow_funding_requests(id) ON DELETE RESTRICT,
  project_id uuid NOT NULL
    REFERENCES public.projects(id) ON DELETE RESTRICT,
  requested_by uuid NOT NULL
    REFERENCES auth.users(id) ON DELETE RESTRICT,

  source_currency char(3) NOT NULL
    REFERENCES public.platform_currencies(code),
  source_amount_minor bigint NOT NULL CHECK (source_amount_minor > 0),

  target_currency char(3) NOT NULL DEFAULT 'XAF'
    REFERENCES public.platform_currencies(code),
  target_amount_xaf bigint NOT NULL CHECK (target_amount_xaf > 0),

  fx_provider text NOT NULL,
  provider_quote_ref text NOT NULL,
  -- Audit/display only — never used to recompute settlement amounts
  quoted_rate numeric(20, 10),

  quote_request_id uuid,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'usable'
    CHECK (status IN ('usable', 'consumed', 'expired', 'superseded', 'cancelled')),
  consumed_at timestamptz,
  payment_id uuid REFERENCES public.payments(id) ON DELETE RESTRICT,

  CONSTRAINT fx_quotes_target_xaf_chk CHECK (target_currency = 'XAF'),
  CONSTRAINT fx_quotes_expires_after_created_chk CHECK (expires_at > created_at),
  CONSTRAINT fx_quotes_provider_ref_uidx UNIQUE (fx_provider, provider_quote_ref),
  CONSTRAINT fx_quotes_consumed_chk CHECK (
    (status = 'consumed' AND consumed_at IS NOT NULL AND payment_id IS NOT NULL)
    OR (status <> 'consumed' AND consumed_at IS NULL)
  ),
  CONSTRAINT fx_quotes_quoted_rate_pos_chk CHECK (
    quoted_rate IS NULL OR quoted_rate > 0
  )
);

COMMENT ON TABLE public.fx_quotes IS
  'C03 TARGET-XAF-FIRST executable quote audit. '
  'target_amount_xaf copied from C05; source_amount_minor from trusted provider. '
  'Many quotes may exist per funding_request; at most one usable at a time. '
  'consumed = committed to an actual payment execution path (initial C06 create, '
  'or future C12 retry attempt). C06 returning existing P1 must NOT consume a fresh Q2. '
  'No UNIQUE(payment_id). C12 owns payment_attempts.';

COMMENT ON COLUMN public.fx_quotes.quoted_rate IS
  'AUDIT/DISPLAY ONLY. Authoritative economics are source_amount_minor + target_amount_xaf.';

CREATE INDEX IF NOT EXISTS fx_quotes_funding_request_idx
  ON public.fx_quotes (funding_request_id);

CREATE INDEX IF NOT EXISTS fx_quotes_requested_by_idx
  ON public.fx_quotes (requested_by);

CREATE INDEX IF NOT EXISTS fx_quotes_payment_id_idx
  ON public.fx_quotes (payment_id)
  WHERE payment_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS fx_quotes_one_usable_per_request_uidx
  ON public.fx_quotes (funding_request_id)
  WHERE status = 'usable';

CREATE UNIQUE INDEX IF NOT EXISTS fx_quotes_quote_request_id_uidx
  ON public.fx_quotes (quote_request_id)
  WHERE quote_request_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- Immutability: economic columns cannot change after insert
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fx_quotes_enforce_immutability()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NEW.funding_request_id IS DISTINCT FROM OLD.funding_request_id
     OR NEW.project_id IS DISTINCT FROM OLD.project_id
     OR NEW.requested_by IS DISTINCT FROM OLD.requested_by
     OR NEW.source_currency IS DISTINCT FROM OLD.source_currency
     OR NEW.source_amount_minor IS DISTINCT FROM OLD.source_amount_minor
     OR NEW.target_currency IS DISTINCT FROM OLD.target_currency
     OR NEW.target_amount_xaf IS DISTINCT FROM OLD.target_amount_xaf
     OR NEW.fx_provider IS DISTINCT FROM OLD.fx_provider
     OR NEW.provider_quote_ref IS DISTINCT FROM OLD.provider_quote_ref
     OR NEW.quoted_rate IS DISTINCT FROM OLD.quoted_rate
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
     OR NEW.quote_request_id IS DISTINCT FROM OLD.quote_request_id THEN
    RAISE EXCEPTION 'fx_quotes economic fields are immutable'
      USING ERRCODE = 'P0001';
  END IF;

  -- Lifecycle-only mutations allowed: status, consumed_at, payment_id
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fx_quotes_immutability ON public.fx_quotes;
CREATE TRIGGER trg_fx_quotes_immutability
  BEFORE UPDATE ON public.fx_quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.fx_quotes_enforce_immutability();

-- -----------------------------------------------------------------------------
-- RLS — requester SELECT only (co-funders do not see foreign-leg economics)
-- -----------------------------------------------------------------------------
ALTER TABLE public.fx_quotes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.fx_quotes FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.fx_quotes
  FROM PUBLIC, anon, authenticated, service_role;

DROP POLICY IF EXISTS fx_quotes_select_own ON public.fx_quotes;
CREATE POLICY fx_quotes_select_own ON public.fx_quotes
  FOR SELECT TO authenticated
  USING (requested_by = auth.uid());

GRANT SELECT ON TABLE public.fx_quotes TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Close usable quotes when payment reaches terminal success / ledger post.
-- Additive C03 guard (does not edit historical C06). Ensures:
--   payments.status = succeeded → no remaining executable usable quote
-- even if a Q2 was recorded under failed immediately before the succeed txn.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fx_quotes_close_on_payment_terminal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF (NEW.status = 'succeeded' AND OLD.status IS DISTINCT FROM 'succeeded')
     OR (NEW.ledger_journal_id IS NOT NULL AND OLD.ledger_journal_id IS NULL) THEN
    UPDATE public.fx_quotes
    SET status = 'superseded'
    WHERE funding_request_id = NEW.client_request_id
      AND status = 'usable';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payments_fx_quotes_close_terminal_trg ON public.payments;
CREATE TRIGGER payments_fx_quotes_close_terminal_trg
  AFTER UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.fx_quotes_close_on_payment_terminal();

REVOKE ALL ON FUNCTION public.fx_quotes_close_on_payment_terminal() FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- rpc_record_fx_quote — trusted server only (service_role)
-- Target XAF / project / requester derived from C05. Never caller-overridable.
--
-- Canonical lock order (C03-R3.1):
--   1) escrow_funding_requests FOR UPDATE
--   2) payments FOR UPDATE (when present for this funding_request_id)
--   3) fx_quotes insert / supersede
-- Matches C06 (request lock before payment). Same order as wrapper.
-- -----------------------------------------------------------------------------
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
BEGIN
  IF p_funding_request_id IS NULL THEN
    RAISE EXCEPTION 'funding_request_id required' USING ERRCODE = '23502';
  END IF;

  v_source := upper(trim(p_source_currency));
  IF v_source IS NULL OR length(v_source) <> 3 THEN
    RAISE EXCEPTION 'invalid source_currency' USING ERRCODE = '23514';
  END IF;

  IF v_source = 'XAF' THEN
    RAISE EXCEPTION 'XAF-native funding does not use fx_quotes'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.platform_currencies c WHERE c.code = v_source
  ) THEN
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

  -- Idempotent: same quote_request_id → same logical quote
  IF p_quote_request_id IS NOT NULL THEN
    SELECT * INTO v_row
    FROM public.fx_quotes
    WHERE quote_request_id = p_quote_request_id;

    IF FOUND THEN
      IF v_row.funding_request_id IS DISTINCT FROM p_funding_request_id
         OR v_row.source_currency IS DISTINCT FROM v_source
         OR v_row.source_amount_minor IS DISTINCT FROM p_source_amount_minor
         OR v_row.fx_provider IS DISTINCT FROM v_provider
         OR v_row.provider_quote_ref IS DISTINCT FROM v_ref THEN
        RAISE EXCEPTION 'quote_request_id reuse with different fields'
          USING ERRCODE = 'P0001';
      END IF;
      RETURN jsonb_build_object(
        'fx_quote_id', v_row.id,
        'status', v_row.status,
        'idempotent_replay', true
      );
    END IF;
  END IF;

  -- Idempotent: same (fx_provider, provider_quote_ref)
  SELECT * INTO v_row
  FROM public.fx_quotes
  WHERE fx_provider = v_provider
    AND provider_quote_ref = v_ref;

  IF FOUND THEN
    IF v_row.funding_request_id IS DISTINCT FROM p_funding_request_id
       OR v_row.source_currency IS DISTINCT FROM v_source
       OR v_row.source_amount_minor IS DISTINCT FROM p_source_amount_minor THEN
      RAISE EXCEPTION 'provider_quote_ref reuse with different fields'
        USING ERRCODE = 'P0001';
    END IF;
    RETURN jsonb_build_object(
      'fx_quote_id', v_row.id,
      'status', v_row.status,
      'idempotent_replay', true
    );
  END IF;

  -- Lock order step 1: funding request
  SELECT * INTO v_req
  FROM public.escrow_funding_requests
  WHERE id = p_funding_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'funding request not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_req.status = 'revoked' THEN
    RAISE EXCEPTION 'funding request revoked' USING ERRCODE = 'P0001';
  END IF;

  -- Lock order step 2: payment for this funding request (if any)
  SELECT * INTO v_pay
  FROM public.payments
  WHERE client_request_id = p_funding_request_id
  FOR UPDATE;

  IF FOUND THEN
    -- Permanent close: ledger posted or succeeded
    IF v_pay.ledger_journal_id IS NOT NULL THEN
      RAISE EXCEPTION 'fx requote denied: payment already ledger-posted'
        USING ERRCODE = 'P0001';
    END IF;

    IF v_pay.status = 'succeeded' THEN
      RAISE EXCEPTION 'fx requote denied: payment already succeeded'
        USING ERRCODE = 'P0001';
    END IF;

    IF v_pay.status = 'processing' THEN
      RAISE EXCEPTION 'fx requote denied: payment processing'
        USING ERRCODE = 'P0001';
    END IF;

    -- Default safe: requires_action means economic commitment may exist
    IF v_pay.status = 'requires_action' THEN
      RAISE EXCEPTION 'fx requote denied: payment requires_action'
        USING ERRCODE = 'P0001';
    END IF;

    -- Allowed only for failed / canceled with no ledger journal
    IF v_pay.status NOT IN ('failed', 'canceled') THEN
      RAISE EXCEPTION 'fx requote denied: payment status %', v_pay.status
        USING ERRCODE = 'P0001';
    END IF;
  ELSIF v_req.status = 'consumed' THEN
    -- Consumed C05 without payment is abnormal; do not invent quotes
    RAISE EXCEPTION 'funding request consumed without matching payment'
      USING ERRCODE = 'P0001';
  END IF;
  -- pending + no payment → ALLOW (pre-intent)
  -- consumed + failed/canceled payment → ALLOW Q2 (usable for C12)

  -- Supersede any current usable quote for this request
  UPDATE public.fx_quotes
  SET status = 'superseded'
  WHERE funding_request_id = p_funding_request_id
    AND status = 'usable';

  INSERT INTO public.fx_quotes (
    funding_request_id,
    project_id,
    requested_by,
    source_currency,
    source_amount_minor,
    target_currency,
    target_amount_xaf,
    fx_provider,
    provider_quote_ref,
    quoted_rate,
    quote_request_id,
    expires_at,
    status
  ) VALUES (
    v_req.id,
    v_req.project_id,
    v_req.requested_by,
    v_source,
    p_source_amount_minor,
    'XAF',
    v_req.amount_xaf,
    v_provider,
    v_ref,
    p_quoted_rate,
    p_quote_request_id,
    p_expires_at,
    'usable'
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'fx_quote_id', v_id,
    'funding_request_id', v_req.id,
    'project_id', v_req.project_id,
    'requested_by', v_req.requested_by,
    'source_currency', v_source,
    'source_amount_minor', p_source_amount_minor,
    'target_amount_xaf', v_req.amount_xaf,
    'status', 'usable',
    'idempotent_replay', false
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- rpc_create_cross_border_payment_intent — authenticated payer
-- Economic inputs come only from the locked quote. Nested call to C06.
--
-- Canonical lock order (C03-R3.1) — ALL multi-object C03 paths:
--   1) escrow_funding_requests FOR UPDATE
--   2) payments FOR UPDATE (if present)
--   3) fx_quotes FOR UPDATE
-- Preliminary unlocked quote SELECT is a locator only — not authority.
-- Must revalidate quote after all locks.
--
-- Consumption rule (C03-R3 — unchanged):
--   consumed = committed to an actual payment execution path.
--   Initial: no P1 yet → create P1 via C06 → consume Q1.
--   Exact Q1 retry: Q1 already consumed → return P1.
--   Fresh Q2 while P1 exists → DENY payment_attempt_required (C12 owns attempt).
-- -----------------------------------------------------------------------------
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

  -- Locator only (NOT authority): discover funding_request_id without locking quote
  SELECT funding_request_id INTO v_funding_request_id
  FROM public.fx_quotes
  WHERE id = p_fx_quote_id;

  IF v_funding_request_id IS NULL THEN
    RAISE EXCEPTION 'fx quote not found' USING ERRCODE = 'P0002';
  END IF;

  -- Lock order step 1: funding request
  SELECT * INTO v_req
  FROM public.escrow_funding_requests
  WHERE id = v_funding_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'funding request not found' USING ERRCODE = 'P0002';
  END IF;

  -- Lock order step 2: existing logical payment (if any)
  SELECT * INTO v_existing
  FROM public.payments
  WHERE client_request_id = v_funding_request_id
  FOR UPDATE;

  -- Lock order step 3: quote
  SELECT * INTO v_quote
  FROM public.fx_quotes
  WHERE id = p_fx_quote_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'fx quote not found' USING ERRCODE = 'P0002';
  END IF;

  -- Post-lock revalidation (authority)
  IF v_quote.funding_request_id IS DISTINCT FROM v_funding_request_id THEN
    RAISE EXCEPTION 'fx quote funding_request changed under lock' USING ERRCODE = 'P0001';
  END IF;

  IF v_quote.requested_by IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'not authorized for this fx quote' USING ERRCODE = '42501';
  END IF;

  IF v_quote.project_id IS DISTINCT FROM v_req.project_id
     OR v_quote.requested_by IS DISTINCT FROM v_req.requested_by
     OR v_quote.target_amount_xaf IS DISTINCT FROM v_req.amount_xaf THEN
    RAISE EXCEPTION 'fx quote / funding request scope mismatch'
      USING ERRCODE = 'P0001';
  END IF;

  -- Exact retry of already-consumed Q1 → return same P1
  IF v_quote.status = 'consumed' THEN
    IF v_quote.payment_id IS NULL THEN
      RAISE EXCEPTION 'consumed quote missing payment_id' USING ERRCODE = 'P0001';
    END IF;
    IF v_existing.id IS NULL OR v_existing.id IS DISTINCT FROM v_quote.payment_id THEN
      RAISE EXCEPTION 'consumed quote payment mismatch' USING ERRCODE = 'P0001';
    END IF;
    RETURN jsonb_build_object(
      'payment_id', v_quote.payment_id,
      'fx_quote_id', v_quote.id,
      'status', v_existing.status,
      'idempotent_replay', true,
      'auth_uid', v_uid
    );
  END IF;

  IF v_quote.status IS DISTINCT FROM 'usable' THEN
    RAISE EXCEPTION 'fx quote not usable (status=%)', v_quote.status
      USING ERRCODE = 'P0001';
  END IF;

  IF v_quote.expires_at <= clock_timestamp() THEN
    UPDATE public.fx_quotes SET status = 'expired' WHERE id = v_quote.id;
    RAISE EXCEPTION 'fx quote expired' USING ERRCODE = 'P0001';
  END IF;

  IF v_existing.id IS NOT NULL THEN
    -- Fresh usable Q2 while P1 exists: C06 returning P1 ≠ new attempt.
    RAISE EXCEPTION 'payment_attempt_required'
      USING ERRCODE = 'P0001',
            DETAIL = 'Logical payment already exists; C12 owns external retry attempts. '
                     'Fresh post-intent quotes must remain usable until C12 binds an attempt.';
  END IF;

  -- Initial path only: no P1 yet → create via C06 and consume this quote
  -- Wrapper already holds funding_request lock; C06 re-locks same row (same txn).
  v_pay := public.rpc_create_payment_intent(
    v_quote.project_id,
    v_quote.target_amount_xaf,
    p_psp_provider,
    v_quote.funding_request_id
  );

  v_payment_id := (v_pay->>'payment_id')::uuid;
  IF v_payment_id IS NULL THEN
    RAISE EXCEPTION 'C06 did not return payment_id' USING ERRCODE = 'P0001';
  END IF;

  v_was_new := NOT COALESCE((v_pay->>'idempotent_replay')::boolean, false);

  IF NOT v_was_new THEN
    RAISE EXCEPTION 'payment_attempt_required'
      USING ERRCODE = 'P0001',
            DETAIL = 'C06 returned existing payment; C03 must not consume a fresh quote.';
  END IF;

  UPDATE public.fx_quotes
  SET status = 'consumed',
      consumed_at = clock_timestamp(),
      payment_id = v_payment_id
  WHERE id = v_quote.id;

  RETURN jsonb_build_object(
    'payment_id', v_payment_id,
    'fx_quote_id', v_quote.id,
    'status', v_pay->>'status',
    'idempotent_replay', false,
    'auth_uid', v_uid,
    'current_user', current_user::text,
    'session_user', session_user::text
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.fx_quotes_enforce_immutability() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rpc_record_fx_quote(uuid, text, bigint, text, text, timestamptz, numeric, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rpc_create_cross_border_payment_intent(uuid, text)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.rpc_record_fx_quote(uuid, text, bigint, text, text, timestamptz, numeric, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_create_cross_border_payment_intent(uuid, text)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.rpc_record_fx_quote(uuid, text, bigint, text, text, timestamptz, numeric, uuid) IS
  'C03 service_role: record trusted provider quote. Target XAF copied from C05. '
  'Post-intent: only failed/canceled (no ledger) may receive a new usable quote. '
  'succeeded / processing / requires_action / ledger-posted → DENY.';
COMMENT ON FUNCTION public.rpc_create_cross_border_payment_intent(uuid, text) IS
  'C03 authenticated: initial usable quote → create C06 payment and consume quote. '
  'Exact consumed-quote retry returns same P1. '
  'Fresh usable quote while P1 exists → payment_attempt_required (C12). '
  'Lock order: funding_request → payment → fx_quote (locator read unlocked). '
  'Does not reopen C05. Nested SECURITY DEFINER relies on JWT auth.uid().';
