# Legacy Money Compatibility Matrix

**Generated:** 2026-09-02  
**Purpose:** KEEP / DEPRECATE / REPLACE decisions for every money-bearing surface  
**Authority rule:** Ledger (`ledger_*`) is sole operational cash truth. Everything else is workflow, intent, or legacy.

---

## Decision key

| Action | Meaning |
|--------|---------|
| **KEEP** | Retain column/table for read-only history or non-cash workflow with documented bounds |
| **DEPRECATE** | Stop new writes; migrate reads; block client mutations via RLS |
| **REPLACE** | Remove caller dependency; target column/RPC named in Replacement column |

---

## Master matrix

| Object | Column / surface | Action | Replacement target | New writes allowed? | App migration phase | Blocker |
|--------|------------------|--------|-------------------|---------------------|----------------------|---------|
| **Ledger** | | | | | | |
| `ledger_accounts.balance_xaf` | balance | **KEEP** | N/A (authoritative) | RPC only (`ledger_post_journal`) | C6+ | None |
| `ledger_accounts.currency` | currency | **KEEP** | N/A | RPC only | C6+ | None |
| `ledger_journals.currency` | currency | **KEEP** | N/A | RPC only | C6+ | None |
| `ledger_lines.debit_xaf` / `credit_xaf` | amounts | **KEEP** | N/A | RPC only | C6+ | None |
| **Phase 3B (not applied)** | | | | | | |
| `payments.amount_xaf` | intent amount | **KEEP** (when 3B applied) | N/A — already canonical bigint | `rpc_create_payment_intent` only | C6, C11 | Apply 3B migration |
| **Phase 5 workflow** | | | | | | |
| `projects.estimated_budget_minor` | planning | **KEEP** | N/A | RPC / controlled UPDATE | Phase 5 + C14 | Phase5 applied — C14 retirement later |
| `projects.material_budget_minor` | planning | **KEEP** | N/A | RPC / controlled UPDATE | Phase 5 + C14 | Phase5 applied — C14 retirement later |
| `milestones.amount_minor` | contract amount | **KEEP** | N/A | Milestone create/update RPC | Phase 5 + C7 | Wire `resolveAmountMinor` |
| `withdrawals.amount_minor` | payout request | **KEEP** | N/A | `rpc_request_payout` only | C8, C14 | Payout RPC |
| `project_expenses.receipt_amount_minor` | receipt evidence | **KEEP** | N/A | Expense submit RPC | Phase 5 | Separate from settlement |
| `provider_advances.amount_minor` | advance request | **KEEP** (blocked) | N/A | Future advance RPC | C18 | **DESIGN BLOCKER** |
| **Legacy milestones** | | | | | | |
| `milestones.amount` | numeric | **DEPRECATE** | `amount_minor` | **NO** | C7, C14 | Conflict with `amount_cfa` |
| `milestones.amount_cfa` | numeric | **DEPRECATE** | `amount_minor` | **NO** | C7, C14 | Used by earnings, hire, UI |
| **Legacy projects** | | | | | | |
| `projects.budget` | numeric | **DEPRECATE** | `estimated_budget_minor` + ledger escrow read | **NO** (client) | C14 | Used as progress denominator |
| `projects.material_budget` | numeric | **DEPRECATE** | `material_budget_minor` | **NO** (client) | C14 | — |
| `projects.warranty_retainage_cfa` | numeric | **REPLACE** | `ledger_accounts.project_retainage` | **NO** | C7, retainage RPC | UI pseudo-cash |
| `projects.retainage_balance` | numeric | **REPLACE** | `ledger_accounts.project_retainage` | **NO** | C7 | Collapsed with warranty |
| **Legacy wallet** | | | | | | |
| `transactions` (table) | — | **DEPRECATE** | Ledger `user_available` + read RPC | **NO** | 0.1, C14 | RLS off on staging |
| `transactions.amount` | numeric | **DEPRECATE** | `ledger_accounts.balance_xaf` (user_available) | **NO** | 0.1, C14 | 5+ app SUM callers |
| `withdrawals.amount` | numeric | **DEPRECATE** | `withdrawals.amount_minor` + payout RPC | **NO** | C8, C14 | No balance check |
| **Legacy advances** | | | | | | |
| `provider_advances.amount_cfa` | numeric | **DEPRECATE** | `amount_minor` + disbursement journal | **NO** until RPC | C18 | **DESIGN BLOCKER** |
| **Material carts** | | | | | | |
| `project_material_carts.total_materials_cfa` | numeric | **DEPRECATE** | cart total minor | **NO** | Material funding phase | Schema fork |
| `project_material_carts.labor_amount_cfa` | numeric | **DEPRECATE** | line/cart minor | **NO** | Material funding phase | — |
| `project_material_carts.total_amount_cfa` | numeric | **DEPRECATE** | cart total minor | **NO** | Material funding phase | Active in cart-hub |
| `project_material_cart_items.unit_price_cfa` | numeric | **DEPRECATE** | `unit_price_minor` | **NO** | Material funding phase | — |
| `project_material_cart_items.total_cfa` | numeric (gen) | **DEPRECATE** | generated minor | **NO** | Material funding phase | — |
| **Expenses** | | | | | | |
| `project_expenses.amount` | numeric | **DEPRECATE** | `receipt_amount_minor` | **NO** | Expense RPC phase | Direct approve path |
| `project_expenses.extracted_amount` | numeric | **DEPRECATE** | `receipt_amount_minor` | OCR service only | Expense RPC phase | — |
| **Bids / catalogue** | | | | | | |
| `project_bids.amount` | numeric | **DEPRECATE** | `amount_minor` | **NO** | Bid consolidation | Two bid models |
| `blueprints.price` | numeric | **DEPRECATE** | `price_minor` | Admin only | Low priority | — |
| **RPCs / Edge (legacy paths)** | | | | | | |
| `release_milestone(p_amount numeric)` | client amount | **REPLACE** | `rpc_release_milestone(milestone_id)` — server reads `amount_minor` | **NO** | C7 | **P0 exploit** |
| `release_warranty_retainage(project_id)` | project columns | **REPLACE** | `rpc_release_retainage` + ledger | **NO** | C7 | — |
| `process-escrow` Edge | mock fund | **REPLACE** | Phase 3B webhook + `rpc_post_escrow_funding` | **NO** | 0.3, C11 | Mock success |
| `escrow-webhook` Edge | stub payout | **REPLACE** | PSP-signed webhook + ledger | **NO** | C11 | No auth |
| Client INSERT `transactions` | — | **DEPRECATE** | Block via RLS | **NO** | 0.1 | payout-setup writes today |
| Client INSERT `withdrawals` | — | **DEPRECATE** | `rpc_request_payout` | **NO** | 0.1, C8 | No balance check |
| `SUM(transactions.amount)` in app | read pattern | **REPLACE** | `rpc_get_user_available_balance()` (to build) | N/A | C14 | 5 files |

---

## Compatibility by consumer

| Consumer | Legacy dependencies | Target read model | Cutover gate |
|----------|--------------------|--------------------|--------------|
| Provider wallet | `transactions.amount` | Ledger `user_available` RPC | C14 + RLS block on transactions |
| Diaspora dashboard | `transactions.amount`, `projects.budget` | Ledger + `estimated_budget_minor` | C14 |
| Earnings screen | `milestones.amount_cfa`, `transactions` | `amount_minor` + ledger payable | C7 + C14 |
| Payout setup | `transactions`, `withdrawals` | Payout RPC + ledger | C8 |
| Project hub release | `release_milestone(p_amount)`, milestone dual columns | `rpc_release_milestone` | **C7 (first new RPC)** |
| Workroom advances | `provider_advances.amount_cfa` | Advance RPC + journal | **C18 (blocked)** |
| Material carts | `total_amount_cfa`, labor columns | `material_funding` journal | Post C7 |
| process-escrow Edge | mock + `transactions` INSERT | Phase 3B payment pipeline | 0.3 fail-closed, then C11 |

---

## Dual-column conflict policy

When `amount_minor`, `amount_cfa`, and `amount` coexist on the same row:

1. **Read precedence:** `amount_minor` > `amount_cfa` > `amount` (`platform_resolve_amount_minor`, `lib/money.ts` → `resolveAmountMinor`)
2. **Conflict detection:** `platform_milestone_amounts_conflict()` returns true if any pair disagrees after truncating numerics
3. **Write policy:** **Dual-write FORBIDDEN** — single write path via RPC sets `amount_minor` only
4. **Migration:** One-time backfill script sets `amount_minor := COALESCE(trunc(amount_cfa), trunc(amount))` where safe; flag conflicts for manual review

---

## RLS compatibility (staging today)

| Table | Legacy compat action | Required policy change |
|-------|---------------------|------------------------|
| `transactions` | DEPRECATE writes | ENABLE RLS; deny INSERT/UPDATE/DELETE for authenticated |
| `withdrawals` | DEPRECATE writes | ENABLE RLS; INSERT only via payout RPC (service_role) |
| `milestones` | DEPRECATE direct amount UPDATE | Remove UPDATE on amount columns; RPC only |
| `projects` | DEPRECATE budget/retainage UPDATE | Narrow owner UPDATE column list |
| `ledger_*` | KEEP deny-by-default | No change (already hardened) |
| `payments` | KEEP (future) | SELECT own; no client INSERT (3B design) |

---

## Timeline alignment (`02_BUILD_ROADMAP.md`)

```text
Phase 0.1  ──► Block transactions/withdrawals client writes (DEPRECATE enforcement)
Phase 0.3  ──► Fail-closed process-escrow (REPLACE mock path)
Phase 5    ──► Add amount_minor columns (KEEP new schema)
Phase C6   ──► Apply 3B; payments.amount_xaf live (KEEP)
Phase C7   ──► rpc_release_milestone (REPLACE release_milestone)
Phase C8   ──► rpc_request_payout (REPLACE withdrawal INSERT)
Phase C14  ──► Zero app references to legacy (DEPRECATE complete)
Phase C18  ──► Provider advance accounting (REPLACE amount_cfa semantics)
```

---

## Explicit non-actions (frozen)

| Item | Decision |
|------|----------|
| Production quarantined 50,002 XAF withdrawal | **Out of scope** — no REPLACE until reconciliation plan approved |
| Ledger column rename (`balance_xaf` → `balance_minor`) | **Do not** — Phase 5 documents equivalence only |
| Legacy backfill into ledger | **FORBIDDEN** without approved plan |
| Dual-write legacy + ledger | **FORBIDDEN** |

---

*Cross-reference: `FINANCIAL_FIELD_INVENTORY.md` for per-field detail; `MILESTONE_AMOUNT_DEPENDENCY_MAP.md` for release-path specifics.*
