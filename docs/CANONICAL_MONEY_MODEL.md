# Canonical Money Model

**Phase:** 5  
**Status:** Implemented (staging)  
**Settlement currency:** XAF only (Phase 5 scope)

---

## 1. The contract

Every **authoritative** financial amount is represented as:

```text
currency      — ISO 4217 code (char(3)); Phase 5 allows 'XAF' only for settlement
amount_minor  — integer minor units (BIGINT in PostgreSQL)
```

For **XAF**:

- Zero decimal places (no fractional CFA in platform accounting)
- `amount_minor` equals whole XAF
- Existing ledger columns `balance_xaf`, `debit_xaf`, `credit_xaf`, `amount_xaf` (Phase 3B) **are already canonical** — they map to `amount_minor` when `currency = 'XAF'`

```text
ledger_accounts.balance_xaf  ≡ amount_minor (when currency = 'XAF')
ledger_lines.debit_xaf       ≡ debit amount_minor
ledger_lines.credit_xaf      ≡ credit amount_minor
```

Phase 5 **does not rename** ledger columns (already applied migrations are frozen).

---

## 2. Forbidden representations

| Forbidden | Reason |
|-----------|--------|
| `float` / `double` / `real` for money | Rounding drift |
| JavaScript `Number` for large authoritative amounts | >2^53 precision loss |
| `toFixed()` as accounting logic | Display only |
| `amount * 0.015` in JS without integer rules | Non-deterministic vs DB |
| Inferring currency from locale/PSP/UI | Must be explicit |
| `projects.budget` as cash truth | Planning ≠ funded escrow |

---

## 3. Integer fee arithmetic

**Insurance fee (1.5% = 150 bps):**

```sql
platform_fee_insurance_minor(gross_minor) = (gross_minor * 15) / 1000
```

```typescript
insuranceFeeMinor(gross) = (gross * 15n) / 1000n
```

Rounding: **truncate toward zero** (matches PostgreSQL `TRUNC(amount * 0.015)` for non-negative integers).

---

## 4. Workflow vs accounting

| Class | Examples | Authoritative for cash? |
|-------|----------|------------------------|
| **Planning estimates** | `estimated_budget_minor`, `material_budget_minor` | NO |
| **Workflow contract amounts** | `milestones.amount_minor` | Contract reference; ledger on release |
| **Payment intents** | `payments.amount_xaf` (Phase 3B, not applied) | Intent until PSP + ledger |
| **Ledger** | journals/lines/accounts | **YES** |
| **Legacy** | `transactions.amount` | NO |
| **Evidence** | `receipt_amount_minor` | NO |

---

## 5. Application type

See `lib/money.ts`: `Money`, `xafMoney`, `resolveAmountMinor`, `insuranceFeeMinor`.

JSON boundary: `amount_minor` as **string**.

---

## 6. Deferred

Multi-currency FX (`docs/01_CANONICAL_MODELS.md` §1.3) — not Phase 5.

Provider advance accounting meaning — **DESIGN BLOCKER** until Phase 18.
