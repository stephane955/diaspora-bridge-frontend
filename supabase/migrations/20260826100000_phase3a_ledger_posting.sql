-- =============================================================================
-- Diaspora Bridge — Phase 3A: Open books at zero + ledger posting engine
-- Additive only. Does not alter legacy financial tables/RPCs/Edge Functions.
-- Does not post capital, escrow funding, milestone release, or payouts.
-- Opening balances remain ZERO; no historical cash reconstruction.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helpers: natural balance side + negative allowance
-- Assets/Expenses: balance rises on debit
-- Liabilities/Income/Equity: balance rises on credit
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ledger_purpose_normal_side(
  p_purpose public.ledger_account_purpose
)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public
AS $$
  SELECT CASE p_purpose
    WHEN 'psp_stripe' THEN 'debit'
    WHEN 'psp_momo' THEN 'debit'
    WHEN 'psp_orange' THEN 'debit'
    WHEN 'platform_credit' THEN 'debit'
    WHEN 'platform_loss' THEN 'debit'
    WHEN 'user_available' THEN 'credit'
    WHEN 'user_payout_clearing' THEN 'credit'
    WHEN 'user_refund_clearing' THEN 'credit'
    WHEN 'project_escrow' THEN 'credit'
    WHEN 'project_retainage' THEN 'credit'
    WHEN 'project_materials_escrow' THEN 'credit'
    WHEN 'provider_payable' THEN 'credit'
    WHEN 'supplier_payable' THEN 'credit'
    WHEN 'platform_compliance_hold' THEN 'credit'
    WHEN 'platform_suspense' THEN 'credit'
    WHEN 'platform_fees' THEN 'credit'
    WHEN 'platform_insurance' THEN 'credit'
    WHEN 'platform_equity' THEN 'credit'
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.ledger_purpose_allows_negative(
  p_purpose public.ledger_account_purpose
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public
AS $$
  SELECT p_purpose IN (
    'psp_stripe'::public.ledger_account_purpose,
    'psp_momo'::public.ledger_account_purpose,
    'psp_orange'::public.ledger_account_purpose,
    'platform_suspense'::public.ledger_account_purpose
  );
$$;

CREATE OR REPLACE FUNCTION public.ledger_assert_owner_consistency(
  p_purpose public.ledger_account_purpose,
  p_owner_type public.ledger_owner_type,
  p_owner_id uuid
)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF p_owner_type IN ('user'::public.ledger_owner_type, 'project'::public.ledger_owner_type, 'supplier'::public.ledger_owner_type)
     AND p_owner_id IS NULL THEN
    RAISE EXCEPTION 'ledger account owner_id required for owner_type %', p_owner_type
      USING ERRCODE = '23514';
  END IF;

  IF p_owner_type IN ('platform'::public.ledger_owner_type, 'psp'::public.ledger_owner_type)
     AND p_owner_id IS NOT NULL THEN
    RAISE EXCEPTION 'ledger account owner_id must be NULL for owner_type %', p_owner_type
      USING ERRCODE = '23514';
  END IF;

  -- Purpose ↔ owner_type pairing (prevents privilege escalation via wrong owner)
  IF p_purpose::text LIKE 'psp_%' AND p_owner_type IS DISTINCT FROM 'psp'::public.ledger_owner_type THEN
    RAISE EXCEPTION 'purpose % requires owner_type psp', p_purpose USING ERRCODE = '23514';
  END IF;

  IF p_purpose::text LIKE 'user_%' AND p_owner_type IS DISTINCT FROM 'user'::public.ledger_owner_type THEN
    RAISE EXCEPTION 'purpose % requires owner_type user', p_purpose USING ERRCODE = '23514';
  END IF;

  IF p_purpose::text LIKE 'project_%' AND p_owner_type IS DISTINCT FROM 'project'::public.ledger_owner_type THEN
    RAISE EXCEPTION 'purpose % requires owner_type project', p_purpose USING ERRCODE = '23514';
  END IF;

  IF p_purpose IN (
       'provider_payable'::public.ledger_account_purpose
     ) AND p_owner_type IS DISTINCT FROM 'user'::public.ledger_owner_type THEN
    RAISE EXCEPTION 'provider_payable requires owner_type user' USING ERRCODE = '23514';
  END IF;

  IF p_purpose = 'supplier_payable'::public.ledger_account_purpose
     AND p_owner_type IS DISTINCT FROM 'supplier'::public.ledger_owner_type THEN
    RAISE EXCEPTION 'supplier_payable requires owner_type supplier' USING ERRCODE = '23514';
  END IF;

  IF p_purpose::text LIKE 'platform_%' AND p_owner_type IS DISTINCT FROM 'platform'::public.ledger_owner_type THEN
    RAISE EXCEPTION 'purpose % requires owner_type platform', p_purpose USING ERRCODE = '23514';
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- Race-safe account ensure (deterministic identity)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ledger_ensure_account(
  p_purpose public.ledger_account_purpose,
  p_owner_type public.ledger_owner_type,
  p_owner_id uuid DEFAULT NULL,
  p_currency char(3) DEFAULT 'XAF'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_currency IS DISTINCT FROM 'XAF' THEN
    RAISE EXCEPTION 'ledger currency must be XAF' USING ERRCODE = '23514';
  END IF;

  PERFORM public.ledger_assert_owner_consistency(p_purpose, p_owner_type, p_owner_id);

  LOOP
    IF p_owner_id IS NULL THEN
      SELECT id INTO v_id
      FROM public.ledger_accounts
      WHERE purpose = p_purpose
        AND owner_type = p_owner_type
        AND owner_id IS NULL
        AND currency = p_currency;
    ELSE
      SELECT id INTO v_id
      FROM public.ledger_accounts
      WHERE purpose = p_purpose
        AND owner_type = p_owner_type
        AND owner_id = p_owner_id
        AND currency = p_currency;
    END IF;

    IF v_id IS NOT NULL THEN
      RETURN v_id;
    END IF;

    BEGIN
      INSERT INTO public.ledger_accounts (purpose, owner_type, owner_id, currency, balance_xaf)
      VALUES (p_purpose, p_owner_type, p_owner_id, p_currency, 0)
      RETURNING id INTO v_id;
      RETURN v_id;
    EXCEPTION
      WHEN unique_violation THEN
        -- Concurrent inserter won; retry SELECT
        NULL;
    END;
  END LOOP;
END;
$$;

-- -----------------------------------------------------------------------------
-- Seed system accounts at ZERO (idempotent). No user/project rows.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ledger_seed_system_accounts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  PERFORM public.ledger_ensure_account('psp_stripe', 'psp', NULL);
  PERFORM public.ledger_ensure_account('psp_momo', 'psp', NULL);
  PERFORM public.ledger_ensure_account('psp_orange', 'psp', NULL);
  PERFORM public.ledger_ensure_account('platform_credit', 'platform', NULL);
  PERFORM public.ledger_ensure_account('platform_compliance_hold', 'platform', NULL);
  PERFORM public.ledger_ensure_account('platform_suspense', 'platform', NULL);
  PERFORM public.ledger_ensure_account('platform_fees', 'platform', NULL);
  PERFORM public.ledger_ensure_account('platform_insurance', 'platform', NULL);
  PERFORM public.ledger_ensure_account('platform_equity', 'platform', NULL);
  PERFORM public.ledger_ensure_account('platform_loss', 'platform', NULL);
END;
$$;

SELECT public.ledger_seed_system_accounts();

-- -----------------------------------------------------------------------------
-- Phase 3A journal-type posting matrix validation
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
    'compliance_release'::public.ledger_journal_type
  ) THEN
    RAISE EXCEPTION 'Phase 3A does not allow journal_type %', p_journal_type
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
      -- DR (psp_*|platform_credit|platform_suspense) CR user_available
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
      -- DR user_available CR (payout_clearing|refund_clearing|psp_*|platform_suspense)
      -- V1: refund/payout clearing only — not project_escrow
      IF NOT (v_debit_purposes <@ ARRAY['user_available'] AND cardinality(v_debit_purposes) >= 1) THEN
        RAISE EXCEPTION 'wallet_debit requires debit from user_available only' USING ERRCODE = '22023';
      END IF;
      IF EXISTS (
        SELECT 1 FROM unnest(v_credit_purposes) c(p)
        WHERE c.p NOT IN (
          'user_payout_clearing','user_refund_clearing',
          'psp_stripe','psp_momo','psp_orange','platform_suspense'
        )
      ) OR EXISTS (
        SELECT 1 FROM unnest(v_credit_purposes) c(p) WHERE c.p = 'project_escrow'
      ) THEN
        RAISE EXCEPTION 'wallet_debit credit side invalid (user_available cannot fund escrow in V1)'
          USING ERRCODE = '22023';
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

    ELSE
      RAISE EXCEPTION 'unsupported journal_type %', p_journal_type USING ERRCODE = '22023';
  END CASE;
END;
$$;

-- -----------------------------------------------------------------------------
-- Core posting engine
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ledger_post_journal(
  p_journal_type public.ledger_journal_type,
  p_idempotency_key text,
  p_source public.ledger_journal_source,
  p_lines jsonb,
  p_created_by uuid DEFAULT NULL,
  p_business_object_type text DEFAULT NULL,
  p_business_object_id uuid DEFAULT NULL,
  p_psp_ref text DEFAULT NULL,
  p_currency char(3) DEFAULT 'XAF'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_jwt_role text;
  v_existing_id uuid;
  v_journal_id uuid;
  v_elem jsonb;
  v_purpose public.ledger_account_purpose;
  v_owner_type public.ledger_owner_type;
  v_owner_id uuid;
  v_debit bigint;
  v_credit bigint;
  v_account_id uuid;
  v_account_ids uuid[] := ARRAY[]::uuid[];
  v_line_account_ids uuid[] := ARRAY[]::uuid[];
  v_line_debits bigint[] := ARRAY[]::bigint[];
  v_line_credits bigint[] := ARRAY[]::bigint[];
  v_line_projects uuid[] := ARRAY[]::uuid[];
  v_line_milestones uuid[] := ARRAY[]::uuid[];
  v_line_payments uuid[] := ARRAY[]::uuid[];
  v_line_advances uuid[] := ARRAY[]::uuid[];
  v_total_debit bigint := 0;
  v_total_credit bigint := 0;
  v_i int;
  v_bal bigint;
  v_purpose_row public.ledger_account_purpose;
  v_side text;
  v_delta bigint;
  v_new_bal bigint;
  v_balances jsonb := '[]'::jsonb;
  r record;
BEGIN
  -- Authorization: JWT service_role OR privileged DB session (ops/migrations)
  v_jwt_role := NULLIF(current_setting('request.jwt.claim.role', true), '');
  BEGIN
    IF v_jwt_role IS NULL AND to_regprocedure('auth.jwt()') IS NOT NULL THEN
      v_jwt_role := NULLIF(auth.jwt()->>'role', '');
    END IF;
  EXCEPTION
    WHEN undefined_function THEN
      NULL;
    WHEN OTHERS THEN
      NULL;
  END;

  IF v_jwt_role IS DISTINCT FROM 'service_role' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_roles
      WHERE rolname = SESSION_USER
        AND (rolsuper OR rolbypassrls OR rolname IN ('postgres', 'supabase_admin'))
    ) THEN
      RAISE EXCEPTION 'ledger_post_journal requires service_role'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) = 0 THEN
    RAISE EXCEPTION 'idempotency_key required' USING ERRCODE = '23502';
  END IF;

  IF p_currency IS DISTINCT FROM 'XAF' THEN
    RAISE EXCEPTION 'currency must be XAF' USING ERRCODE = '23514';
  END IF;

  -- Idempotent short-circuit
  SELECT id INTO v_existing_id
  FROM public.ledger_journals
  WHERE idempotency_key = p_idempotency_key;

  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'journal_id', v_existing_id,
      'idempotent_replay', true,
      'balances', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'account_id', a.id,
          'purpose', a.purpose,
          'owner_type', a.owner_type,
          'owner_id', a.owner_id,
          'balance_xaf', a.balance_xaf
        ) ORDER BY a.id), '[]'::jsonb)
        FROM public.ledger_lines l
        JOIN public.ledger_accounts a ON a.id = l.account_id
        WHERE l.journal_id = v_existing_id
      )
    );
  END IF;

  PERFORM public.ledger_validate_phase3a_matrix(p_journal_type, p_lines);

  -- Resolve accounts + accumulate
  FOR v_elem IN SELECT value FROM jsonb_array_elements(p_lines)
  LOOP
    v_purpose := (v_elem->>'purpose')::public.ledger_account_purpose;
    v_owner_type := (v_elem->>'owner_type')::public.ledger_owner_type;
    v_owner_id := NULLIF(v_elem->>'owner_id', '')::uuid;
    v_debit := (v_elem->>'debit_xaf')::bigint;
    v_credit := (v_elem->>'credit_xaf')::bigint;

    PERFORM public.ledger_assert_owner_consistency(v_purpose, v_owner_type, v_owner_id);
    v_account_id := public.ledger_ensure_account(v_purpose, v_owner_type, v_owner_id, p_currency);

    v_account_ids := array_append(v_account_ids, v_account_id);
    v_line_account_ids := array_append(v_line_account_ids, v_account_id);
    v_line_debits := array_append(v_line_debits, v_debit);
    v_line_credits := array_append(v_line_credits, v_credit);
    v_line_projects := array_append(v_line_projects, NULLIF(v_elem->>'project_id', '')::uuid);
    v_line_milestones := array_append(v_line_milestones, NULLIF(v_elem->>'milestone_id', '')::uuid);
    v_line_payments := array_append(v_line_payments, NULLIF(v_elem->>'payment_id', '')::uuid);
    v_line_advances := array_append(v_line_advances, NULLIF(v_elem->>'advance_id', '')::uuid);

    v_total_debit := v_total_debit + v_debit;
    v_total_credit := v_total_credit + v_credit;
  END LOOP;

  IF v_total_debit IS DISTINCT FROM v_total_credit THEN
    RAISE EXCEPTION 'unbalanced journal: debit % <> credit %', v_total_debit, v_total_credit
      USING ERRCODE = '23514';
  END IF;

  IF v_total_debit <= 0 THEN
    RAISE EXCEPTION 'journal total must be greater than zero' USING ERRCODE = '23514';
  END IF;

  -- Deterministic locks
  v_account_ids := (
    SELECT ARRAY(SELECT DISTINCT x FROM unnest(v_account_ids) AS t(x) ORDER BY x)
  );

  FOR r IN
    SELECT id, purpose, balance_xaf
    FROM public.ledger_accounts
    WHERE id = ANY (v_account_ids)
    ORDER BY id
    FOR UPDATE
  LOOP
    NULL; -- rows locked
  END LOOP;

  -- Projected balance checks
  FOR v_i IN 1 .. cardinality(v_line_account_ids)
  LOOP
    SELECT purpose, balance_xaf INTO v_purpose_row, v_bal
    FROM public.ledger_accounts
    WHERE id = v_line_account_ids[v_i];

    v_side := public.ledger_purpose_normal_side(v_purpose_row);
    IF v_side = 'debit' THEN
      v_delta := v_line_debits[v_i] - v_line_credits[v_i];
    ELSE
      v_delta := v_line_credits[v_i] - v_line_debits[v_i];
    END IF;

    v_new_bal := v_bal + v_delta;
    IF v_new_bal < 0 AND NOT public.ledger_purpose_allows_negative(v_purpose_row) THEN
      RAISE EXCEPTION 'account % (%) would go negative (% + %)',
        v_line_account_ids[v_i], v_purpose_row, v_bal, v_delta
        USING ERRCODE = '23514';
    END IF;
  END LOOP;

  -- Insert journal (idempotency race)
  BEGIN
    INSERT INTO public.ledger_journals (
      journal_type, idempotency_key, currency, source,
      created_by, business_object_type, business_object_id, psp_ref
    ) VALUES (
      p_journal_type, p_idempotency_key, p_currency, p_source,
      p_created_by, p_business_object_type, p_business_object_id, p_psp_ref
    )
    RETURNING id INTO v_journal_id;
  EXCEPTION
    WHEN unique_violation THEN
      SELECT id INTO v_existing_id
      FROM public.ledger_journals
      WHERE idempotency_key = p_idempotency_key;

      RETURN jsonb_build_object(
        'journal_id', v_existing_id,
        'idempotent_replay', true,
        'balances', '[]'::jsonb
      );
  END;

  -- Insert lines
  FOR v_i IN 1 .. cardinality(v_line_account_ids)
  LOOP
    INSERT INTO public.ledger_lines (
      journal_id, account_id, debit_xaf, credit_xaf,
      project_id, milestone_id, payment_id, advance_id
    ) VALUES (
      v_journal_id,
      v_line_account_ids[v_i],
      v_line_debits[v_i],
      v_line_credits[v_i],
      v_line_projects[v_i],
      v_line_milestones[v_i],
      v_line_payments[v_i],
      v_line_advances[v_i]
    );
  END LOOP;

  -- Apply balances (same TX)
  FOR v_i IN 1 .. cardinality(v_line_account_ids)
  LOOP
    SELECT purpose INTO v_purpose_row
    FROM public.ledger_accounts
    WHERE id = v_line_account_ids[v_i];

    v_side := public.ledger_purpose_normal_side(v_purpose_row);
    IF v_side = 'debit' THEN
      v_delta := v_line_debits[v_i] - v_line_credits[v_i];
    ELSE
      v_delta := v_line_credits[v_i] - v_line_debits[v_i];
    END IF;

    UPDATE public.ledger_accounts
    SET balance_xaf = balance_xaf + v_delta
    WHERE id = v_line_account_ids[v_i];
  END LOOP;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'account_id', a.id,
    'purpose', a.purpose,
    'owner_type', a.owner_type,
    'owner_id', a.owner_id,
    'balance_xaf', a.balance_xaf
  ) ORDER BY a.id), '[]'::jsonb)
  INTO v_balances
  FROM public.ledger_accounts a
  WHERE a.id = ANY (v_account_ids);

  RETURN jsonb_build_object(
    'journal_id', v_journal_id,
    'idempotent_replay', false,
    'total_xaf', v_total_debit,
    'balances', v_balances
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- Read-only verification helpers
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ledger_trial_balance()
RETURNS TABLE (
  purpose public.ledger_account_purpose,
  owner_type public.ledger_owner_type,
  owner_id uuid,
  balance_xaf bigint,
  normal_side text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT a.purpose, a.owner_type, a.owner_id, a.balance_xaf,
         public.ledger_purpose_normal_side(a.purpose) AS normal_side
  FROM public.ledger_accounts a
  ORDER BY a.purpose::text, a.owner_type::text, a.owner_id NULLS FIRST;
$$;

CREATE OR REPLACE FUNCTION public.ledger_verify_journal_equality()
RETURNS TABLE (
  journal_count bigint,
  total_debit_xaf bigint,
  total_credit_xaf bigint,
  is_balanced boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    (SELECT count(*)::bigint FROM public.ledger_journals),
    COALESCE((SELECT sum(debit_xaf) FROM public.ledger_lines), 0)::bigint,
    COALESCE((SELECT sum(credit_xaf) FROM public.ledger_lines), 0)::bigint,
    COALESCE((SELECT sum(debit_xaf) FROM public.ledger_lines), 0)
      = COALESCE((SELECT sum(credit_xaf) FROM public.ledger_lines), 0);
$$;

CREATE OR REPLACE FUNCTION public.ledger_balance_sheet_probe()
RETURNS TABLE (
  asset_balances bigint,
  liability_balances bigint,
  income_balances bigint,
  equity_balances bigint,
  expense_balances bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    COALESCE(sum(balance_xaf) FILTER (WHERE purpose IN (
      'psp_stripe','psp_momo','psp_orange','platform_credit'
    )), 0)::bigint AS asset_balances,
    COALESCE(sum(balance_xaf) FILTER (WHERE purpose IN (
      'user_available','user_payout_clearing','user_refund_clearing',
      'project_escrow','project_retainage','project_materials_escrow',
      'provider_payable','supplier_payable',
      'platform_compliance_hold','platform_suspense'
    )), 0)::bigint AS liability_balances,
    COALESCE(sum(balance_xaf) FILTER (WHERE purpose IN (
      'platform_fees','platform_insurance'
    )), 0)::bigint AS income_balances,
    COALESCE(sum(balance_xaf) FILTER (WHERE purpose = 'platform_equity'), 0)::bigint AS equity_balances,
    COALESCE(sum(balance_xaf) FILTER (WHERE purpose = 'platform_loss'), 0)::bigint AS expense_balances
  FROM public.ledger_accounts;
$$;

-- -----------------------------------------------------------------------------
-- Privileges: harden direct writes; posting only via SECURITY DEFINER
-- -----------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.ledger_purpose_normal_side(public.ledger_account_purpose) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ledger_purpose_allows_negative(public.ledger_account_purpose) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ledger_assert_owner_consistency(public.ledger_account_purpose, public.ledger_owner_type, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ledger_ensure_account(public.ledger_account_purpose, public.ledger_owner_type, uuid, char) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ledger_seed_system_accounts() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ledger_validate_phase3a_matrix(public.ledger_journal_type, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ledger_post_journal(public.ledger_journal_type, text, public.ledger_journal_source, jsonb, uuid, text, uuid, text, char) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ledger_trial_balance() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ledger_verify_journal_equality() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ledger_balance_sheet_probe() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.ledger_purpose_normal_side(public.ledger_account_purpose) TO service_role;
GRANT EXECUTE ON FUNCTION public.ledger_purpose_allows_negative(public.ledger_account_purpose) TO service_role;
GRANT EXECUTE ON FUNCTION public.ledger_ensure_account(public.ledger_account_purpose, public.ledger_owner_type, uuid, char) TO service_role;
GRANT EXECUTE ON FUNCTION public.ledger_seed_system_accounts() TO service_role;
GRANT EXECUTE ON FUNCTION public.ledger_post_journal(public.ledger_journal_type, text, public.ledger_journal_source, jsonb, uuid, text, uuid, text, char) TO service_role;
GRANT EXECUTE ON FUNCTION public.ledger_trial_balance() TO service_role;
GRANT EXECUTE ON FUNCTION public.ledger_verify_journal_equality() TO service_role;
GRANT EXECUTE ON FUNCTION public.ledger_balance_sheet_probe() TO service_role;

-- Direct journal/line/account INSERT/UPDATE revoked from service_role — must use SECURITY DEFINER helpers
REVOKE INSERT ON TABLE public.ledger_journals FROM service_role;
REVOKE INSERT ON TABLE public.ledger_lines FROM service_role;
REVOKE INSERT, UPDATE ON TABLE public.ledger_accounts FROM service_role;

-- service_role retains SELECT for ops/reporting; posted_events keep INSERT/UPDATE for later phases
GRANT SELECT ON TABLE public.ledger_accounts TO service_role;
GRANT SELECT ON TABLE public.ledger_journals TO service_role;
GRANT SELECT ON TABLE public.ledger_lines TO service_role;

COMMENT ON FUNCTION public.ledger_post_journal IS
  'Phase 3A controlled ledger posting. service_role only. Idempotent. No legacy dual-write.';
COMMENT ON FUNCTION public.ledger_seed_system_accounts IS
  'Idempotent seed of platform/PSP zero-balance accounts. No capital injection posted.';
