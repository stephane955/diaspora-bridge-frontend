-- =============================================================================
-- Diaspora Bridge — C05 Phase 3B.0 request-scoped FUNDING approvals
-- Active migration: 20260902183828_c05_phase3b0_request_scoped_multisig.sql
-- Promoted from future_migrations/c05_phase3b0_multisig_approvals.sql (C05-R2; semantic identical)
--
-- Decision #31 (FROZEN): multi-funder funding approval is REQUEST-SCOPED.
-- A co-funder approval authorizes exactly one funding request:
--   project + requested_by + exact amount_xaf + funding_request_id (= C06 client_request_id)
-- Consumption: first successful rpc_create_payment_intent (C06) — not PSP / ledger.
-- Does NOT authorize release, payout, dispute, or ledger posting (Decision #18 OPEN).
--
-- approval_signature_hash: REMOVED (no verified crypto protocol; avoid security theater).
-- Request expiry column: NOT added; 72h approval freshness is the gate.
-- =============================================================================

-- Prerequisite column (no-op if present from P01 bootstrap)
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS funder_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];

COMMENT ON COLUMN public.projects.funder_ids IS
  'Co-funder roster for funding multisig (C05). Owner is NOT required to appear here. '
  'Client UPDATE of this column is blocked; use rpc_set_project_funders (add-only).';

-- ---------------------------------------------------------------------------
-- Funding request (immutable financial scope; id = C06 client_request_id)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.escrow_funding_requests (
  id uuid PRIMARY KEY, -- caller-supplied; equals payments.client_request_id in C06
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  amount_xaf bigint NOT NULL CHECK (amount_xaf > 0),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'consumed', 'revoked')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  consumed_at timestamptz,
  CONSTRAINT escrow_funding_requests_consumed_chk CHECK (
    (status = 'consumed' AND consumed_at IS NOT NULL)
    OR (status <> 'consumed' AND consumed_at IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_escrow_funding_requests_project
  ON public.escrow_funding_requests (project_id);

CREATE INDEX IF NOT EXISTS idx_escrow_funding_requests_requested_by
  ON public.escrow_funding_requests (requested_by);

CREATE INDEX IF NOT EXISTS idx_escrow_funding_requests_project_status
  ON public.escrow_funding_requests (project_id, status);

COMMENT ON TABLE public.escrow_funding_requests IS
  'C05 request-scoped funding authorization identity. '
  'PROJECT PARTICIPATION ≠ FUNDING REQUEST AUTHORIZATION ≠ PAYMENT INTENT ≠ PSP ≠ LEDGER ≠ RELEASE. '
  'id is the immutable bridge to C06 payments.client_request_id.';

ALTER TABLE public.escrow_funding_requests ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Approvals (per request × funder)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.escrow_funder_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funding_request_id uuid NOT NULL
    REFERENCES public.escrow_funding_requests(id) ON DELETE RESTRICT,
  funder_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  approved_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT escrow_funder_approvals_request_funder_uidx
    UNIQUE (funding_request_id, funder_id)
);

CREATE INDEX IF NOT EXISTS idx_escrow_funder_approvals_request
  ON public.escrow_funder_approvals (funding_request_id);

CREATE INDEX IF NOT EXISTS idx_escrow_funder_approvals_funder
  ON public.escrow_funder_approvals (funder_id);

CREATE INDEX IF NOT EXISTS idx_escrow_funder_approvals_request_approved_at
  ON public.escrow_funder_approvals (funding_request_id, approved_at);

COMMENT ON TABLE public.escrow_funder_approvals IS
  'Request-scoped FUNDING approvals (N-of-N current co-funders, 72h). '
  'Not release/payout authority. Direct client writes denied — use RPCs.';

ALTER TABLE public.escrow_funder_approvals ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Participant helper (SELECT privacy)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.escrow_is_funding_request_participant(p_request_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_project uuid;
  v_requester uuid;
  v_owner uuid;
  v_funders uuid[];
BEGIN
  IF v_uid IS NULL OR p_request_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT r.project_id, r.requested_by, p.owner_id,
         ARRAY(SELECT DISTINCT x FROM unnest(COALESCE(p.funder_ids, ARRAY[]::uuid[])) AS x WHERE x IS NOT NULL)
    INTO v_project, v_requester, v_owner, v_funders
  FROM public.escrow_funding_requests r
  JOIN public.projects p ON p.id = r.project_id
  WHERE r.id = p_request_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  RETURN v_uid = v_requester
      OR v_uid = v_owner
      OR v_uid = ANY (v_funders);
END;
$$;

COMMENT ON FUNCTION public.escrow_is_funding_request_participant(uuid) IS
  'C05: requester, project owner, or current co-funder may see request/approvals.';

REVOKE ALL ON FUNCTION public.escrow_is_funding_request_participant(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.escrow_is_funding_request_participant(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS — SELECT only for participants; mutations via DEFINER RPCs
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "escrow_funding_requests_select" ON public.escrow_funding_requests;
DROP POLICY IF EXISTS "escrow_funding_requests_insert" ON public.escrow_funding_requests;
DROP POLICY IF EXISTS "escrow_funding_requests_update" ON public.escrow_funding_requests;
DROP POLICY IF EXISTS "escrow_funding_requests_delete" ON public.escrow_funding_requests;

CREATE POLICY "escrow_funding_requests_select" ON public.escrow_funding_requests
  FOR SELECT USING (public.escrow_is_funding_request_participant(id));

DROP POLICY IF EXISTS "escrow_funder_approvals_select" ON public.escrow_funder_approvals;
DROP POLICY IF EXISTS "escrow_funder_approvals_insert" ON public.escrow_funder_approvals;
DROP POLICY IF EXISTS "escrow_funder_approvals_update" ON public.escrow_funder_approvals;
DROP POLICY IF EXISTS "escrow_funder_approvals_delete" ON public.escrow_funder_approvals;

CREATE POLICY "escrow_funder_approvals_select" ON public.escrow_funder_approvals
  FOR SELECT USING (public.escrow_is_funding_request_participant(funding_request_id));

REVOKE ALL ON TABLE public.escrow_funding_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.escrow_funding_requests TO authenticated, service_role;

REVOKE ALL ON TABLE public.escrow_funder_approvals FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.escrow_funder_approvals TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Immutability triggers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.escrow_funding_requests_before_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.project_id IS DISTINCT FROM OLD.project_id
       OR NEW.requested_by IS DISTINCT FROM OLD.requested_by
       OR NEW.amount_xaf IS DISTINCT FROM OLD.amount_xaf
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'escrow_funding_requests identity/amount fields are immutable'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS escrow_funding_requests_before_write_trg ON public.escrow_funding_requests;
CREATE TRIGGER escrow_funding_requests_before_write_trg
  BEFORE UPDATE ON public.escrow_funding_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.escrow_funding_requests_before_write();

REVOKE ALL ON FUNCTION public.escrow_funding_requests_before_write() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.escrow_funder_approvals_before_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.funding_request_id IS DISTINCT FROM OLD.funding_request_id
       OR NEW.funder_id IS DISTINCT FROM OLD.funder_id
       OR NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'escrow_funder_approvals funding_request_id/funder_id/id are immutable'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  NEW.approved_at := clock_timestamp();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS escrow_funder_approvals_before_write_trg ON public.escrow_funder_approvals;
CREATE TRIGGER escrow_funder_approvals_before_write_trg
  BEFORE INSERT OR UPDATE ON public.escrow_funder_approvals
  FOR EACH ROW
  EXECUTE FUNCTION public.escrow_funder_approvals_before_write();

REVOKE ALL ON FUNCTION public.escrow_funder_approvals_before_write() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Roster protection (unchanged posture from C05-R)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.projects_protect_funder_ids()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_role text;
BEGIN
  IF NEW.funder_ids IS NOT DISTINCT FROM OLD.funder_ids THEN
    RETURN NEW;
  END IF;

  v_role := NULLIF(current_setting('request.jwt.claim.role', true), '');
  BEGIN
    IF v_role IS NULL AND to_regprocedure('auth.jwt()') IS NOT NULL THEN
      v_role := NULLIF(auth.jwt()->>'role', '');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_role := NULL;
  END;

  IF v_role IS DISTINCT FROM 'service_role'
     AND NOT EXISTS (
       SELECT 1 FROM pg_roles
       WHERE rolname = SESSION_USER
         AND (rolsuper OR rolbypassrls OR rolname IN ('postgres', 'supabase_admin'))
     )
     AND current_setting('diaspora.c05_allow_funder_ids_write', true) IS DISTINCT FROM 'on'
  THEN
    RAISE EXCEPTION
      'projects.funder_ids cannot be changed via client UPDATE; use rpc_set_project_funders'
      USING ERRCODE = '42501';
  END IF;

  NEW.funder_ids := COALESCE(
    ARRAY(SELECT DISTINCT x FROM unnest(NEW.funder_ids) AS x WHERE x IS NOT NULL),
    ARRAY[]::uuid[]
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS projects_protect_funder_ids_trg ON public.projects;
CREATE TRIGGER projects_protect_funder_ids_trg
  BEFORE UPDATE OF funder_ids ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.projects_protect_funder_ids();

REVOKE ALL ON FUNCTION public.projects_protect_funder_ids() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.rpc_set_project_funders(
  p_project_id uuid,
  p_funder_ids uuid[]
)
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_old uuid[];
  v_new uuid[];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT owner_id, COALESCE(funder_ids, ARRAY[]::uuid[])
    INTO v_owner, v_old
  FROM public.projects
  WHERE id = p_project_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'project not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_owner IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'only project owner may set funder_ids' USING ERRCODE = '42501';
  END IF;

  v_old := ARRAY(SELECT DISTINCT x FROM unnest(v_old) AS x WHERE x IS NOT NULL);
  v_new := ARRAY(SELECT DISTINCT x FROM unnest(COALESCE(p_funder_ids, ARRAY[]::uuid[])) AS x WHERE x IS NOT NULL);

  IF NOT (v_old <@ v_new) THEN
    RAISE EXCEPTION 'funder_ids shrink/replace forbidden (add-only); revoke+ops path required to remove'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM set_config('diaspora.c05_allow_funder_ids_write', 'on', true);
  UPDATE public.projects
  SET funder_ids = v_new
  WHERE id = p_project_id;

  RETURN v_new;
END;
$$;

COMMENT ON FUNCTION public.rpc_set_project_funders(uuid, uuid[]) IS
  'C05: owner sets co-funder roster (distinct, add-only). Does not authorize release.';

REVOKE ALL ON FUNCTION public.rpc_set_project_funders(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_set_project_funders(uuid, uuid[]) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- May-fund helper (owner OR current co-funder)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.escrow_caller_may_fund_project(p_project_id uuid, p_uid uuid)
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

  SELECT owner_id,
         ARRAY(SELECT DISTINCT x FROM unnest(COALESCE(funder_ids, ARRAY[]::uuid[])) AS x WHERE x IS NOT NULL)
    INTO v_owner, v_funders
  FROM public.projects
  WHERE id = p_project_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  RETURN (p_uid = v_owner) OR (p_uid = ANY (v_funders));
END;
$$;

REVOKE ALL ON FUNCTION public.escrow_caller_may_fund_project(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.escrow_caller_may_fund_project(uuid, uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Create funding request
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_create_funding_request(
  p_project_id uuid,
  p_amount_xaf bigint,
  p_client_request_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.escrow_funding_requests%ROWTYPE;
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

  IF NOT public.escrow_caller_may_fund_project(p_project_id, v_uid) THEN
    RAISE EXCEPTION 'not authorized to fund this project' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.projects WHERE id = p_project_id) THEN
    RAISE EXCEPTION 'project not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_row
  FROM public.escrow_funding_requests
  WHERE id = p_client_request_id;

  IF FOUND THEN
    IF v_row.project_id IS DISTINCT FROM p_project_id
       OR v_row.requested_by IS DISTINCT FROM v_uid
       OR v_row.amount_xaf IS DISTINCT FROM p_amount_xaf THEN
      RAISE EXCEPTION 'client_request_id already used with different scope'
        USING ERRCODE = 'P0001';
    END IF;
    RETURN jsonb_build_object(
      'funding_request_id', v_row.id,
      'status', v_row.status,
      'idempotent_replay', true
    );
  END IF;

  BEGIN
    INSERT INTO public.escrow_funding_requests (
      id, project_id, requested_by, amount_xaf, status
    ) VALUES (
      p_client_request_id, p_project_id, v_uid, p_amount_xaf, 'pending'
    )
    RETURNING * INTO v_row;
  EXCEPTION
    WHEN unique_violation THEN
      SELECT * INTO v_row FROM public.escrow_funding_requests WHERE id = p_client_request_id;
      IF v_row.project_id IS DISTINCT FROM p_project_id
         OR v_row.requested_by IS DISTINCT FROM v_uid
         OR v_row.amount_xaf IS DISTINCT FROM p_amount_xaf THEN
        RAISE EXCEPTION 'client_request_id already used with different scope'
          USING ERRCODE = 'P0001';
      END IF;
      RETURN jsonb_build_object(
        'funding_request_id', v_row.id,
        'status', v_row.status,
        'idempotent_replay', true
      );
  END;

  RETURN jsonb_build_object(
    'funding_request_id', v_row.id,
    'status', v_row.status,
    'idempotent_replay', false
  );
END;
$$;

COMMENT ON FUNCTION public.rpc_create_funding_request(uuid, bigint, uuid) IS
  'C05: create request-scoped funding authorization (requested_by=auth.uid()). '
  'id = C06 client_request_id. Does not create payments or post ledger.';

REVOKE ALL ON FUNCTION public.rpc_create_funding_request(uuid, bigint, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_create_funding_request(uuid, bigint, uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Approve / revoke (own approval only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_approve_funding_request(p_funding_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_req public.escrow_funding_requests%ROWTYPE;
  v_funders uuid[];
  v_at timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_req
  FROM public.escrow_funding_requests
  WHERE id = p_funding_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'funding request not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_req.status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'funding request is not pending (cannot approve)'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT ARRAY(
           SELECT DISTINCT x
           FROM unnest(COALESCE(p.funder_ids, ARRAY[]::uuid[])) AS x
           WHERE x IS NOT NULL
         )
    INTO v_funders
  FROM public.projects p
  WHERE p.id = v_req.project_id;

  IF NOT (v_uid = ANY (v_funders)) THEN
    RAISE EXCEPTION 'only current co-funders may approve' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.escrow_funder_approvals (funding_request_id, funder_id)
  VALUES (p_funding_request_id, v_uid)
  ON CONFLICT (funding_request_id, funder_id) DO UPDATE
    SET approved_at = clock_timestamp() -- trigger also forces server clock
  RETURNING approved_at INTO v_at;

  RETURN jsonb_build_object(
    'funding_request_id', p_funding_request_id,
    'funder_id', v_uid,
    'approved_at', v_at
  );
END;
$$;

COMMENT ON FUNCTION public.rpc_approve_funding_request(uuid) IS
  'C05: UPSERT own approval for a pending funding request; approved_at server clock.';

REVOKE ALL ON FUNCTION public.rpc_approve_funding_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_approve_funding_request(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.rpc_revoke_funding_approval(p_funding_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_status text;
  v_deleted int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT status INTO v_status
  FROM public.escrow_funding_requests
  WHERE id = p_funding_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'funding request not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'cannot revoke approval after request consumption/revocation'
      USING ERRCODE = 'P0001';
  END IF;

  DELETE FROM public.escrow_funder_approvals
  WHERE funding_request_id = p_funding_request_id
    AND funder_id = v_uid;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN jsonb_build_object(
    'funding_request_id', p_funding_request_id,
    'revoked', v_deleted > 0
  );
END;
$$;

COMMENT ON FUNCTION public.rpc_revoke_funding_approval(uuid) IS
  'C05: revoke own approval while request is pending. After consumption, DENY.';

REVOKE ALL ON FUNCTION public.rpc_revoke_funding_approval(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_revoke_funding_approval(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- N-of-N helper for a specific funding request (current roster + 72h)
-- ---------------------------------------------------------------------------
-- Drop historical project-scoped helper if present (unapplied; safe rename)
DROP FUNCTION IF EXISTS public.escrow_all_funders_approved(uuid);

CREATE OR REPLACE FUNCTION public.escrow_all_funders_approved_for_request(p_funding_request_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_project uuid;
  v_status text;
  v_funders uuid[];
  v_needed int;
  v_ok int;
BEGIN
  SELECT project_id, status
    INTO v_project, v_status
  FROM public.escrow_funding_requests
  WHERE id = p_funding_request_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Helper answers "are current co-funders approved for this request?"
  -- Consumption/idempotency is C06's responsibility; consumed still returns
  -- roster/approval truth for diagnostics, but C06 does not re-check after intent.

  SELECT ARRAY(
           SELECT DISTINCT x
           FROM unnest(COALESCE(funder_ids, ARRAY[]::uuid[])) AS x
           WHERE x IS NOT NULL
         )
    INTO v_funders
  FROM public.projects
  WHERE id = v_project;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  v_needed := COALESCE(cardinality(v_funders), 0);
  IF v_needed = 0 THEN
    RETURN true; -- no co-funders → no co-funder approval required
  END IF;

  SELECT COUNT(*)::integer
    INTO v_ok
  FROM unnest(v_funders) AS f(fid)
  WHERE EXISTS (
    SELECT 1
    FROM public.escrow_funder_approvals a
    WHERE a.funding_request_id = p_funding_request_id
      AND a.funder_id = f.fid
      AND a.approved_at >= (clock_timestamp() - interval '72 hours')
  );

  RETURN v_ok = v_needed;
END;
$$;

COMMENT ON FUNCTION public.escrow_all_funders_approved_for_request(uuid) IS
  'FUNDING gate only (C05/C06). Distinct non-null projects.funder_ids; card=0 → true; '
  'card>=1 → each current co-funder has approval on THIS request within 72h. '
  'NOT release/payout. C06 checks when distinct co-funder count >= 1 at intent create.';

REVOKE ALL ON FUNCTION public.escrow_all_funders_approved_for_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.escrow_all_funders_approved_for_request(uuid) TO authenticated, service_role;

-- Mark request consumed (C06 calls inside same txn as payment insert)
CREATE OR REPLACE FUNCTION public.escrow_mark_funding_request_consumed(p_funding_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_status text;
BEGIN
  SELECT status INTO v_status
  FROM public.escrow_funding_requests
  WHERE id = p_funding_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'funding request not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_status = 'consumed' THEN
    RETURN; -- idempotent
  END IF;

  IF v_status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'funding request cannot be consumed from status %', v_status
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.escrow_funding_requests
  SET status = 'consumed',
      consumed_at = clock_timestamp()
  WHERE id = p_funding_request_id;
END;
$$;

COMMENT ON FUNCTION public.escrow_mark_funding_request_consumed(uuid) IS
  'C05/C06: mark funding request consumed at payment intent creation. Not for clients.';

REVOKE ALL ON FUNCTION public.escrow_mark_funding_request_consumed(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.escrow_mark_funding_request_consumed(uuid) TO service_role;
-- C06 rpc_create_payment_intent is SECURITY DEFINER (table owner / postgres) and may call this.

-- Explicit: C05 creates no payments, journals, or release objects.
