# C12 Payment-Attempt Threat Model

**Updated:** 2026-09-03 (C12 APPLIED STAGING SCHEMA ONLY `20260903192834`)  
**Scope:** Active migration — **not** PSP, webhooks, or live money  
**Depends on:** C05 `20260902183828`, C06 `20260902191944`, C03 `20260903175839`  
**Decisions:** #33–#38 **FROZEN** (C12-D2)  
**LIVE_MONEY_READY:** NO

## Authority boundary

```text
C05 FUNDING REQUEST  = exact XAF authorization
C03 FX QUOTE         = foreign-source economic terms
C06 PAYMENT          = one logical funding identity
C12 PAYMENT ATTEMPT  = one real provider execution attempt
C11 PROVIDER EVENT   = authenticated external fact
LEDGER               = accounting/cash authority
```

```text
1 funding_request → 1 payment P1 → 0..N attempts
```

## Threat matrix (post C12-R proof)

| Threat | Rating | Notes |
|--------|--------|-------|
| funding_mode bypass | **MITIGATED** | Deferred constraint trigger + wrappers; unclassified COMMIT denied |
| Direct legacy C06 bypass | **MITIGATED** | `authenticated` EXECUTE revoked on `rpc_create_payment_intent`; nested DEFINER wrappers still work |
| Unclassified committed payment | **MITIGATED** | Commit-time `funding_mode IS NOT NULL`; local count 0 |
| Q1 double-consume | **MITIGATED** | A1 binds already-consumed Q1; no second consume |
| Retry quote without failed attempt | **MITIGATED** | C12-aware `rpc_record_fx_quote` requires prior failed/canceled attempt |
| Mode switching | **MITIGATED** | Immutable after NULL→mode |
| Double active attempt | **MITIGATED** | Partial unique index + RPC; two-session proof |
| Duplicate request ID | **MITIGATED** | UNIQUE `attempt_request_id`; mismatch DENY |
| Provider ref overwrite | **MITIGATED** | Attach-once |
| Winner ref promotion partial failure | **MITIGATED** | Single txn; forced ledger abort rolled back psp_ref |
| Atomic success rollback | **MITIGATED** | Forced journal trigger abort; attempt/payment/ledger unchanged |
| Double success | **MITIGATED** | One-succeeded partial unique + C06 journal key; concurrent replay 1 journal |
| Late success on failed attempt | **QUARANTINE / OPEN** | Stable `late_provider_success_requires_reconciliation`; no mutation |
| Quote race | **MITIGATED** | Canonical lock order; no 40P01 |
| Deadlock | **MITIGATED** | request → payment → quote → attempt; two-session 40P01=NO |
| Client fake success | **MITIGATED** | Service-only finalization; PUBLIC/authenticated EXECUTE revoked |
| Double provider HTTP submission | **OPEN** | Stable identity `payment_attempt.id`; orchestration not built |
| Unsigned provider event | **OPEN** | C11 |
| EUR funding / PSP without legal | **BLOCKED** | Decision #13 OPEN |
| Fees via C12 | **NOT APPLICABLE** | C04 |
| Chargeback history mutation | **NOT APPLICABLE** | C09 |

## Readiness

| Flag | Verdict |
|------|---------|
| `C12_R_PASS` | **YES** |
| `C12_SCHEMA_CANDIDATE_EXISTS` | **NO** (promoted) |
| `C12_LOCAL_PROOF_PASS` | **YES** |
| `C12_CANDIDATE_READY` | **YES** |
| `C12_APPLY_READY` | **YES** |
| `C12_SCHEMA_APPLIED` | **YES** (staging schema only) |
| `C12_STAGING_VERIFIED` | **YES** |
| `PSP_INTEGRATED` | **NO** |
| `EUR_FUNDING_ENABLED` | **NO** |
| `LIVE_MONEY_READY` | **NO** |
