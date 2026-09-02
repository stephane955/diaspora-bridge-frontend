# Phase 5 Report — Canonical Financial Model (Scaffolding)

```text
PHASE:
5 — Canonical Financial Model (SCAFFOLDING)

STATUS:
SCAFFOLDING COMPLETE (staging) — NOT full canonical migration

TARGET:
tvorurbmzrpwvxwztpix

PRODUCTION TOUCHED:
NO
```

---

## SCHEMA CHANGES

Applied via `20260902100000_phase5_canonical_money.sql` (statement-by-statement on staging; Docker/psql unavailable):

| Object | Action |
|--------|--------|
| `platform_currencies` | Created; XAF row seeded |
| `platform_fee_bps_minor()` | Integer fee helper |
| `platform_fee_insurance_minor()` | 1.5% insurance fee (150 bps) |
| `platform_assert_settlement_currency()` | XAF-only guard |
| `platform_resolve_amount_minor()` | Read precedence helper |
| `platform_milestone_amounts_conflict()` | Dual-column conflict detector |
| `projects` | Added `currency`, `estimated_budget_minor`, `material_budget_minor` |
| `milestones` | Added `currency`, `amount_minor` |
| `withdrawals` | Added `currency`, `amount_minor` |
| Ledger columns | COMMENT ON only (no renames) |

---

## MIGRATION

```text
File:     supabase/migrations/20260902100000_phase5_canonical_money.sql
Version:  20260902100000
History:  APPLIED (staging)
```

**Not applied:** `20260826110000`, `20260826120000`

---

## CANONICAL MONEY MODEL

```text
currency     = 'XAF' (Phase 5 settlement)
amount_minor = BIGINT whole XAF

Ledger mapping (unchanged columns):
  balance_xaf ≡ amount_minor
  debit_xaf / credit_xaf ≡ line amount_minor
```

Application: `lib/money.ts` — `Money`, `xafMoney`, `resolveAmountMinor`, `insuranceFeeMinor`, `sumLegacyTransactionAmounts` (deprecated legacy reads).

---

## FIELDS RESOLVED

| Domain | Canonical | Notes |
|--------|-----------|-------|
| Ledger | `currency` + `*_xaf` | Already authoritative; documented |
| Milestones | `amount_minor` + `currency` | Write target for new code |
| Projects | `estimated_budget_minor`, `material_budget_minor` | Non-authoritative planning |
| Withdrawals | `amount_minor` + `currency` | Payout model prep |
| Fees | Integer bps functions | Matches Phase 3B TRUNC semantics |

---

## FIELDS DEPRECATED

| Field | Status |
|-------|--------|
| `milestones.amount` | DEPRECATE — use `amount_minor` |
| `milestones.amount_cfa` | DEPRECATE — use `amount_minor` |
| `transactions.amount` | LEGACY READ ONLY |
| `withdrawals.amount` (numeric) | LEGACY — prefer `amount_minor` |
| `projects.budget` (when present) | NON-AUTHORITATIVE planning |

---

## LEGACY FIELDS RETAINED

All legacy columns kept for compatibility. No deletes. No ledger backfill.

---

## DATA QUALITY FINDINGS

See `docs/MONEY_DATA_QUALITY_REPORT.md`.

Staging:

- Ledger total balance: **0 XAF**
- Journals/lines: **0**
- Withdrawals: **empty**
- Milestone amount columns: **added** (`amount_minor` nullable)

Production quarantined **50,002 XAF**: **unchanged** (out of scope).

---

## APPLICATION CHANGES

| File | Change |
|------|--------|
| `lib/money.ts` | **NEW** canonical money contract |
| `lib/hireProvider.ts` | Writes `amount_minor` + `currency` |
| `app/diaspora/project/[id].tsx` | `resolveAmountMinor` |
| `app/workroom/[id].tsx` | `resolveAmountMinor`, integer advance calc |
| `app/diaspora/wallet.tsx` | `sumLegacyTransactionAmounts` (marked legacy) |
| `app/provider/earnings.tsx` | Same |
| `supabase/functions/process-escrow/index.ts` | Integer insurance fee |

---

## TESTS

| Test | File |
|------|------|
| SQL suite | `supabase/tests/phase5_canonical_money.sql` |
| Docs | `docs/FINANCIAL_FIELD_INVENTORY.md`, etc. |

---

## TEST RESULTS

Verified on staging (2026-09-02):

| Check | Result |
|-------|--------|
| `platform_currencies` XAF row | PASS |
| `platform_fee_insurance_minor(1000000)` = 15000 | PASS |
| `milestones.amount_minor` column | PASS |
| Ledger balance = 0 | PASS |
| Journal count = 0 | PASS |
| Phase 3B tables absent | PASS |
| History includes 20260902100000 | PASS |
| Conflict detection (100 vs 200) = true | PASS |

---

## LEDGER FINANCIAL IMPACT

**NONE** — no journals posted, balances unchanged at 0 XAF.

---

## OPENING BALANCE

**0 XAF** (unchanged)

---

## QUARANTINED WITHDRAWAL

**50,002 XAF** — unchanged (production legacy; not backfilled)

---

## PHASE 3B.0 / 3B

**NOT APPLIED**

---

## REMAINING BLOCKERS

1. Provider advance **accounting meaning** — DESIGN BLOCKER (Phase 18)
2. Legacy wallet UI still reads `transactions` — migrate to ledger read model (Phase 39)
3. `process-escrow` still legacy path — replace in Phase 11–12
4. Full legacy `numeric` column conversion deferred per table

---

## NEXT REQUIRED IMPLEMENTATION

**P01 — Database Foundation** (authoritative DDL, migration consolidation, CI, types regeneration)

> **HISTORICAL REMEDIATION NEXT STEP AT TIME OF PHASE5 REPORT:** Phase 6 — Ledger invariants (extend SQL invariant tests on staging). Superseded by P00 → P01 sequence in `04_MASTER_RECONCILIATION_AND_EXECUTION_PLAN.md`.

---

## DOCUMENTATION CREATED

- `docs/CANONICAL_MONEY_MODEL.md`
- `docs/FINANCIAL_FIELD_INVENTORY.md`
- `docs/LEGACY_MONEY_COMPATIBILITY.md`
- `docs/MILESTONE_AMOUNT_DEPENDENCY_MAP.md`
- `docs/MONEY_DATA_QUALITY_REPORT.md`
