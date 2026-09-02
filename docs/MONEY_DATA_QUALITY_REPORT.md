# Money Data Quality Report

**Generated:** 2026-09-02  
**Last updated:** 2026-09-02 (post-P00 / post-Phase-5 staging snapshot)  
**Environments audited:** Staging read-only (`tvorurbmzrpwvxwztpix`)  
**Production:** `xtyqcdktwxzuezarnqhz` — **not queried** (per frozen rule)  
**Audit method:** Repository reconnaissance + staging MCP verification + P00 migration apply

> **Status:** CURRENT for post-Phase-5 / post-P00 staging snapshot. Release-path section describes pre-P00 app behavior where noted.

---

## Executive summary

| Severity | Finding | Count / state |
|----------|---------|---------------|
| **Critical** | App used `SUM(transactions.amount)` as wallet truth while ledger holds authoritative balances | **MITIGATED (P00)** — UI uses `rpc_get_user_available_balance()` or "Balance temporarily unavailable"; legacy writes frozen |
| **Critical** | Client release path updated milestone `paid` and inserted `transactions` (not legacy `release_milestone` RPC) | **MITIGATED (P00)** — `handleReleaseFunds` fail-closed; no client money mutation |
| **High** | Dual amount columns (`amount` vs `amount_cfa` vs `amount_minor`) | Phase 5 columns **exist on staging**; conflict helper available; population/backfill not done |
| **High** | Phase 3B `payments` absent — no payment intent audit trail | 0 payment rows (unchanged) |
| **Medium** | Legacy `transactions` / `withdrawals` stubs | RLS **ON** after P00; client mutations denied |
| **Info** | Production quarantined 50,002 XAF withdrawal | **Out of scope** for this report |

**Overall staging money data posture:** Phase 5 scaffolding applied; P00 freezes legacy money writes; ledger empty (0 journals / 0 XAF); app cannot create fake balance or simulate settlement from client.

---

## 1. Environment scope

```yaml
staging:
  ref: tvorurbmzrpwvxwztpix
  audited: read-only, 2026-09-02
  bootstrap: 000_app_baseline_min + Phase 1 + Phase 3A (repaired history)

production:
  ref: xtyqcdktwxzuezarnqhz
  audited: false
  note: quarantined 50,002 XAF withdrawal documented in frozen decisions — not investigated here
```

---

## 2. Staging table inventory (financial)

| Table | Present | Row count (approx) | Amount columns | RLS |
|-------|---------|-------------------|----------------|-----|
| `ledger_accounts` | Yes | 11 | `balance_xaf` (bigint) | ON, deny JWT |
| `ledger_journals` | Yes | 0 | `currency` only | ON, deny JWT |
| `ledger_lines` | Yes | 0 | `debit_xaf`, `credit_xaf` | ON, deny JWT |
| `ledger_posted_events` | Yes | 0 | — | ON, deny JWT |
| `payments` | **No** | — | — | — |
| `projects` | Yes | low | `estimated_budget_minor`, material budget minor cols (Phase 5); legacy `budget`/`retainage_*` may be absent in minimal bootstrap | ON |
| `milestones` | Yes | low | **`amount_minor` present** (Phase 5); legacy `amount`/`amount_cfa` may be absent on minimal staging DDL | ON |
| `transactions` | Yes (stub) | 0 | `amount` (numeric) | **ON (P00)** — client INSERT/UPDATE/DELETE denied |
| `withdrawals` | Yes (stub) | **0** | `amount` (numeric), **`amount_minor` (Phase 5 column exists)** | **ON (P00)** — client INSERT/UPDATE/DELETE denied |
| `provider_advances` | No | — | — | — |
| `project_material_carts` | No | — | — | — |
| `project_expenses` | No | — | — | — |

---

## 3. Ledger data quality

| Metric | Value | Expected | Status |
|--------|-------|----------|--------|
| Account count | 11 | System-seeded purposes | OK |
| Sum `balance_xaf` | **0** | Zero opening balance (frozen decision) | OK |
| Journal count | 0 | Zero until first funding | OK |
| Line count | 0 | Zero until first posting | OK |
| Debit/credit equality | N/A (no lines) | Must balance when populated | Not testable yet |
| Trial balance probe | Available (`ledger_trial_balance()`) | — | Ready for post-3B |

**Finding L1:** Ledger schema is healthy but **disconnected from application** — zero journals means all app balance displays come from empty or absent legacy sources.

**Finding L2:** `user_available` test residue noted in inventory — 0 balance; do not delete accounts until posting tests complete.

---

## 4. Legacy wallet data quality

### 4.1 `transactions`

| Check | Result |
|-------|--------|
| Row count | **0** |
| SUM(amount) | **0** (NULL-safe) |
| Positive balance rows | 0 |
| Negative balance rows | 0 |
| RLS enabled | **YES (P00)** |
| Client INSERT possible | **NO** — INSERT/UPDATE/DELETE revoked for anon/authenticated |

**Finding T1:** Empty table masks the dual-authority bug in staging UI (wallet shows 0 everywhere) but **does not reduce exploit risk** — any authenticated client can INSERT arbitrary amounts.

### 4.2 `withdrawals`

| Check | Result |
|-------|--------|
| Row count | **0** |
| Quarantined rows on staging | **None** |
| RLS enabled | **YES (P00)** |
| `amount_minor` column | **Present** (Phase 5 applied; rows may be NULL) |

**Finding W1:** Staging withdrawals stub is **completely empty** — no payout history to validate.

**Finding W2 (production, out of scope):** Frozen decision documents quarantined withdrawal **50,002 XAF** on production — reconciliation path undefined; **no staging equivalent**; not included in row counts or remediation steps here.

---

## 5. Milestone amount data quality

| Check | Staging minimal | Full legacy (production expected) |
|-------|-----------------|----------------------------------|
| `amount` column exists | **NO** (minimal bootstrap) | YES (numeric) |
| `amount_cfa` column exists | **NO** (minimal bootstrap) | YES (numeric) |
| `amount_minor` column exists | **YES** (Phase 5 applied; values may be NULL) | YES after Phase 5 |
| NULL amount rate | High if unpopulated | Unknown — requires production audit |
| `amount` vs `amount_cfa` conflicts | N/A on minimal staging | Detectable via `platform_milestone_amounts_conflict()` when legacy columns present |
| Release uses DB amount | N/A (no canonical release) | **NO** — pre-P00 client path disabled; C07 not implemented |

**Finding M1:** Minimal staging milestones may lack legacy `amount`/`amount_cfa` columns but **`amount_minor` column exists** after Phase 5 — population/backfill not done.

**Finding M2:** Pre-P00 `app/provider/earnings.tsx` summed legacy `transactions`; **P00** uses ledger RPC or unavailable message.

**Finding M3:** `hireProvider.ts` writes **both `amount_minor` and `amount_cfa`** client-side — out of P00 scope (C14/hire RPC).

---

## 6. Project budget / retainage data quality

| Field | Staging minimal | Quality note |
|-------|-----------------|--------------|
| `budget` | Absent | Progress UI using budget will fail or show 0 |
| `material_budget` | Absent | — |
| `warranty_retainage_cfa` | Absent | Handoff UI shows 0 |
| `retainage_balance` | Absent | — |
| `estimated_budget_minor` | **Present (Phase 5 column)** | Values may be NULL |

**Finding P1:** Project-level money fields on staging minimal are **non-existent**, not merely NULL — schema mismatch vs full app expectations.

---

## 7. Phase 3B / payments data quality

| Check | Result |
|-------|--------|
| `payments` table | **Absent** |
| `amount_xaf` population | N/A |
| Orphan intents (succeeded, no journal) | N/A |
| `escrow_funder_approvals` | **Absent** |

**Finding PAY1:** No payment intent audit trail on staging — cannot validate amount_xaf ↔ PSP ↔ ledger reconciliation.

---

## 8. Phase 5 canonical columns

| Column | Applied on staging? | Backfill status |
|--------|--------------------|-----------------|
| `milestones.amount_minor` | **YES** | Not backfilled |
| `projects.estimated_budget_minor` | **YES** | Not backfilled |
| `withdrawals.amount_minor` | **YES** | Not backfilled |
| `platform_currencies` | **YES** | Seeded in Phase 5 migration |

**Finding C5-1:** Phase 5 migration **applied on staging** (`20260902100000`) — canonical columns exist; population/backfill and legacy retirement remain open (P01/C14).

---

## 9. Cross-system consistency checks

| Check | Staging result | Pass? |
|-------|---------------|-------|
| Ledger total = SUM(transactions) | 0 = 0 | Vacuous pass |
| Ledger escrow = projects funded amount | 0 vs no column | **N/A** |
| SUM(milestone amounts) = project budget | No amount columns | **N/A** |
| Withdrawals total = ledger payout journals | 0 vs 0 journals | Vacuous pass |
| Cart totals = material escrow ledger | Tables absent | **N/A** |

**Finding X1:** Staging passes trivial equality checks because **all systems are empty** — this is not evidence of correctness under load.

---

## 10. Security-related data quality (POST-P00 staging)

| Issue | Staging (current) | Data impact |
|-------|-------------------|-------------|
| `transactions` RLS | **ON (P00)** — client mutation denied | Arbitrary balance rows **blocked** |
| `withdrawals` RLS | **ON (P00)** — client mutation denied | Arbitrary payout rows **blocked** |
| Client release path | **Disabled (P00)** | No milestone `paid` + transactions insert |
| Legacy `release_milestone(p_amount)` | **Not on staging** | Archived in `supabase/legacy/` — must not return in active chain |
| `process-escrow` | **503 fail-closed (repo)** | Staging edge deploy **unverified** |

**PRE-P00:** authenticated clients could INSERT arbitrary `transactions` rows. **POST-P00:** legacy tables remain non-authoritative and empty; writes denied.

---

## 11. Recommended data quality gates (before production cutover)

| Gate | SQL / check | Block if |
|------|-------------|----------|
| DQ-1 | `SELECT COUNT(*) FROM milestones WHERE platform_milestone_amounts_conflict(amount_minor, amount_cfa, amount)` | > 0 after backfill |
| DQ-2 | Milestones with workflow state ≥ approved but `amount_minor IS NULL` | > 0 |
| DQ-3 | `payments` succeeded without `ledger_journal_id` | > 0 |
| DQ-4 | `ABS(sum(debit_xaf)-sum(credit_xaf))` from ledger_lines | ≠ 0 |
| DQ-5 | Authenticated INSERT on `transactions` | succeeds |
| DQ-6 | `release_milestone` callable with `p_amount <> milestone amount_minor` | succeeds |
| DQ-7 | SUM(transactions) ≠ ledger user_available for sample users | any mismatch |

---

## 12. Staging vs production expectations

| Dimension | Staging (this report) | Production (out of scope) |
|-----------|----------------------|---------------------------|
| Ledger | Present, zero balance | Unknown — not audited |
| Legacy transactions | Empty stub | Likely populated |
| Milestone amounts | `amount_minor` column **exists**; legacy `amount`/`amount_cfa` absent on minimal staging | Dual columns likely on production |
| Quarantined withdrawal | None | **50,002 XAF** (frozen, not reconciled) |
| Phase 3B | Not applied | Unknown |

**Explicit exclusion:** Production quarantined **50,002 XAF** withdrawal investigation, backfill, and ledger reconciliation are **deferred** per frozen decisions (`REMEDIATION_INVENTORY §14`). This report does not assess production row-level quality.

---

## 13. Remediation priority (data-focused)

| Priority | Action | Resolves |
|----------|--------|----------|
| P0 | Enable RLS; block `transactions`/`withdrawals` client writes | T1, W1 exploit surface |
| P0 | P00 security freeze (completed) | T1 |
| P1 | P01 database foundation + migration reproducibility | P1, schema drift |
| C05 | Phase 3B.0 readiness review (after P01) | PAY1 |
| C06 | Phase 3B escrow funding apply | L1 |
| P2 | Align staging schema with full app DDL OR gate app to minimal columns | P1, M1 |
| Deferred | Production 50,002 XAF quarantine resolution | Out of scope |

---

## 14. Machine-readable snapshot

```json
{
  "report_date": "2026-09-02",
  "environment": "staging",
  "project_ref": "tvorurbmzrpwvxwztpix",
  "production_audited": false,
  "ledger_accounts_count": 11,
  "ledger_total_balance_xaf": 0,
  "ledger_journals_count": 0,
  "ledger_lines_count": 0,
  "transactions_count": 0,
  "transactions_sum_amount": 0,
  "withdrawals_count": 0,
  "payments_table_exists": false,
  "milestones_amount_minor_exists": true,
  "milestones_legacy_amount_exists": false,
  "milestones_legacy_amount_cfa_exists": false,
  "milestones_amount_minor_backfilled": false,
  "phase5_applied": true,
  "p00_applied": true,
  "transactions_rls_enabled": true,
  "withdrawals_rls_enabled": true,
  "transactions_client_mutation": false,
  "withdrawals_client_mutation": false,
  "phase3b_applied": false,
  "process_escrow_repo": "fail_closed_503",
  "process_escrow_staging_deploy": "unverified",
  "production_quarantine_50002_xaf": "out_of_scope",
  "critical_findings": [
    "dual_authority_empty_legacy",
    "milestone_amount_minor_unpopulated",
    "phase3b_payments_absent",
    "p01_schema_pending_staging_apply"
  ]
}
```

---

*Sources: staging MCP verification 2026-09-02, `CURRENT_STATE.yaml`, P00 migration `20260902120000_p00_security_lockdown.sql`. Re-run after P01 schema reconciliation and C06/C07 apply.*
