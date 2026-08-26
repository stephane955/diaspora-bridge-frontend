-- Phase 3A read-only verification queries (no writes)

-- System accounts seeded at zero (or post-test balances if tests left residue — should be zero after rb)
SELECT purpose, owner_type, owner_id, balance_xaf
FROM ledger_accounts
ORDER BY purpose::text, owner_id NULLS FIRST;

SELECT * FROM ledger_trial_balance();

SELECT * FROM ledger_verify_journal_equality();

SELECT * FROM ledger_balance_sheet_probe();

-- Accounting identity probe (natural sides): assets+expenses vs liabilities+income+equity
-- Not forced equal when PSP/suspense negative; report only.
SELECT
  (SELECT coalesce(sum(balance_xaf),0) FROM ledger_accounts
    WHERE purpose IN ('psp_stripe','psp_momo','psp_orange','platform_credit','platform_loss')) AS debit_normal_sum,
  (SELECT coalesce(sum(balance_xaf),0) FROM ledger_accounts
    WHERE purpose NOT IN ('psp_stripe','psp_momo','psp_orange','platform_credit','platform_loss')) AS credit_normal_sum;

-- Privileges: authenticated/anon must have no ledger table privileges
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema='public'
  AND table_name LIKE 'ledger_%'
  AND grantee IN ('anon','authenticated','service_role')
ORDER BY grantee, table_name, privilege_type;

-- Posting functions exist
SELECT p.proname
FROM pg_proc p
JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname LIKE 'ledger_%'
ORDER BY 1;

-- Legacy untouched sample
SELECT count(*) AS projects FROM projects;
SELECT count(*) AS transactions FROM transactions;
SELECT count(*) AS withdrawals FROM withdrawals;
SELECT id, amount, status FROM withdrawals WHERE id=1;
