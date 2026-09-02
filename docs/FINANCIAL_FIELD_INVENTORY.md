# Financial Field Inventory

**Generated:** 2026-09-02  
**Scope:** Repository reconnaissance + staging read-only audit (`tvorurbmzrpwvxwztpix`)  
**Production:** `xtyqcdktwxzuezarnqhz` — **out of scope** (not queried)  
**Settlement currency (Phase 5):** XAF only; `amount_minor` ≡ whole XAF for zero-decimal currency

---

## Classification legend

| Flag | Meaning |
|------|---------|
| **AUTHORITATIVE** | Sole operational cash truth once populated; ledger-backed |
| **WORKFLOW-ONLY** | Contract/planning/UI reference; not proof money moved |
| **LEGACY NON-AUTHORITATIVE** | Historical or client-writable; must not drive settlement |
| **DESIGN BLOCKER** | Column exists but accounting semantics undefined |
| **NOT APPLIED** | Defined in repo migration; absent on staging |

**Migration required?** — Whether callers/schema must change before this field can be trusted.

---

## 1. Ledger — AUTHORITATIVE (Phase 1 + 3A applied on staging)

Source: `supabase/migrations/20260813_phase1_ledger.sql`, `20260826100000_phase3a_ledger_posting.sql`

| Table | Column | Data type | Currency | Current callers | Read paths | Write paths | Authoritative? | Workflow-only? | Legacy? | Replacement | Migration required? |
|-------|--------|-----------|----------|-----------------|------------|-------------|----------------|----------------|---------|-------------|---------------------|
| `ledger_accounts` | `currency` | `char(3)` NOT NULL DEFAULT `'XAF'` | XAF only (`CHECK`) | `ledger_post_journal`, `ledger_ensure_account`, `ledger_trial_balance`, `ledger_balance_sheet_probe` (SQL); Phase 3B `rpc_post_escrow_funding` (repo, not applied) | `ledger_trial_balance()`, `ledger_balance_sheet_probe()`, service_role SELECT | `ledger_post_journal` → INSERT on first use via `ledger_ensure_account`; **no client/app writes** | **YES** | No | No | N/A (canonical) | No — already canonical |
| `ledger_accounts` | `balance_xaf` | `bigint` NOT NULL DEFAULT 0 | XAF (= `amount_minor`) | Same as above; tests `phase3a_ledger_posting.sql`, `phase3a_verify_readonly.sql` | RPC probes above; **zero app callers** | `ledger_post_journal` only (UPDATE via posting RPC, `FOR UPDATE` lock) | **YES** | No | No | Documented as `amount_minor` when `currency='XAF'` (`phase5_canonical_money.sql`) | No for schema; **YES for app** — all balance reads must migrate off `SUM(transactions)` |
| `ledger_journals` | `currency` | `char(3)` NOT NULL DEFAULT `'XAF'` | XAF only | `ledger_post_journal`, Phase 3B funding RPCs (repo) | service_role SELECT; audit/reconciliation (future) | `ledger_post_journal` INSERT only; append-only triggers block UPDATE/DELETE | **YES** | No | No | N/A | No |
| `ledger_lines` | `debit_xaf` | `bigint` NOT NULL | XAF (= debit `amount_minor`) | `ledger_post_journal`, journal balance triggers | service_role SELECT; `ledger_verify_journal_equality()` | `ledger_post_journal` INSERT only | **YES** | No | No | N/A | No |
| `ledger_lines` | `credit_xaf` | `bigint` NOT NULL | XAF (= credit `amount_minor`) | Same | Same | Same | **YES** | No | No | N/A | No |

**Staging state:** 11 `ledger_accounts`, sum `balance_xaf` = **0**; 0 journals; 0 lines (`REMEDIATION_INVENTORY §3.4`).

**Non-amount ledger columns (reference IDs on lines):** `ledger_lines.project_id`, `milestone_id`, `payment_id`, `advance_id` — UUID FKs for traceability; amounts remain on `debit_xaf`/`credit_xaf`.

---

## 2. Payments — NOT APPLIED on staging (Phase 3B repo)

Source: `supabase/migrations/20260826120000_phase3b_escrow_funding.sql`

| Table | Column | Data type | Currency | Current callers | Read paths | Write paths | Authoritative? | Workflow-only? | Legacy? | Replacement | Migration required? |
|-------|--------|-----------|----------|-----------------|------------|-------------|----------------|----------------|---------|-------------|---------------------|
| `payments` | `amount_xaf` | `bigint` NOT NULL CHECK `> 0` | XAF (= `amount_minor`) | `rpc_create_payment_intent`, `rpc_post_escrow_funding`, `rpc_mark_payment_succeeded` (SQL only); **zero app callers** | RLS: client SELECT own rows (`client_id = auth.uid()`) | `rpc_create_payment_intent` INSERT; status/ledger updates via SECURITY DEFINER RPCs only | **Intent until ledger posted**; after `ledger_journal_id` set, cash truth is ledger | No | No | N/A — already bigint XAF | **YES** — apply Phase 3B migration to staging; wire app funding UI to `rpc_create_payment_intent` |

**Note:** `payments` table **absent on staging** (verified `REMEDIATION_INVENTORY §3.3`).

---

## 3. Phase 5 canonical workflow columns (migration in repo; additive)

Source: `supabase/migrations/20260902100000_phase5_canonical_money.sql`, `lib/money.ts`

| Table | Column | Data type | Currency | Current callers | Read paths | Write paths | Authoritative? | Workflow-only? | Legacy? | Replacement | Migration required? |
|-------|--------|-----------|----------|-----------------|------------|-------------|----------------|----------------|---------|-------------|---------------------|
| `projects` | `currency` | `char(3)` NOT NULL DEFAULT `'XAF'` | XAF | Phase 5 migration; future RPCs | App SELECT | DEFAULT on INSERT; future RPCs should set explicitly | No (metadata) | Yes | No | N/A | Phase5 applied (staging) |
| `projects` | `estimated_budget_minor` | `bigint` NULL | XAF | **None in app yet** | Future planning UI | Client UPDATE today on `budget` (legacy); should move to RPC-only | No | **YES** — planning estimate | No | Replaces semantic use of `projects.budget` | **YES** — backfill from `budget` where trustworthy; stop using `budget` as cash |
| `projects` | `material_budget_minor` | `bigint` NULL | XAF | **None in app yet** | Future materials planning | Legacy `material_budget` client-writable | No | **YES** | No | Replaces `projects.material_budget` | **YES** — same as above |
| `milestones` | `currency` | `char(3)` NOT NULL DEFAULT `'XAF'` | XAF | Phase 5 migration | App SELECT | DEFAULT on INSERT | No (metadata) | Yes | No | N/A | Phase5 applied |
| `milestones` | `amount_minor` | `bigint` NULL | XAF | `lib/money.ts` → `resolveAmountMinor()` (library only; **not wired in app screens yet**) | Intended: all milestone display/release | Intended: `hireProvider`, milestone create RPCs | **Workflow contract amount**; settlement via ledger on release | **YES** (contract reference) | No | Replaces `amount` / `amount_cfa` | **YES** — populate on create/update; reads use `resolveAmountMinor` |
| `withdrawals` | `currency` | `char(3)` DEFAULT `'XAF'` | XAF | Phase 5 migration | Future payout RPC | Client INSERT frozen (P00) | No | Request metadata | No | N/A | Phase5 applied; C08 payout RPC |
| `withdrawals` | `amount_minor` | `bigint` NULL | XAF | **None** | Future payout RPC | Client writes `amount` (numeric) today | No until payout RPC | Request amount (workflow) | No | Replaces `withdrawals.amount` | **YES** — dual-write forbidden; payout RPC only |
| `project_expenses` | `currency` | `char(3)` NOT NULL DEFAULT `'XAF'` | XAF | Phase 5 migration | Expense UI (legacy) | Client INSERT/approve | No | Evidence metadata | No | N/A | Apply when table exists |
| `project_expenses` | `receipt_amount_minor` | `bigint` NULL | XAF | **None** | Expense review UI | OCR/extract writes `extracted_amount` today | No — **evidence only** | **YES** | No | Replaces `amount`, `extracted_amount` semantics | **YES** — separate receipt from settlement |
| `provider_advances` | `currency` | `char(3)` NOT NULL DEFAULT `'XAF'` | XAF | Phase 5 migration | `app/workroom/[id].tsx` (legacy `amount_cfa`) | `workroom/[id].tsx` INSERT; no ledger RPC | **DESIGN BLOCKER** | Request amount | No | `amount_minor` + future `provider_advance_disbursement` journal | **YES** — **block disbursement until ledger path defined** |
| `provider_advances` | `amount_minor` | `bigint` NULL | XAF | **None** | Future advance RPC | Future RPC only | **DESIGN BLOCKER** | Request amount | No | N/A | **YES** |

**Staging note:** Minimal bootstrap milestones/projects **lack** legacy amount columns; Phase 5 columns may not exist until migration applied.

---

## 4. Legacy — LEGACY NON-AUTHORITATIVE (`monopoly_ecosystem` and related untimestamped migrations)

These tables/columns exist in full legacy schema (production / untimestamped migrations). **Absent or stub-only on staging minimal bootstrap** unless noted.

### 4.1 `milestones`

| Table | Column | Data type | Currency | Current callers | Read paths | Write paths | Authoritative? | Workflow-only? | Legacy? | Replacement | Migration required? |
|-------|--------|-----------|----------|-----------------|------------|-------------|----------------|----------------|---------|-------------|---------------------|
| `milestones` | `amount` | `numeric` | Assumed XAF (implicit) | `app/diaspora/project/[id].tsx` (display, payment prefill), `app/workroom/[id].tsx`, `lib/hireProvider.ts` (write) | Project hub, workroom, earnings aggregation | `hireProvider.ts` INSERT; client UPDATE via RLS | **NO** | Was workflow; ambiguous vs `amount_cfa` | **YES** | `milestones.amount_minor` | **YES** — deprecate reads via `resolveAmountMinor`; stop writes |
| `milestones` | `amount_cfa` | `numeric` | XAF (named) | `app/provider/earnings.tsx` (SUM), `project/[id].tsx`, `workroom/[id].tsx`, `hireProvider.ts` | Same | Same | **NO** | Was workflow | **YES** | `milestones.amount_minor` | **YES** |

### 4.2 `projects`

| Table | Column | Data type | Currency | Current callers | Read paths | Write paths | Authoritative? | Workflow-only? | Legacy? | Replacement | Migration required? |
|-------|--------|-----------|----------|-----------------|------------|-------------|----------------|----------------|---------|-------------|---------------------|
| `projects` | `budget` | `numeric` | Assumed XAF | `app/diaspora/index.tsx` (progress denominator), project hub | Diaspora dashboard, project detail | Owner UPDATE via RLS | **NO** — planning, not escrow | **YES** (misused as progress/funding proxy) | **YES** | `estimated_budget_minor` + ledger `project_escrow.balance_xaf` for funded | **YES** |
| `projects` | `material_budget` | `numeric` | Assumed XAF | Legacy schema; material flows | Materials UI | Owner UPDATE | **NO** | **YES** | **YES** | `material_budget_minor` | **YES** |
| `projects` | `warranty_retainage_cfa` | `numeric` | XAF (named) | `app/diaspora/project/[id].tsx` (handoff/warranty UI) | Project hub metrics | Owner UPDATE / warranty RPC | **NO** — UI field, not ledger retainage | **YES** (pseudo-cash) | **YES** | `ledger_accounts` purpose `project_retainage` | **YES** — retainage must be ledger-backed |
| `projects` | `retainage_balance` | `numeric` | Assumed XAF | Legacy `release_milestone` / warranty flows | Project hub | Owner UPDATE / RPC | **NO** | **YES** (pseudo-cash) | **YES** | `project_retainage` ledger balance | **YES** |

### 4.3 `provider_advances`

| Table | Column | Data type | Currency | Current callers | Read paths | Write paths | Authoritative? | Workflow-only? | Legacy? | Replacement | Migration required? |
|-------|--------|-----------|----------|-----------------|------------|-------------|----------------|----------------|---------|-------------|---------------------|
| `provider_advances` | `amount_cfa` | `numeric` | XAF (named) | `app/workroom/[id].tsx` (display, advance request %) | Workroom advance card | Client INSERT advance request | **DESIGN BLOCKER** | Request UI | **YES** | `amount_minor` + `provider_advance_disbursement` journal type | **YES** — **do not ship accounting until ledger RPC exists** |

### 4.4 `project_material_carts` / items

| Table | Column | Data type | Currency | Current callers | Read paths | Write paths | Authoritative? | Workflow-only? | Legacy? | Replacement | Migration required? |
|-------|--------|-----------|----------|-----------------|------------|-------------|----------------|----------------|---------|-------------|---------------------|
| `project_material_carts` | `total_materials_cfa` | `numeric` | XAF | Legacy `monopoly_ecosystem.sql` definition | Cart hub (if column present) | Provider cart build | **NO** | Cart quote | **YES** | `total_amount_minor` or computed sum of line minors | **YES** — reconcile two cart schema variants |
| `project_material_carts` | `labor_amount_cfa` | `numeric` | XAF | Legacy definition; `project/[id].tsx` adds to total for approval card | Project hub, ClientApprovalCard | Provider cart INSERT/UPDATE | **NO** | Cart quote | **YES** | Line-level / cart total minor | **YES** |
| `project_material_carts` | `total_amount_cfa` | `numeric` | XAF | `app/provider/cart-hub.tsx`, `app/provider/material-cart.tsx`, `project/[id].tsx` | Cart hub list, approval UI | `material-cart.tsx` INSERT | **NO** | Cart quote until `material_funding` journal | **YES** (supplier schema) | Cart total minor + ledger | **YES** |
| `project_material_cart_items` | `unit_price_cfa` | `numeric` | XAF | Cart build UI | Cart detail | Provider INSERT | **NO** | Line quote | **YES** | `unit_price_minor` | **YES** |
| `project_material_cart_items` | `total_cfa` | `numeric` (generated) | XAF | Cart displays | Cart detail | GENERATED from qty × unit | **NO** | Line quote | **YES** | Generated from minor units | **YES** |

### 4.5 `project_expenses`

| Table | Column | Data type | Currency | Current callers | Read paths | Write paths | Authoritative? | Workflow-only? | Legacy? | Replacement | Migration required? |
|-------|--------|-----------|----------|-----------------|------------|-------------|----------------|----------------|---------|-------------|---------------------|
| `project_expenses` | `amount` | `numeric` | Assumed XAF | Expense approval UI (legacy) | Workroom/expense lists | Client INSERT; direct approve via RLS | **NO** | Expense claim | **YES** | `receipt_amount_minor` (evidence) + ledger on reimbursement | **YES** |
| `project_expenses` | `extracted_amount` | `numeric` | Assumed XAF | OCR/receipt extract (legacy) | Expense review | Trigger/OCR write | **NO** | Evidence | **YES** | `receipt_amount_minor` | **YES** |

### 4.6 `transactions` — LEGACY NON-AUTHORITATIVE

| Table | Column | Data type | Currency | Current callers | Read paths | Write paths | Authoritative? | Workflow-only? | Legacy? | Replacement | Migration required? |
|-------|--------|-----------|----------|-----------------|------------|-------------|----------------|----------------|---------|-------------|---------------------|
| `transactions` | `amount` | `numeric` | Assumed XAF | `app/provider/wallet.tsx`, `app/diaspora/index.tsx`, `app/provider/earnings.tsx`, `app/provider/payout-setup.tsx`, `app/provider/active.tsx`; `supabase/functions/process-escrow/index.ts` (INSERT) | **SUM(amount)** as wallet balance across provider/diaspora screens | Client INSERT (positive/negative); Edge INSERT on mock fund | **NO** — **LEGACY NON-AUTHORITATIVE** | Was pseudo-wallet | **YES** | `ledger_accounts` purpose `user_available.balance_xaf` via read RPC | **YES** — **block INSERT for authenticated**; migrate all readers |

**Staging:** stub table exists; RLS **OFF** (`REMEDIATION_INVENTORY §3.5`).

### 4.7 `withdrawals`

| Table | Column | Data type | Currency | Current callers | Read paths | Write paths | Authoritative? | Workflow-only? | Legacy? | Replacement | Migration required? |
|-------|--------|-----------|----------|-----------------|------------|-------------|----------------|----------------|---------|-------------|---------------------|
| `withdrawals` | `amount` | `numeric` | Assumed XAF | `app/provider/payout-setup.tsx`, `app/provider/withdraw.tsx` | Payout history UI | Client INSERT **without balance check** | **NO** | Payout request (unsafe) | **YES** | `amount_minor` + `rpc_request_payout` + `payout_*` journals | **YES** — RLS + server-side balance check |

**Staging:** stub table exists; **0 rows**; RLS **OFF**.

### 4.8 Other legacy money columns

| Table | Column | Data type | Currency | Current callers | Read paths | Write paths | Authoritative? | Workflow-only? | Legacy? | Replacement | Migration required? |
|-------|--------|-----------|----------|-----------------|------------|-------------|----------------|----------------|---------|-------------|---------------------|
| `project_bids` | `amount` | `numeric` | Assumed XAF | `utils/bidScoring.ts`, bid UI | Bid comparison | Provider INSERT | **NO** | Bid quote | **YES** | `amount_minor` | **YES** (when bids retained) |
| `blueprints` | `price` | `numeric` | Assumed XAF | Blueprint marketplace UI | Browse/select | Admin/provider INSERT | **NO** | Catalogue reference | **YES** | `price_minor` | Low priority |
| `project_contracts` | (contract value fields) | `numeric` (per apex schema) | Assumed XAF | Contract PDF generation | Contract view | RPC on hire | **NO** | Legal/workflow snapshot | **YES** | Minor + currency | **YES** when contracts wired to ledger |

---

## 5. Staging minimal bootstrap (subset)

Source: `supabase/staging/000_app_baseline_min.sql` (referenced in `REMEDIATION_INVENTORY §2.4`)

| Table | Financial columns present | Notes |
|-------|---------------------------|-------|
| `projects` | No legacy `budget`, `retainage_*`, `warranty_*` in minimal DDL | Phase 5 adds `estimated_budget_minor` when migration runs |
| `milestones` | **No** `amount`, `amount_cfa`, or `amount_minor` in minimal DDL | App callers expecting amounts will read NULL/0 |
| `transactions` | Stub: `amount numeric` | Empty; RLS off |
| `withdrawals` | Stub: `amount numeric` | **Empty**; RLS off |
| `ledger_*` | Full Phase 1+3A | 11 accounts, balance sum 0 |

---

## 6. Application caller index (financial reads/writes)

Paths relative to repo root (`diaspora-bridge/`).

| File | Fields touched | Operation |
|------|----------------|-----------|
| `app/provider/wallet.tsx` | `transactions.amount` | READ SUM; Alert placeholder funding |
| `app/diaspora/index.tsx` | `transactions.amount`, `projects.budget` | READ SUM; fabricated progress vs budget |
| `app/provider/earnings.tsx` | `milestones.amount_cfa`, `transactions.amount` | READ SUM |
| `app/provider/payout-setup.tsx` | `transactions.amount`, `withdrawals.amount` | READ SUM; INSERT withdrawal + negative transaction |
| `app/provider/active.tsx` | `transactions.amount` | READ SUM |
| `app/provider/withdraw.tsx` | `withdrawals.amount` | INSERT (no balance check) |
| `app/diaspora/project/[id].tsx` | `milestones.amount`/`amount_cfa`, `projects.warranty_retainage_cfa`, cart totals, `release_milestone(p_amount)` | READ/WRITE; **client-supplied release amount** |
| `app/workroom/[id].tsx` | `milestones.amount`/`amount_cfa`, `provider_advances.amount_cfa` | READ; advance INSERT |
| `app/provider/cart-hub.tsx` | `project_material_carts.total_amount_cfa` | READ |
| `app/provider/material-cart.tsx` | `total_amount_cfa` | WRITE on cart create |
| `components/ClientApprovalCard.tsx` | cart `total_amount_cfa` (+ labor) | READ |
| `lib/hireProvider.ts` | `milestones.amount_cfa` | WRITE on hire (50/50 split) |
| `lib/money.ts` | `amount_minor`, `amount_cfa`, `amount` | READ helper `resolveAmountMinor`; deprecated `sumLegacyTransactionAmounts` |
| `supabase/functions/process-escrow/index.ts` | `transactions.amount`, project status | WRITE mock fund path |
| `supabase/functions/escrow-webhook/index.ts` | milestone payout (stub) | WRITE stub |

**Zero app callers** for: `ledger_post_journal`, `rpc_create_payment_intent`, `rpc_post_escrow_funding`, any ledger balance read RPC.

---

## 7. SQL helper functions (amount resolution)

| Function | Purpose | Authoritative? |
|----------|---------|----------------|
| `platform_resolve_amount_minor(amount_minor, amount_cfa, amount)` | Read precedence for legacy rows | No — workflow helper |
| `platform_milestone_amounts_conflict(...)` | Detect dual-column conflicts | No — data quality |
| `platform_fee_insurance_minor(gross_minor)` | 1.5% fee integer math | Yes for fee **computation** when used by posting RPC |
| `platform_fee_bps_minor(amount, bps)` | Generic bps fee | Same |

---

## 8. Frozen decisions affecting inventory

| Decision | Impact on fields |
|----------|------------------|
| Opening ledger balances = ZERO | No backfill of legacy balances into ledger |
| Quarantined production withdrawal 50,002 XAF | **Out of scope** for staging inventory; no ledger write-off until approved |
| Dual-write FORBIDDEN | Cannot populate `amount_minor` and continue writing `amount_cfa` in parallel without migration plan |
| `transactions` = LEGACY NON-AUTHORITATIVE | All SUM(transactions) callers must be replaced |
| `provider_advances` = DESIGN BLOCKER | Do not treat `amount_cfa`/`amount_minor` as disbursed funds |

---

## 9. Summary counts

| Class | Field count (amount-bearing) | Staging presence |
|-------|---------------------------|------------------|
| Ledger authoritative | 5 (`currency`×2 + `balance_xaf` + `debit_xaf` + `credit_xaf`) | **Present**, zero balances |
| Phase 3B payment intent | 1 (`payments.amount_xaf`) | **Absent** |
| Phase 5 workflow canonical | 10 columns across 5 tables | **Pending** migration apply |
| Legacy numeric | 20+ columns across 10+ tables | **Most absent** on staging minimal |
| Legacy stub | 2 (`transactions.amount`, `withdrawals.amount`) | Present, empty |

---

*Update this inventory after Phase 5 apply, Phase 3B apply, and each app migration tranche per `REMEDIATION_INVENTORY §62`.*
