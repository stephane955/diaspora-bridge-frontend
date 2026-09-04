# C03 FX / Cross-Border Corridor Threat Model

**Updated:** 2026-09-03 (C03 APPLY — staging schema only)  
**Active migration:** `supabase/migrations/20260903175839_c03_fx_quotes_cross_border.sql`  
**C03 applied:** YES — staging schema only  
**C05:** `20260902183828`  
**C06:** `20260902191944`  
**Quote direction:** TARGET-XAF-FIRST  
**Canonical lock order:** funding_request → payment → fx_quote  
**LIVE_MONEY_READY:** NO

| Threat | Rating | Notes |
|--------|--------|-------|
| Circular quote/request authority | **MITIGATED** | Target from C05 |
| Opposing lock order / deadlock | **MITIGATED** | R3.1 one global order; two-session concurrency proof |
| Fake quote consumption without actual attempt | **MITIGATED** | Fresh Q2 + existing P1 → `payment_attempt_required`; Q2 stays usable |
| Post-intent wrapper falsely representing retry | **MITIGATED** | C06 idempotent return does not consume Q2 |
| Requote after PSP success | **MITIGATED** | `rpc_record_fx_quote` DENY |
| Requote after ledger post | **MITIGATED** | DENY when `ledger_journal_id IS NOT NULL` |
| Requote during processing | **MITIGATED** | DENY |
| Requote while requires_action | **MITIGATED** | DENY (default safe) |
| Economic history mutation after capture | **MITIGATED** | Immutability + post-success/ledger DENY |
| Quote issuance vs success race | **MITIGATED** | Payment locked FOR UPDATE before insert; succeed-first → DENY |
| C05 reopening temptation | **MITIGATED** | Forbidden |
| Second logical payment | **MITIGATED** | C06 idempotency + wrapper rules |
| Nested SECURITY DEFINER confusion | **MITIGATED** | Local proof |
| Quote privacy leakage | **MITIGATED** | Requester SELECT only |
| Payment-attempt / quote attribution | **OPEN** | C12_PAYMENT_ATTEMPT_MODEL_REQUIRED |
| Decision #13 legal | **OPEN** | Live blocker |
| Real FX/PSP provider integration | **OPEN** | Live blocker |

## Readiness

| Flag | Verdict |
|------|---------|
| `C03_SCHEMA_APPLIED` | **YES** (staging) |
| `C03_STAGING_VERIFIED` | **YES** |
| `C03_R3_1_PASS` | **YES** |
| `LOCK_ORDER_RUNTIME_PROOF` | **YES** |
| `POST_INTENT_REQUOTE_MODEL_SAFE` | **YES** |
| `EUR_FUNDING_ENABLED` | **NO** |
| `LIVE_MONEY_READY` | **NO** |
