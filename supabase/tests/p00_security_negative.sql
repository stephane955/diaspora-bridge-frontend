-- =============================================================================
-- P00 Security — negative tests (run against staging with rollback)
-- Usage: psql ... -v ON_ERROR_STOP=1 -f supabase/tests/p00_security_negative.sql
-- =============================================================================

BEGIN;

-- Fixture: two auth users would be required for full RLS tests.
-- These tests verify deny-by-default without authenticated JWT (anon role).

SET LOCAL ROLE anon;

DO $$
BEGIN
  BEGIN
    INSERT INTO public.transactions DEFAULT VALUES;
    RAISE EXCEPTION 'P00 FAIL: anon INSERT into transactions should be denied';
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN
    NULL;
  WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%permission denied%' AND SQLERRM NOT LIKE '%violates row-level security%' THEN
      RAISE;
    END IF;
  END;
END $$;

DO $$
BEGIN
  BEGIN
    INSERT INTO public.withdrawals (amount, status) VALUES (1000, 'pending');
    RAISE EXCEPTION 'P00 FAIL: anon INSERT into withdrawals should be denied';
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN
    NULL;
  WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%permission denied%' AND SQLERRM NOT LIKE '%violates row-level security%' THEN
      RAISE;
    END IF;
  END;
END $$;

-- Ledger tables remain deny-by-default for anon
DO $$
BEGIN
  BEGIN
    INSERT INTO public.ledger_accounts (purpose, owner_type, owner_id, currency, balance_xaf)
    VALUES ('user_available', 'user', gen_random_uuid(), 'XAF', 0);
    RAISE EXCEPTION 'P00 FAIL: anon INSERT into ledger_accounts should be denied';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END $$;

RESET ROLE;

-- Schema objects exist
DO $$
BEGIN
  IF to_regclass('public.platform_admins') IS NULL THEN
    RAISE EXCEPTION 'P00 FAIL: platform_admins missing';
  END IF;
  IF to_regprocedure('public.has_admin_role(public.platform_admin_role)') IS NULL THEN
    RAISE EXCEPTION 'P00 FAIL: has_admin_role missing';
  END IF;
  IF to_regprocedure('public.rpc_get_user_available_balance()') IS NULL THEN
    RAISE EXCEPTION 'P00 FAIL: rpc_get_user_available_balance missing';
  END IF;
  IF to_regprocedure('public.ledger_healthcheck()') IS NULL THEN
    RAISE EXCEPTION 'P00 FAIL: ledger_healthcheck missing';
  END IF;
  IF to_regprocedure('public.user_can_write_project(uuid)') IS NULL THEN
    RAISE EXCEPTION 'P00 FAIL: user_can_write_project missing';
  END IF;
END $$;

ROLLBACK;

SELECT 'p00_security_negative.sql: PASS (anon deny + objects present)' AS result;
