# C03 ↔ C05 ↔ C06 Compatibility Review

**Updated:** 2026-09-03 (C03 APPLY — staging schema only)  
**C05 staging:** `20260902183828`  
**C06 staging:** `20260902191944`  
**C03 staging:** APPLIED (`20260903175839`) — schema only  
**Authoritative migration:** `supabase/migrations/20260903175839_c03_fx_quotes_cross_border.sql`  
**Live money:** NO  
**Quote direction:** TARGET-XAF-FIRST (Decision #32 FROZEN)

## Amount invariant

```text
escrow_funding_requests.amount_xaf
  = fx_quotes.target_amount_xaf
  = payments.amount_xaf
  = escrow_funding ledger amount_xaf
```

## Domain separation

```text
C03 FX QUOTE     = economic execution terms
C06 PAYMENT      = one logical inbound funding identity
C12 PAYMENT ATTEMPT = one actual PSP/provider execution attempt
```

`C06 returning existing P1 ≠ new provider attempt.`

## Quote consumption meaning

```text
fx_quotes.status = consumed
=
THIS EXACT QUOTE HAS BEEN COMMITTED TO AN ACTUAL PAYMENT EXECUTION PATH
```

- **Initial:** no P1 → C06 creates P1 → Q1 consumed  
- **Exact Q1 retry:** return P1; do not change Q1  
- **Fresh Q2 while P1 exists:** C03 wrapper **DENY** `payment_attempt_required`; Q2 stays usable  
- **Future C12:** creates attempt A2 binding P1+Q2+provider ref → then consumes Q2  

## Four lifecycle zones

### A. PRE-INTENT

Many historical quotes; at most one `usable`; no logical payment yet.

### B. INITIAL INTENT

Q1 selected → P1 created → Q1 consumed → C05 consumed.

### C. POST-INTENT RETRY PREPARATION

P1 `failed` / `canceled` (no ledger) → Q2 may be recorded → Q2 remains **usable**  
C03 cannot consume Q2  
C03 cannot create a second payment  
Wrapper returns `payment_attempt_required`

Denied for new quotes when P1 is `requires_action`, `processing`, `succeeded`, or `ledger_journal_id IS NOT NULL`.

### D. C12 FUTURE

C12 creates real retry attempt A2  
A2 binds P1 + Q2 + new provider ref  
Only then Q2 becomes consumed  

**C12_PAYMENT_ATTEMPT_MODEL_REQUIRED = YES**

## Lock order (C03-R3.1) — ONE global order

All C03 multi-object paths use the same deadlock-safe order (aligned with C06):

```text
1) escrow_funding_requests FOR UPDATE
2) payments FOR UPDATE (if present)
3) fx_quotes FOR UPDATE / supersede / insert
```

Applies to both:

```text
rpc_record_fx_quote
rpc_create_cross_border_payment_intent
```

Wrapper preliminary quote read:

```text
SELECT funding_request_id FROM fx_quotes WHERE id = p_fx_quote_id;
```

is a **non-locking locator only** — not authority. After locks are held, the wrapper **must revalidate** quote existence, funding_request_id, requested_by, project_id, target_amount_xaf, status, expiry, and payment relationship.

Do **not** describe opposing orders (quote→request vs request→payment). Historical C06 is unmodified.

## Compatibility verdict

| Pair | Verdict |
|------|---------|
| C03↔C05 | Compatible; C05 never reopens |
| C03↔C06 | Additive; historical C06 unmodified |
| Post-intent | SAFE — no fake Q2 consumption |
| Live money | NO |
