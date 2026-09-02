# Diaspora Bridge — Remediation Inventory

**Generated:** 2026-09-02  
**Scope:** Repository + staging read-only audit (`tvorurbmzrpwvxwztpix`)  
**Production:** `xtyqcdktwxzuezarnqhz` — **NOT touched**

---

## Executive summary

| Area | Status |
|------|--------|
| Ledger (Phase 1 + 3A) on staging | **PRESENT** — 11 accounts, total balance 0 |
| Phase 3B.0 / 3B objects on staging | **ABSENT** |
| Migration history | **RECONCILED** (20260813 + 20260826100000 applied via repair) |
| App financial model | **DUAL / CONFLICTING** — legacy client `transactions` vs Phase 3B ledger design |
| RLS on ledger | **HARDENED** (deny anon/authenticated) |
| RLS on legacy financial tables | **WEAK / MISSING** (`transactions`, `withdrawals` no RLS on staging) |
| Edge Functions | **UNSAFE** — mock payments, unauthenticated webhook stub |
| Canonical money model | **NOT ESTABLISHED** in app (`amount` vs `amount_cfa` coexist) |

---

## 1. Environment targets

```yaml
production:
  ref: xtyqcdktwxzuezarnqhz
  name: diaspora-bridge
  region: eu-west-1
  rule: DO NOT MODIFY

staging:
  ref: tvorurbmzrpwvxwztpix
  name: diaspora-bridge-staging
  region: eu-west-1
  linked_cli: true
  bootstrap: out-of-band SQL (000_app_baseline_min + Phase 1 + Phase 3A)
```

---

## 2. Migration inventory

### 2.1 Timestamped migrations (CLI-tracked)

| Version | File | Staging history | Staging objects |
|---------|------|-----------------|-----------------|
| `20260328` | `20260328_enterprise_disputes_favorites_support.sql` | NOT applied | ABSENT |
| `20260602` | `20260602_harden_material_cart_rls.sql` | NOT applied | ABSENT |
| `20260813` | `20260813_phase1_ledger.sql` | **APPLIED (repaired)** | PRESENT |
| `20260826100000` | `20260826100000_phase3a_ledger_posting.sql` | **APPLIED (repaired)** | PRESENT |
| `20260826110000` | `20260826110000_phase3b0_multisig_approvals.sql` | NOT applied | ABSENT |
| `20260826120000` | `20260826120000_phase3b_escrow_funding.sql` | NOT applied | ABSENT |

**Rename note (2026-09-02):** Three files formerly sharing `20260826` were renamed (SQL byte-identical; SHA256 verified).

### 2.2 Untimestamped legacy migrations (19 files — CLI skips)

Alphabetical apply order risk on fresh `db push`. Not applied on staging minimal bootstrap.

| File | Primary objects |
|------|-----------------|
| `rls_and_auth.sql` | Core RLS, `user_can_access_project` |
| `monopoly_ecosystem.sql` | `release_milestone`, material carts, provider advances |
| `compliance_aml_escrow_insurance.sql` | **Overlaps Phase 3B.0** — legacy multisig |
| `trigger_dispute_rpc.sql` | `trigger_dispute`, dispute-aware `projects_update` |
| `triggers_and_webhooks.sql` | Outbox triggers |
| `storage_buckets.sql` | Storage policies |
| … | (see subagent report) |

### 2.3 Migration conflicts

| Conflict | Severity | Resolution dependency |
|----------|----------|----------------------|
| Duplicate `20260826` versions | **BLOCKER (fixed)** | Renamed to 100000/110000/120000 |
| `escrow_funder_approvals` in compliance + 3B.0 | HIGH | Apply 3B.0 only; do not apply legacy compliance multisig to staging |
| `escrow_all_funders_approved` legacy vs 3B.0 (72h) | HIGH | 3B.0 supersedes |
| `ledger_validate_phase3a_matrix` in 3A vs 3B | INTENTIONAL | 3B extends matrix at apply time |
| `projects_update` policy collision | MEDIUM | Consolidate in dispute remediation phase |
| Legacy before timestamped on `db push` | HIGH | Never blind `db push`; staged apply only |

### 2.4 Staging-only bootstrap

`supabase/staging/000_app_baseline_min.sql` — minimal `profiles`, `projects`, `milestones`, `project_observers`, stub `transactions`/`withdrawals`. **Not in migration history.**

---

## 3. Staging database state (read-only, 2026-09-02)

### 3.1 Public tables

```
ledger_accounts, ledger_journals, ledger_lines, ledger_posted_events
profiles, projects, milestones, project_observers
transactions (stub), withdrawals (stub)
```

### 3.2 Ledger functions present

```
ledger_assert_journal_balanced, ledger_assert_owner_consistency
ledger_balance_sheet_probe, ledger_ensure_account
ledger_journals_balance_trg, ledger_lines_balance_trg
ledger_post_journal, ledger_purpose_allows_negative, ledger_purpose_normal_side
ledger_reject_journal_mutation, ledger_reject_line_mutation
ledger_seed_system_accounts, ledger_trial_balance
ledger_validate_phase3a_matrix, ledger_verify_journal_equality
```

### 3.3 Absent (Phase 3B)

```
payments, escrow_funder_approvals
rpc_create_payment_intent, rpc_post_escrow_funding, ledger_psp_purpose_for_provider
```

### 3.4 Financial totals

| Metric | Value |
|--------|-------|
| `ledger_accounts` count | 11 |
| Sum `balance_xaf` | **0** |
| `ledger_journals` | 0 |
| `user_available` test residue | 0 balance (do not delete yet) |

### 3.5 RLS snapshot (staging)

| Table | RLS |
|-------|-----|
| `ledger_*` | ON, no policies (deny JWT) |
| `transactions` | **OFF** |
| `withdrawals` | **OFF** |
| `profiles`, `projects`, `milestones` | ON (baseline policies) |

### 3.6 Migration history (`supabase_migrations.schema_migrations`)

```yaml
- version: "20260813"
  name: phase1_ledger
- version: "20260826100000"
  name: phase3a_ledger_posting
```

Versions `20260826110000`, `20260826120000`: **not present** (verified).

---

## 4. Schema — financial objects (repository)

### 4.1 Authoritative (Phase 1 + 3A + planned 3B)

**Enums:** `ledger_owner_type`, `ledger_account_purpose`, `ledger_journal_type`, `ledger_journal_source`, `ledger_event_status`

**Tables:** `ledger_accounts`, `ledger_journals`, `ledger_lines`, `ledger_posted_events`, `payments` (3B), `escrow_funder_approvals` (3B.0)

**Core RPC:** `ledger_post_journal` — SECURITY DEFINER, service_role only, idempotent, balanced, append-only

### 4.2 Legacy (non-authoritative per frozen decision)

| Object | Risk |
|--------|------|
| `transactions` | Client SUM/INSERT — hidden wallet |
| `withdrawals` | Client INSERT, no balance check |
| `project_expenses` | Receipt ≠ money moved; direct approve |
| `projects.budget`, `retainage_balance`, `warranty_*` | UI/workflow fields used as pseudo-cash |
| `milestones.amount` / `amount_cfa` | Dual columns — ambiguous authority |
| `release_milestone` | Legacy release path; client-supplied amount |
| `process-escrow` Edge | Mock payment success, sets `escrow_funded` |

### 4.3 Dispute models (multiple)

```
disputes (20260328)
project_disputes (apex_enterprise)
milestones.dispute_status
projects.dispute_milestone_id
trigger_dispute RPC
```

**Blocker for phase 17:** Canonical dispute entity not chosen.

---

## 5. Functions / RPC catalog

### 5.1 Ledger (Phase 1–3A) — 15 functions

See §3.2. Posting restricted to `ledger_post_journal`.

### 5.2 Phase 3B (repo only, not on staging)

```
rpc_create_payment_intent, rpc_attach_payment_psp_ref, rpc_post_escrow_funding
rpc_begin_psp_webhook_event, rpc_complete_psp_webhook_event, rpc_mark_payment_succeeded
payment_caller_may_fund_project, ledger_psp_purpose_for_provider
escrow_all_funders_approved (3B.0), escrow_funder_approvals_before_write
```

### 5.3 Legacy financial

```
release_milestone(project_id, milestone_id, p_amount, ...)  — monopoly_ecosystem.sql
release_warranty_retainage(project_id)
release_escrow_after_approvals(...)  — compliance (legacy)
trigger_dispute(project_id, milestone_id, reason)
user_can_access_project(project_id)  — used broadly; conflates read + write paths
```

---

## 6. RLS matrix (repository migrations)

### 6.1 Ledger — deny-by-default

- RLS enabled, **zero policies** on all ledger tables
- REVOKE ALL from anon/authenticated
- service_role: selective grants; append-only triggers

### 6.2 Payments (3B design)

- SELECT own (`client_id = auth.uid()`)
- No INSERT/UPDATE/DELETE for authenticated

### 6.3 High-risk legacy policies

| Table | Issue |
|-------|-------|
| `profiles` | `SELECT USING (true)` — KYC exposure risk |
| `milestones` | `UPDATE` via `user_can_access_project` — observers/providers can mutate |
| `project_expenses` | Same — direct approve path |
| `projects` | Owner UPDATE includes budget/status/warranty columns |
| `webhook_outbox` | Service policy; verify no public read |
| `transactions` / `withdrawals` | **No policies in migrations** |

---

## 7. Edge Functions

| Function | Financial role | Risk |
|----------|----------------|------|
| `process-escrow` | Legacy deposit | **CRITICAL** — mock PSP success, direct status + transactions insert |
| `escrow-webhook` | Milestone payout | **HIGH** — no auth, stub |
| `compliance-check` | AML flag | Medium — workflow only |
| `push-on-insert` | Notifications | Low |
| Others | Non-financial | — |

**Phase 3B contract:** `supabase/tests/PHASE3B_EDGE_CONTRACT.md` — forbids legacy paths for new escrow.

---

## 8. Application financial paths

### 8.1 Critical unsafe locations

1. `supabase/functions/process-escrow/index.ts` — mock payments, `escrow_funded`, legacy transactions
2. `app/provider/payout-setup.tsx` — SUM(transactions), insert withdrawal + negative transaction
3. `app/diaspora/project/[id].tsx` — release_milestone with client amount; direct status/dispute mutations
4. `supabase/functions/escrow-webhook/index.ts` — unauthenticated stub
5. `app/provider/withdraw.tsx` — withdrawal without balance check

### 8.2 Balance reads (legacy)

```
wallet.tsx, diaspora/index.tsx, earnings.tsx, payout-setup.tsx, active.tsx
→ SUM(transactions.amount)
```

### 8.3 Phase 3B integration

**Zero app callers** for `rpc_create_payment_intent` or ledger RPCs. Funding UI is placeholder Alert.

### 8.4 Types

- `database.types.ts` — manual, partial, `[key: string]: any` fallback
- `lib/supabase.ts` — hardcoded URL/anon key (production ref in source)

---

## 9. State machines (current vs required)

| Domain | Current | Required |
|--------|---------|----------|
| Payment | Ad hoc / mock | created → requires_action → processing → confirmed/failed/cancelled/expired/reversed |
| Milestone workflow | Free-text status | locked → in_progress → in_review → approved → eligible_for_release → released |
| Milestone financial | Collapsed with workflow | release_authorized → payout_pending → processing → settled |
| Payout/withdrawal | requested/processed strings | requested → authorized → processing → submitted → settled (+ exceptions) |
| Dispute | Multiple tables/fields | open → under_review → resolved/cancelled |
| Escrow funding | `projects.status = escrow_funded` | Payment intent → PSP → webhook → ledger → state |

**Core invariant missing:** `APPROVED != PAID != RELEASED != SETTLED`

---

## 10. Financial invariants — test coverage

| Invariant | Phase 1/3A tests | Phase 3B tests | App tests |
|-----------|------------------|----------------|-----------|
| A — Balanced journal | phase3a_ledger_posting.sql | phase3b_escrow_funding.sql | NONE |
| B — Negative balance rules | phase3a | phase3b | NONE |
| C — Idempotency | phase3a | phase3b | NONE |
| D — Release requires journal | N/A | partial | NONE |
| E — PSP settlement mapping | N/A | phase3b | NONE |
| F — Reversal compensating | schema only | partial | NONE |
| G–J | NOT IMPLEMENTED | NOT IMPLEMENTED | NONE |

---

## 11. Identified conflicts (prioritized)

### P0 — Blockers

1. **Dual financial authority** — ledger vs transactions table
2. **Mock production payments** — process-escrow Edge
3. **Migration history** — **RESOLVED** (2026-09-02)
4. **Duplicate timestamp migrations** — **RESOLVED** (renamed)

### P1 — High

5. Client-driven `release_milestone` with arbitrary amount
6. No RLS on `transactions`/`withdrawals`
7. `user_can_access_project` grants write to all participants including observers (milestones/expenses)
8. Multiple dispute models
9. `amount` vs `amount_cfa` dual columns
10. Profiles public SELECT exposes verification paths

### P2 — Medium

11. Legacy untimestamped migrations vs phased apply strategy
12. Material cart mocked payment paths
13. Admin mark-paid without PSP proof
14. Warranty/retainage as project fields only
15. Quarantined 50,002 XAF withdrawal — reconciliation path undefined

---

## 12. Dependency graph (execution order)

```text
[1] Reconnaissance ← THIS DOCUMENT
[2] Migration rename ← DONE
[3] History repair ← DONE
[4] Phase 1/3A verify ← DONE (staging)
[5] Canonical money model ← BLOCKED until 5 designed
[6] Ledger invariant tests ← extend existing SQL tests
[7] Phase 3B.0 apply (staging) ← READY after 3
[8] Payment intents ← in 3B migration
[9] PSP/webhook ← 3B + Edge rewrite
[10] Phase 3B apply (staging)
[11–43] Milestone SM, release rebuild, disputes, RLS, app migration, docs
```

---

## 13. Tests required per fix (matrix)

| Fix phase | Required tests |
|-----------|----------------|
| History repair | migration list, schema_migrations query, object absence |
| 3B.0 apply | phase3b0 multisig, 72h expiry, funder RLS |
| 3B apply | phase3b_escrow_funding.sql full suite |
| Milestone SM | transition matrix, invalid transition rejected |
| Release rebuild | concurrent release, idempotency, FOR UPDATE |
| RLS hardening | per-role SELECT/INSERT/UPDATE/DELETE matrix |
| Legacy isolation | assert transactions INSERT blocked for authenticated |
| Webhook | replay, duplicate event ID, signature failure |
| Payout | insufficient balance, duplicate payout |
| Invariants | property tests on journal conservation |

---

## 14. Frozen decisions (must preserve)

```yaml
opening_ledger_balances: ZERO
quarantined_withdrawal:
  amount_xaf: 50002
  status: quarantined — no ledger backfill
dual_write: FORBIDDEN until approved plan
psp_activation: FORBIDDEN until approved
legacy_backfill: FORBIDDEN
production_changes: FORBIDDEN
```

---

## 15. Machine-readable status

```json
{
  "generated_at": "2026-09-02",
  "production_ref": "xtyqcdktwxzuezarnqhz",
  "staging_ref": "tvorurbmzrpwvxwztpix",
  "production_touched": false,
  "migration_history_reconciled": true,
  "applied_versions": ["20260813", "20260826100000"],
  "pending_versions": ["20260826110000", "20260826120000"],
  "staging_ledger_present": true,
  "staging_ledger_total_balance_xaf": 0,
  "staging_phase3b_objects": false,
  "legacy_financial_authority_in_app": true,
  "ledger_authority_in_app": false,
  "critical_blockers_remaining": [
    "dual_financial_model",
    "mock_process_escrow",
    "client_release_milestone",
    "missing_rls_transactions_withdrawals",
    "canonical_dispute_model",
    "amount_vs_amount_cfa"
  ]
}
```

---

## 16. Next approved work

1. ~~**Phase 5:** Design canonical `currency` + `amount_minor`~~ — **DONE** (20260902100000 applied staging)
2. **Phase 6:** Extend ledger invariant SQL tests on staging
3. **Phase 7:** Apply `20260826110000_phase3b0_multisig_approvals.sql` to staging only + run tests
4. **Phase 11:** Apply `20260826120000_phase3b_escrow_funding.sql` to staging only + run tests
5. **Do NOT** wire app to production; keep `lib/supabase.ts` pointed at production until explicit cutover task

---

## 17. Phase 5 status (2026-09-02)

```yaml
migration: 20260902100000_phase5_canonical_money.sql
staging_history: APPLIED
ledger_financial_impact: NONE
phase3b_applied: false
canonical_app_module: lib/money.ts
report: docs/PHASE5_REPORT.md
```

---

*This inventory is the prerequisite for all subsequent remediation phases. Update after each phase per master prompt §62.*
