-- =============================================================================
-- Diaspora Bridge — P00 Security Stop-the-Bleeding (staging-safe)
-- Additive only. Does not modify applied Phase 1 / 3A / 5 migrations.
-- Does NOT apply Phase 3B. Does NOT post ledger journals.
-- Target staging minimal schema + future full legacy schema via idempotent DDL.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Project access: split read vs write (observers read-only)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.user_can_read_project(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = p_project_id
      AND (p.owner_id = auth.uid() OR p.assigned_provider_id = auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM public.project_observers o
    WHERE o.project_id = p_project_id AND o.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.user_can_write_project(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = p_project_id
      AND (p.owner_id = auth.uid() OR p.assigned_provider_id = auth.uid())
  );
$$;

COMMENT ON FUNCTION public.user_can_read_project(uuid) IS
  'P00: read access for owner, assigned provider, and observers.';
COMMENT ON FUNCTION public.user_can_write_project(uuid) IS
  'P00: write access for owner and assigned provider only (not observers).';

-- Backward-compatible alias: SELECT policies may still reference this name.
CREATE OR REPLACE FUNCTION public.user_can_access_project(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = pg_catalog, public
AS $$
  SELECT public.user_can_read_project(p_project_id);
$$;

REVOKE ALL ON FUNCTION public.user_can_read_project(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_can_write_project(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_can_access_project(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_can_read_project(uuid) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.user_can_write_project(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_can_access_project(uuid) TO authenticated, service_role, anon;

-- Milestones: observers may SELECT, not INSERT/UPDATE
DROP POLICY IF EXISTS "milestones_insert" ON public.milestones;
DROP POLICY IF EXISTS "milestones_update" ON public.milestones;
CREATE POLICY "milestones_insert" ON public.milestones
  FOR INSERT WITH CHECK (public.user_can_write_project(project_id));
CREATE POLICY "milestones_update" ON public.milestones
  FOR UPDATE USING (public.user_can_write_project(project_id));

-- -----------------------------------------------------------------------------
-- 2. Freeze legacy financial tables (transactions, withdrawals)
-- -----------------------------------------------------------------------------

ALTER TABLE IF EXISTS public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.withdrawals ENABLE ROW LEVEL SECURITY;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.transactions FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.withdrawals FROM anon, authenticated;

-- Deny client SELECT on legacy tables (balance via ledger RPC instead).
-- No permissive policies on transactions.

-- -----------------------------------------------------------------------------
-- 3. Admin authorization foundation
-- -----------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'platform_admin_role') THEN
    CREATE TYPE public.platform_admin_role AS ENUM (
      'support',
      'kyc_reviewer',
      'compliance',
      'treasury',
      'treasury_approver',
      'super_admin',
      'auditor'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.platform_admin_role NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

COMMENT ON TABLE public.platform_admins IS
  'P00: server-side admin authorization. No default seed rows.';

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.platform_admins FROM anon, authenticated;
GRANT SELECT ON TABLE public.platform_admins TO service_role;

CREATE OR REPLACE FUNCTION public.has_admin_role(p_required public.platform_admin_role DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_admins a
    WHERE a.user_id = auth.uid()
      AND a.is_active
      AND (
        a.role = 'super_admin'::public.platform_admin_role
        OR p_required IS NULL
        OR a.role = p_required
      )
  );
$$;

REVOKE ALL ON FUNCTION public.has_admin_role(public.platform_admin_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_admin_role(public.platform_admin_role) TO authenticated, service_role;

-- Admin read-only on withdrawals (no client UPDATE until C08)
GRANT SELECT ON TABLE public.withdrawals TO authenticated;
DROP POLICY IF EXISTS "withdrawals_admin_select" ON public.withdrawals;
CREATE POLICY "withdrawals_admin_select" ON public.withdrawals
  FOR SELECT USING (public.has_admin_role('treasury'::public.platform_admin_role)
                 OR public.has_admin_role('super_admin'::public.platform_admin_role));

-- -----------------------------------------------------------------------------
-- 4. Profile privacy (staging-minimal + safe public view)
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT USING (id = auth.uid());

DROP VIEW IF EXISTS public.profiles_public;
CREATE VIEW public.profiles_public
WITH (security_invoker = true) AS
SELECT p.id
FROM public.profiles p;

COMMENT ON VIEW public.profiles_public IS
  'P00: minimal public profile (staging). Expand whitelisted columns in P01 when marketplace fields exist.';

GRANT SELECT ON public.profiles_public TO authenticated, anon;

-- -----------------------------------------------------------------------------
-- 5. Read-only ledger balance RPC (no writes)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_get_user_available_balance()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT COALESCE(
    (
      SELECT a.balance_xaf::text
      FROM public.ledger_accounts a
      WHERE a.purpose = 'user_available'::public.ledger_account_purpose
        AND a.owner_type = 'user'::public.ledger_owner_type
        AND a.owner_id = auth.uid()
      LIMIT 1
    ),
    '0'
  );
$$;

REVOKE ALL ON FUNCTION public.rpc_get_user_available_balance() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_get_user_available_balance() TO authenticated;

-- -----------------------------------------------------------------------------
-- 6. Ledger healthcheck (service_role; alert transport deferred)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ledger_healthcheck()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT jsonb_build_object(
    'journal_count', (SELECT count(*)::bigint FROM public.ledger_journals),
    'line_count', (SELECT count(*)::bigint FROM public.ledger_lines),
    'total_debit_xaf', COALESCE((SELECT sum(debit_xaf) FROM public.ledger_lines), 0)::bigint,
    'total_credit_xaf', COALESCE((SELECT sum(credit_xaf) FROM public.ledger_lines), 0)::bigint,
    'is_journal_balanced',
      COALESCE((SELECT sum(debit_xaf) FROM public.ledger_lines), 0)
      = COALESCE((SELECT sum(credit_xaf) FROM public.ledger_lines), 0),
    'sum_account_balance_xaf', COALESCE((SELECT sum(balance_xaf) FROM public.ledger_accounts), 0)::bigint,
    'checked_at', now()
  );
$$;

REVOKE ALL ON FUNCTION public.ledger_healthcheck() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ledger_healthcheck() TO service_role;

COMMENT ON FUNCTION public.ledger_healthcheck() IS
  'P00: read-only ledger invariant probe. Alert transport not configured (P0.8 PARTIAL).';

-- -----------------------------------------------------------------------------
-- 7. Future tables: document write predicates (P01 will CREATE TABLE)
-- -----------------------------------------------------------------------------

COMMENT ON FUNCTION public.user_can_write_project(uuid) IS
  'Use for project_expenses INSERT/UPDATE when that table exists (P01). Observers denied.';
