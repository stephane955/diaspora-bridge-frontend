# C03 Readiness Contract

**Status:** Applied staging schema checklist (regression).  
**Updated:** 2026-09-03 (C03 APPLY)  
**Authoritative migration:** `supabase/migrations/20260903175839_c03_fx_quotes_cross_border.sql`  
**LIVE_MONEY_READY:** NO

## C03-R3 semantic gate

- [x] Initial Q1 creates P1 and consumes Q1
- [x] Exact Q1 retry returns same P1
- [x] Failed/canceled P1 may receive Q2 (usable)
- [x] Q2 wrapper → `payment_attempt_required`; Q2 unconsumed
- [x] processing / succeeded / ledger-posted / requires_action → no new quote
- [x] C05 never reopens; no second logical payment
- [x] quote_request_id + provider-ref idempotency
- [x] nested DEFINER; RLS; C05/C06 regressions

## C03-R3.1 lock-order gate

- [x] One global order: funding_request → payment → fx_quote
- [x] Wrapper preliminary quote read is locator only; revalidate after locks
- [x] Forced overlapping record vs wrapper: no 40P01, no lock_timeout
- [x] Concurrent quote replacement: one usable, history preserved
- [x] Concurrent initial wrappers: one payment, one consumed quote
- [x] Success race: succeed-first DENY; succeeded leaves no usable Q2

## Flags

```text
C03_SCHEMA_APPLIED: YES (staging after APPLY)
C03_R3_1_PASS: YES
LOCK_ORDER_RUNTIME_PROOF: YES
C03_CANDIDATE_READY: N/A (promoted)
C03_APPLY_READY: YES
EUR_FUNDING_ENABLED: NO
LIVE_MONEY_READY: NO
```

## Still forbidden for live money

- PSP / webhook / funding UI activation
- C12 payment_attempts
- Production apply
- Treating EUR metadata as funding approval
