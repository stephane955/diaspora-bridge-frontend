# C05 Readiness Contract (static — runs against P01 baseline without C05 installed)

**Purpose:** Verify prerequisites before any C05 apply.  
**Does not create** `escrow_funder_approvals` / `escrow_funding_requests`.  
**Staging:** read-only. Local: after `supabase db reset --local`.

## Decision #31 (FROZEN)

```text
MULTI-FUNDER FUNDING APPROVAL IS REQUEST-SCOPED, NOT PROJECT-SCOPED.
```

| Property | Value |
|----------|-------|
| scope | funding_request |
| project_bound | true |
| request_id_bound | true (= C06 `client_request_id`) |
| requested_by_bound | true |
| amount_xaf_bound | true |
| approval_window | 72h |
| quorum | N-of-N current co-funders (`funder_ids`) |
| threshold | distinct count ≥ 1 requires approvals; 0 → none |
| consumption | payment intent creation |
| reuse across requests/amounts | forbidden |
| release_authority | none |

## Prerequisites (must be TRUE on staging + clean local)

| Check | Expected |
|-------|----------|
| Active migrations | 7 identities through `20260902162321` |
| `public.projects` | exists |
| `projects.funder_ids` | `uuid[] NOT NULL DEFAULT '{}'` |
| `user_can_write_project` / `user_can_access_project` | exist (P00) |
| `payments` | ABSENT |
| `escrow_funder_approvals` | ABSENT (until C05 apply) |
| `escrow_funding_requests` | ABSENT (until C05 apply) |
| `rpc_release_milestone` | ABSENT |
| Ledger journals / lines / balance | 0 / 0 / 0 XAF |
| Future file | `supabase/future_migrations/c05_phase3b0_multisig_approvals.sql` |
| C06 future file | `supabase/future_migrations/c06_phase3b_escrow_funding.sql` |
| C05 not in `supabase/migrations/` | TRUE |
| Old identity `20260826110000` not active | TRUE |

## C06 static dependency (do not apply)

| C06 function | C05 dependency | When |
|--------------|----------------|------|
| `rpc_create_payment_intent` | `escrow_funding_requests` + `escrow_all_funders_approved_for_request` | Always requires request; N-of-N if co-funders ≥ 1 |
| `rpc_post_escrow_funding` | **none** | Posts after payment `succeeded` |
| consume | `escrow_mark_funding_request_consumed` | Same txn as intent insert |

## Authoritative artifacts

- `supabase/tests/c05_phase3b0_multisig.sql`
- `supabase/tests/c05_c06_funding_integration.sql`
- `docs/C05_MULTISIG_THREAT_MODEL.md`
- `docs/C05_C06_COMPATIBILITY_REVIEW.md`

## SQL probe (read-only)

```sql
SELECT to_regclass('public.escrow_funder_approvals') IS NULL AS efa_absent;
SELECT to_regclass('public.escrow_funding_requests') IS NULL AS efr_absent;
SELECT to_regclass('public.payments') IS NULL AS payments_absent;
```
