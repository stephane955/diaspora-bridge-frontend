# C06 Readiness Contract (review — C06 not in active migrations)

**Purpose:** Prerequisites and object inventory before any C06 APPLY.  
**Does not apply C06.** Staging remains without `payments` until explicit apply.

## Dual gates

| Gate | Meaning | C06-R result |
|------|---------|--------------|
| `C06_SCHEMA_APPLY_READY` | Safe to promote future SQL → active migration + staging schema | **YES** (after review) |
| `C06_LIVE_MONEY_READY` | Real PSP / live funds | **NO** |

## Prerequisites (must be TRUE)

| Check | Expected |
|-------|----------|
| Active migrations | 8 through `20260902183828` C05 |
| `escrow_funding_requests` / `escrow_funder_approvals` | PRESENT |
| Decision #31 | FROZEN request-scoped |
| `payments` | ABSENT until apply |
| Ledger journals / XAF | 0 / 0 |
| Future file | `supabase/future_migrations/c06_phase3b_escrow_funding.sql` |
| C06 not in `supabase/migrations/` | TRUE |

## Expected C06 objects (after future apply)

### Table `payments`

| Column | Role |
|--------|------|
| `id` | identity |
| `project_id` | authorization binding |
| `client_id` | authorization binding (requester) |
| `amount_xaf` | authorization binding (bigint XAF) |
| `psp_provider` | PSP state (`stripe`/`momo`/`orange`) |
| `psp_ref` | PSP state (UNIQUE) |
| `status` | PSP state machine |
| `client_request_id` | = C05 funding request id (UNIQUE) |
| `ledger_journal_id` | accounting linkage (UNIQUE) |
| `created_at` / `updated_at` | metadata |
| `ledger_posted_at` | accounting linkage |

**Status model:** `requires_action` → `processing` → `succeeded` | `failed` | `canceled`  
`succeeded` ≠ ledger posted unless `ledger_journal_id` set.

### RPCs

| Function | Authority |
|----------|-----------|
| `rpc_create_payment_intent` | authenticated |
| `rpc_attach_payment_psp_ref` | service_role |
| `rpc_mark_payment_succeeded` | service_role |
| `rpc_post_escrow_funding` | service_role |
| `rpc_begin_psp_webhook_event` | service_role |
| `rpc_complete_psp_webhook_event` | service_role |

### Accounting (C06-R)

```text
DR psp_{stripe|momo|orange}  amount_xaf
CR project_escrow            amount_xaf
journal_type: escrow_funding
idempotency_key: escrow_funding:{payment_id}
platform fee: 0 (deferred C04)
```

## Live-money blockers (remain NO)

- C03 FX / corridor
- C09 reversals/chargebacks
- C11 signed webhook / edge hardening
- C12 PSP integration + legal
- C13 reconciliation/treasury
- Decision #13 regulatory model

## Tests (disposable local only)

```text
supabase/tests/c06_phase3b_funding.sql
```

Not in CI until C06 is active.
