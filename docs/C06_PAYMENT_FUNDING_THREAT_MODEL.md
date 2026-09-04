# C06 Payment Intent + Escrow Funding Threat Model

**Updated:** 2026-09-03 (R00.2 post-C06)  
**Active migration:** `supabase/migrations/20260902191944_c06_phase3b_payment_intent_escrow_funding.sql`  
**C05 staging:** `20260902183828` (applied)  
**C06 applied:** YES — `20260902191944` — schema only  
**Live money:** NO  
**Currency model:** XAF-only infrastructure (C03 FX not built)

Ratings: **BLOCKED** | **MITIGATED** | **OPEN** | **NOT APPLICABLE**

| Threat | Rating | Notes |
|--------|--------|-------|
| Fake payment intent | MITIGATED | auth.uid(); C05 request binding; may-fund check |
| Request-ID replay (same fields) | MITIGATED | Idempotent return of same payment |
| Amount substitution | MITIGATED | Intent + request exact amount match |
| Requester substitution | MITIGATED | requested_by / client_id = auth.uid() |
| PSP provider substitution on retry | MITIGATED | Immutable match on existing payment |
| Fake PSP success (client) | MITIGATED | `rpc_mark_payment_succeeded` service_role only |
| PSP reference overwrite | MITIGATED | Different ref rejected; same ref idempotent |
| Webhook replay | MITIGATED | `ledger_posted_events.psp_event_id` UNIQUE + begin/complete |
| Duplicate ledger post | MITIGATED | `ledger_journal_id` UNIQUE; idempotency_key `escrow_funding:{payment_id}` |
| Concurrent ledger post | MITIGATED | FOR UPDATE + unique keys |
| Payment success but ledger failure | MITIGATED* | status can be succeeded with null journal; retry post. *Needs C13 ops visibility |
| Ledger post without PSP success | MITIGATED | Requires status=succeeded |
| Cross-project funding | MITIGATED | Request/project binding |
| Hardcoded fee theft/deduction | **MITIGATED** (C06-R) | 1.5%/insurance removed; gross → escrow; fees → C04 |
| Insurance semantics | **MITIGATED** | Not posted in C06 path (Decision #21 OPEN / C04) |
| Foreign-currency confusion | MITIGATED | amount_xaf + mark-succeeded requires currency XAF |
| Captured-but-unbooked money | MITIGATED* | No C05 re-check at post; retryable post. *Live money needs C11/C13 |
| Cross-provider event-ID collision | **MITIGATED** | Canonical `provider:raw` via `ledger_canonical_psp_event_id` |
| Cross-provider PSP-ref collision | **MITIGATED** | `UNIQUE(psp_provider, psp_ref)` |
| Chargeback after funding | **OPEN** | C09 — blocks LIVE MONEY |
| Unsigned public webhook edge | **OPEN** | C11 — blocks LIVE MONEY |
| FX / EUR corridor | **OPEN** | C03 — blocks LIVE MONEY |
| Reconciliation/treasury | **OPEN** | C13 — blocks LIVE MONEY |
| Legal/regulatory | **OPEN** | Decision #13 — blocks LIVE MONEY |

## Dual readiness (post C06 APPLY)

| Flag | Verdict |
|------|---------|
| `C06_SCHEMA_APPLIED` | **YES** (`20260902191944`) |
| `C06_LIVE_MONEY_READY` | **NO** |
