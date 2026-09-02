# P01 Migration Inventory

```yaml
generated: 2026-09-02
last_verified: 2026-09-02
repo_commit: be1af5a0333a0b75867fdc60c6f8bb7670558e54
staging_ref: tvorurbmzrpwvxwztpix
```

## Summary counts

| Category | Count |
|----------|------:|
| Active migrations (`supabase/migrations/`) | 6 |
| Legacy archived (`supabase/legacy/`) | 21 |
| Future phase (`supabase/future_migrations/`) | 2 |
| Staging reference (`supabase/staging/`) | 1 |
| SQL test files (`supabase/tests/`) | 5+ |

## Active migration chain (intended reset order)

| FILE | VERSION | ACTIVE | APPLIED STAGING | STATUS | TARGET ACTION |
|------|---------|--------|-----------------|--------|---------------|
| `20260812000000_p01_minimal_bootstrap.sql` | 20260812000000 | YES | pending | AUTHORITATIVE_PENDING_P01 | KEEP_ACTIVE — idempotent on existing staging |
| `20260813_phase1_ledger.sql` | 20260813 | YES | YES | AUTHORITATIVE_APPLIED | KEEP_ACTIVE |
| `20260826100000_phase3a_ledger_posting.sql` | 20260826100000 | YES | YES | AUTHORITATIVE_APPLIED | KEEP_ACTIVE |
| `20260902100000_phase5_canonical_money.sql` | 20260902100000 | YES | YES | AUTHORITATIVE_APPLIED | KEEP_ACTIVE |
| `20260902122609_p00_security_lockdown.sql` | 20260902122609 | YES | YES | AUTHORITATIVE_APPLIED | KEEP_ACTIVE (local renamed to match staging) |
| `20260902140000_p01_core_app_schema.sql` | 20260902140000 | YES | pending | AUTHORITATIVE_PENDING_P01 | KEEP_ACTIVE — apply staging |

## Future migrations (NOT in reset)

| FILE | STATUS | ACTION |
|------|--------|--------|
| `future_migrations/c05_phase3b0_multisig_approvals.sql` | FUTURE_PHASE | DO_NOT_APPLY until C05 review |
| `future_migrations/c06_phase3b_escrow_funding.sql` | FUTURE_PHASE / DANGEROUS if auto-applied | DO_NOT_APPLY until C06 |

## Legacy archive (NOT in reset)

| FILE | STATUS | PROBLEM | ACTION |
|------|--------|---------|--------|
| `legacy/monopoly_ecosystem.sql` | LEGACY / DANGEROUS | `release_milestone(p_amount)`, financial triggers | MOVE_LEGACY ✅ |
| `legacy/rls_and_auth.sql` | LEGACY | profiles SELECT true; observer writes | MOVE_LEGACY ✅ |
| `legacy/triggers_and_webhooks.sql` | LEGACY | open webhook_outbox | MOVE_LEGACY ✅ |
| `legacy/compliance_aml_escrow_insurance.sql` | PARTIALLY_REUSABLE | escrow_funder_approvals DDL | MOVE_FUTURE reference |
| `legacy/apex_enterprise_schema.sql` | PARTIALLY_REUSABLE | table shapes for P01 | EXTRACT → P01 ✅ |
| *(19 other legacy files)* | HISTORICAL | duplicate/competing models | MOVE_LEGACY ✅ |

## P00 version identity

| | Value |
|---|-------|
| LOCAL VERSION (before) | `20260902120000_p00_security_lockdown.sql` |
| REMOTE VERSION | `20260902122609_p00_security_lockdown` |
| SQL/EFFECTS MATCH | YES — same file content; timestamp aligned locally |
| HISTORY ALIGNED | YES — local renamed to `20260902122609` |
| REMOTE REPAIR | NOT REQUIRED |

## Financial behavior guardrails (all active migrations)

- **No** ledger journal posting in P01
- **No** payments / escrow_funder_approvals creation
- **No** release_milestone recreation
- transactions/withdrawals remain write-frozen (P00 preserved)
