# DiasporaBridge — Master Reconciliation & Execution Plan

```yaml
generated: 2026-09-02
last_verified: 2026-09-02
repo_commit: be1af5a0333a0b75867fdc60c6f8bb7670558e54
staging_ref: tvorurbmzrpwvxwztpix
production_ref: xtyqcdktwxzuezarnqhz
production_touched: false
status: CURRENT
authority: primary planning document (supersedes conflicting prose in older docs)
companion: CURRENT_STATE.yaml, DECISION_REGISTER.md, DOCUMENT_STATUS_INDEX.md
r00_1_reconciled: 2026-09-02
p00_implemented: 2026-09-02
p01_in_progress: false
p01_done: 2026-09-02
```

**Rule:** Repository code + verified staging schema beat document prose. Production was **not** queried or modified in this audit.

---

## SECTION A — Executive verdict

### What actually works (today)

| Area | Reality |
|------|---------|
| **Mobile app UX** | ~49 Expo Router screens; diaspora/provider/supplier/observer flows render |
| **Auth + roles** | Supabase Auth; role from metadata or `profiles.role`; **admin via `platform_admins` + `has_admin_role()`** |
| **Environment (dev)** | **Staging only** via `EXPO_PUBLIC_*`; `__DEV__` throws on production ref |
| **Ledger schema (staging)** | Phase 1 + 3A applied: 11 accounts, **0 journals**, deny-by-default RLS |
| **Phase 5 scaffolding (staging)** | `platform_currencies`, `amount_minor`/`currency` columns |
| **P00 security (staging DB)** | `transactions`/`withdrawals` RLS ON; client mutations denied; observer milestone writes blocked |
| **P00 security (app)** | Release/payout/escrow fail-closed; admin route gate; ledger balance RPC |

### Designed but not operational

| System | Repo | Staging | App |
|--------|------|---------|-----|
| Phase 3B.0 multisig (C05) | `20260902183828` | **APPLIED** — request-scoped auth | **not app-wired**; not operational payment processing |
| Phase 3B funding (C06) | `20260902191944` | **APPLIED** — inbound payment/ledger DB primitives | **not app-wired**; not live-money / PSP / webhooks |
| `rpc_release_milestone` (16-step) | spec only | **not exists** | no |
| FX quotes / EUR funding layer | spec | **not exists** | no |
| Evidence bundles | spec | **not exists** | scattered photos only |
| Payout state machine + instruments | spec | **not exists** | disabled (P00) |
| Reconciliation / treasury | spec | **not exists** | no |
| Domain event chain | spec | **not exists** | no |
| P01+C05+C06 schema | applied — 29 tables / 49 policies | **applied** | compiles against generated types; live money NO |

### POST-P00 current state (verified 2026-09-02)

| Control | Status |
|---------|--------|
| Dev app target | **Staging** (`EXPO_PUBLIC_*`) |
| `transactions` RLS | **ON** — client INSERT/UPDATE/DELETE denied |
| `withdrawals` RLS | **ON** — client INSERT/UPDATE/DELETE denied |
| Client release | **Disabled** — fail-closed UX; C07 not built |
| Client payout | **Disabled** — fail-closed UX; C08 not built |
| Admin | `platform_admins` + `has_admin_role()` + route gate; **0 seeded admins** |
| Profiles | Own-row SELECT; `profiles_public` safe view |
| Observer writes | Blocked on milestones (P00 `user_can_write_project`) |
| `process-escrow` | **503 fail-closed in repo**; staging edge deploy **unverified** |
| Material QR handoff | Scan action **disabled** (P00); D07 tokens not built |

### PRE-P00 exploit state (historical — no longer current on staging)

These findings drove P00. They are **not** current staging/app truth after P00:

1. ~~`lib/supabase.ts` pointed at production~~ → **fixed (P0.7)**
2. ~~Client release inserted `transactions` + milestone `paid`~~ → **disabled (P0.1 + app)**
3. ~~`transactions` / `withdrawals` RLS OFF~~ → **RLS ON (P0.1)**
4. ~~Admin routes ungated~~ → **gated (P0.2)**
5. ~~`process-escrow` mock success~~ → **503 fail-closed in repo (P0.3)**
6. ~~Material QR client-signed authoritative~~ → **scan disabled (P0)**
7. ~~Observers UPDATE milestones~~ → **write predicate excludes observers (P0.6)**
8. Staging minimal schema vs app — **P01 addresses reproducibility**

### What changed since original blueprint (2026-09-02 docs)

- Phase 5 migration **applied to staging**.
- **P00 security lockdown applied to staging** (`20260902122609`).
- App release path **fail-closed** (no client money writes).
- Dev environment **requires staging** `EXPO_PUBLIC_*` config.
- **P01** migration chain restructured: legacy SQL archived; Phase 3B isolated in `future_migrations/`.

### What blocks real money

```text
P0 security chain unbroken
  → app must not point at production
  → legacy tables frozen (RLS deny)
  → admin + webhooks gated
  → no mock PSP success

Database foundation (P01)
  → reproducible schema from migrations
  → staging must match app expectations OR app must use staging ref

C05–C06 Phase 3B.0 + 3B on staging
  → authoritative inbound funding

C07 rpc_release_milestone
  → no client amount; ledger milestone_release only

C08 payout engine + verified instruments

C13 reconciliation + treasury model

Legal/regulatory operating model frozen
```

---

## SECTION B — Environment state (post-P01.10)

| | **REPO** | **STAGING** (`tvorurbmzrpwvxwztpix`) | **PRODUCTION** (`xtyqcdktwxzuezarnqhz`) |
|---|----------|--------------------------------------|------------------------------------------|
| Active migrations | **7** (bootstrap + Phase1/3A/5/P00/P01/P01.10) | **7 applied — history aligned** | Not queried |
| Public tables | 26 | **26** | Not queried |
| Ledger balance | N/A | **0 XAF** | Not queried |
| Journals | N/A | **0** | Not queried |
| App connection (dev) | `EXPO_PUBLIC_*` | **Staging when configured** | **Blocked in __DEV__** |
| Phase 3B | `future_migrations/` | **Absent** | Not queried |
| Phase 5 | active migration | **Applied** | Not queried |
| P00 | active migration | **Applied** (`20260902122609`) | Not queried |
| Clean reset | **PASS** | N/A (remote) | Forbidden |

### Staging applied migrations (verified 2026-09-02 P01.10)

```text
20260812000000           p01_minimal_bootstrap
20260813                 phase1_ledger
20260826100000           phase3a_ledger_posting
20260902100000           phase5_canonical_money
20260902122609           p00_security_lockdown
20260902140000           p01_core_app_schema
20260902162321           p01_10_favorite_providers
```

### PRE-P01 HISTORICAL (no longer current)

Before P01 apply, staging had ~12 tables and 4 migration markers. That state is superseded.

### Staging public tables (current — post C06 schema apply)

```text
29 base tables (28 prior + payments)
49 policies
C05 + C06 present; rpc_release_milestone ABSENT
ledger journals 0; live money NO; PSP NOT activated
```

---

## SECTION C — Document reconciliation matrix

See **`DOCUMENT_STATUS_INDEX.md`** for full file-by-file status and stale-statement log.

**Summary:** Phase 5 supporting docs written *during* Phase 5 apply contain sections that say "not applied" — those are now **stale**. Blueprint/roadmap/risk register remain valid as **gap analysis** but drift on staging apply state, release path, and line numbers.

---

## SECTION D — Decision register

See **`DECISION_REGISTER.md`** for decisions 1–31, Phase 5 naming, hireProvider verification, fee rounding table.

---

## SECTION E — Canonical architecture (ASCII)

```text
                         DIASPORABRIDGE (POST-P00)
                               │
             ┌─────────────────┴──────────────────┐
             │                                    │
       EXPERIENCE LAYER                     CONTROL PLANE
       (Expo app — staging dev)            Auth / RLS / Admin (P00 partial)
             │                                    │
     Client / Provider /                 platform_admins + has_admin_role
     Supplier / Observer                 profiles_public + read/write split
             │
             └─────────────────┬──────────────────┘
                               │
      ┌────────────────────────┼─────────────────────────┐
      │                        │                         │
   PROJECT                  TRUST                      MONEY
   (P01 schema)            (partial)                  (frozen)
      │                        │                         │
 Milestones*              profiles/KYC?              Ledger (empty, safe)
 Contracts                ratings                    Legacy transactions [FROZEN]
 Evidence (photos)        QR handoff [DISABLED]      Withdrawals [FROZEN]
 Materials (carts)*                                  process-escrow [503]
 Disputes* (temp table)                              Phase 3B [NOT APPLIED]

 * = workflow only; no client financial mutation (P00)
 LEGACY — WRITE FROZEN = transactions, withdrawals client writes denied
 DISABLED P00 = release, payout, material scan, mock escrow success
```

**Target control plane (not built):** explicit RPC transitions, ledger-only cash, server-signed tokens, separated read/write predicates.

---

## SECTION F — Canonical money lifecycle (target)

```text
EUR CLIENT
   ↓
FX QUOTE (fx_quotes — NOT BUILT)
   ↓
PAYMENT INTENT (rpc_create_payment_intent — NOT APPLIED)
   ↓
PSP (forbidden until approved)
   ↓
SIGNED WEBHOOK (escrow-webhook — NOT AUTHENTICATED)
   ↓
rpc_post_escrow_funding → ledger_post_journal(escrow_funding)
   ↓
PROJECT ESCROW (ledger account)
   ↓
EVIDENCE BUNDLE ACCEPTED (NOT BUILT)
   ↓
CLIENT APPROVAL (workflow_state)
   ↓
rpc_release_milestone (NOT BUILT) → ledger_post_journal(milestone_release)
   ↓
PROVIDER PAYABLE
   ↓
PAYOUT STATE MACHINE + payout_instruments (NOT BUILT)
   ↓
MoMo / Orange
   ↓
RECONCILIATION (NOT BUILT)
```

**Current reality (post-P00):** Client release/payout paths are **fail-closed**. Workflow status changes do not post ledger journals or insert legacy transactions.

---

## SECTION G — Canonical project lifecycle

**Happy path (target):** create → hire → contract v1 → fund (ledger) → milestones (workflow) → evidence → approve → release (RPC) → payout → retainage → complete → warranty → close.

**Abnormal (designed, not built):** change order, dispute freeze, cancellation matrix, provider replacement, refund, partial supplier fulfilment.

**Current app (post-P00):** hire via `hireProvider` (client INSERT milestones with `amount_minor` only); fund/release/payout **disabled**; disputes via `trigger_dispute` RPC + direct table writes where schema exists.

---

## SECTION H — System scorecard

Scores are **verified maturity** (0–5): 0 absent, 1 designed, 2 migrated, 3 app-wired, 4 tested, 5 operational.

| System | Old doc score | Verified | Exists | Missing | Blocker | Priority |
|--------|---------------|----------|--------|---------|---------|----------|
| Ledger | strong design | **2** | schema+posting RPC | journals, app reads | no inbound/outbound RPCs | **P01/C06** |
| Phase 3B funding | C05+C06 schema applied | **2** | payments+RPCs on staging | app_wired/live money | C03/C11/C12/C13/legal | **live blockers** |
| CI/DR | local green | **2** | workflow + local pass | GitHub Actions not executed | hosted CI | **ops** |
| Phase 5 money | "complete" | **2** | staging columns | legacy retirement | app legacy paths | **C02** |
| Release | broken legacy | **1** | UI fail-closed | rpc_release_milestone | P00 disabled client path | **C07** |
| Payout | legacy queue | **1** | withdrawals frozen | state machine, instruments | P00 disabled | **C08** |
| FX | spec | **0** | — | all tables | corridor design | **C03** |
| Fees | partial | **2** | bps helpers | fee_schedules table | insurance naming | **C04** |
| Evidence | scattered | **1** | photos | bundles, verdicts | gating | **D02** |
| Disputes | 3 models | **1** | partial SQL | unified model + freeze | ledger tie-in | **D04-D06** |
| Materials | UI | **1** | carts in repo | server handoff token | client QR sign | **D07** |
| Admin | P00 partial | **2** | platform_admins + gate | seeded admins, audit | operational access | **E6** |
| Security P0 | implemented | **3** | staging DB + app | edge deploy verify, alerts | P0.4/P0.8 partial | **done/P01** |

---

## SECTION I — Security state (S1–S19 post-P00)

| ID | Pre-P00 | Post-P00 | Evidence | Residual | Next |
|----|---------|----------|----------|----------|------|
| S1 | OPEN | **MITIGATED** | transactions RLS ON; INSERT revoked | modified client blocked on staging | maintain |
| S2 | OPEN | **MITIGATED** | release fail-closed; no client transactions insert | C07 not built | C07 |
| S3 | OPEN | **MITIGATED** | withdraw UI disabled; withdrawals INSERT denied | C08 not built | C08 |
| S4 | OPEN | **MITIGATED (repo)** | escrow-webhook 503 | staging edge deploy unverified | deploy + C11 |
| S5 | OPEN | **MITIGATED (repo)** | process-escrow 503 | staging edge deploy unverified | deploy + C11 |
| S6 | OPEN | **MITIGATED** | platform_admins + has_admin_role + admin/_layout | no seeded admins | ops seed |
| S7 | OPEN | **PARTIAL** | scanner disabled | D07 server tokens | D07 |
| S8 | OPEN | **MITIGATED** | profiles own-row; profiles_public | — | maintain |
| S9 | OPEN | **MITIGATED** | user_can_write_project on milestone writes | — | maintain |
| S10 | OPEN | **N/A staging** | webhook_outbox absent | legacy baseline risk | P01 archive |
| S11 | OPEN | **MITIGATED (repo)** | push service-role / disabled | edge deploy unverified | deploy |
| S12 | OPEN | **MITIGATED** | EXPO_PUBLIC_* only; __DEV__ guard | .env required | maintain |
| S13 | OPEN | **MITIGATED** | admin markAsPaid disabled | C08 payout engine | C08 |
| S14–S19 | OPEN | **OPEN/PARTIAL** | rate limiting, 2FA, etc. | — | E-phase |

**S1–S7 formed a viable exploit chain PRE-P00. P00 breaks the client-side chain on staging. Residual:** edge deployment verification, D07 material tokens, C07/C08 canonical money, S17 rate limiting.

---

## SECTION J — Money field authority map (summary)

Full detail in `FINANCIAL_FIELD_INVENTORY.md`. Key rows (**post-P01.10**):

| Table | Field | Authoritative? | Legacy? | App writers (current) | Target |
|-------|-------|--------------|---------|----------------------|--------|
| ledger_accounts | balance_xaf | **YES** (when funded) | no | RPC only | keep |
| milestones | amount_minor | workflow contract | no | hireProvider (client) | server RPC (D01) |
| milestones | amount_cfa | no | **yes** | **none** (no current app write) | retire C14 |
| transactions | amount | no | **yes** | **DENIED** (P00 RLS) | freeze + retire C14 |
| withdrawals | amount / amount_minor | no | **yes** | **DENIED** (P00 RLS) | C08 payout RPC |
| projects | budget | no | **yes** | display adapter only | estimated_budget_minor |
| projects | estimated_budget_minor | planning | no | diaspora/new + adapters | keep |
| payments | amount_xaf | **YES** (when C06 live) | no | none yet | C06 |

---

## SECTION K — State machines (target)

**Milestone workflow:** LOCKED → IN_PROGRESS → SUBMITTED → IN_REVIEW → APPROVED (separate from financial).

**Milestone financial:** UNFUNDED → FUNDED → RELEASED (ledger RPC only).

**Payout:** NOT_PAYABLE → PAYABLE → REQUESTED → AUTHORISED → PROCESSING → SUBMITTED → SETTLED (+ FAILED/RETURNED/HELD).

**Current app:** collapses to `milestones.status` strings including `paid`, `locked`, `in_review` — **must split** per D01.

---

## SECTION L — RLS / authorization matrix (summary)

| Action | Client | Observer | Provider | Admin | Service |
|--------|--------|----------|----------|-------|---------|
| SELECT project | yes | yes | yes | via admin roles | yes |
| UPDATE milestone | owner (write helper) | **DENY** | assigned provider | should RPC | yes |
| INSERT transaction | **DENY** (P00) | DENY | **DENY** (P00) | DENY | yes |
| INSERT withdrawal | **DENY** (P00) | DENY | **DENY** (P00) | DENY | yes |
| ledger_post_journal | deny | deny | deny | deny | **only** |
| rpc_release_milestone | **ABSENT** | — | — | — | — |

**Multi-funder RELEASE:** **OPEN** — Decision #18.  
**Multi-funder FUNDING approvals:** Decision #31 **FROZEN**. C05 **APPLIED TO STAGING** (`20260902183828`) — authorization only, not payment processing.  
`projects.funder_ids` protected by C05 roster trigger + add-only RPC.

---

## SECTION M — Execution roadmap (authoritative namespaces)

### R00 — Document reconciliation ✅ (this audit)

### P00 — Security stop-the-bleeding ✅ (2026-09-02)

| ID | Task | Status | Evidence |
|----|------|--------|----------|
| P0.1 | Enable RLS deny on transactions/withdrawals; revoke client INSERT | **DONE** | Staging `rowsecurity=true`; grants show SELECT only for anon/authenticated; anon INSERT test passes |
| P0.2 | platform_admins + has_admin_role + admin layout gate | **DONE** | Migration `20260902122609`; `admin/_layout.tsx`; zero seeded admins |
| P0.3 | process-escrow fail-closed without PSP keys | **DONE** (repo) | Early 503 `legacy_escrow_disabled`; staging edge deploy not verified in P00 |
| P0.4 | Webhook/push auth + signatures | **PARTIAL** | escrow-webhook 503; push service-role gate; PSP crypto verification deferred to C11 |
| P0.5 | profiles_public view; drop SELECT true | **DONE** | profiles own-row policy; `profiles_public` view |
| P0.6 | Split read vs write project predicates; observer read-only | **DONE** | `user_can_read_project` / `user_can_write_project`; milestone write policy updated |
| P0.7 | Env-based Supabase URL; **app → staging** for dev | **DONE** | `lib/supabaseEnv.ts`, `.env.example`, `app.config.ts`; only production ref in guard constant |
| P0.8 | Ledger invariant monitoring/alerts | **PARTIAL** | `ledger_healthcheck()` returns balanced at 0; no alert transport / pg_cron schedule |

### P01 — Database + app foundation (P01.9 + P01.10, 2026-09-02)

| ID | Task | Status |
|----|------|--------|
| P01.1 | Timestamp/order all migrations; resolve 23 untimestamped files | **DONE (P01 historical)** — at P01 close: 7 active, 21 legacy, 2 future; **current chain later grew with C05/C06** |
| P01.2 | Authoritative CREATE TABLE for core tables | **DONE** — `20260902140000` + `20260902162321` favorites |
| P01.3 | `supabase db reset` reproduces staging intent | **P01 historical completion evidence** — at P01 close C05/C06 not executed; **current** reset includes C05+C06 (9 migrations) |
| P01.4 | Regenerate database.types.ts from staging | **DONE** |
| P01.5 | CI: SQL tests + tsc + lint | **DONE** locally — GitHub Actions not executed in session |
| P01.6 | Staging migration history aligned | **DONE** |
| P01.7 | App compiles against P01 schema | **DONE** — `tsc --noEmit` PASS; lint 0 errors |
| P01.8 | Observer write policy documented | **DONE** — Decision Register: observers cannot UPDATE milestones |
| P01.9 | Database reproducibility certification | **DONE** |
| P01.10 | App contract + CI closure | **DONE** |

**Overall P01:** **DONE** (binary store identifiers still product-blocked; does not block C05 schema review)

### C01–C14 — Financial core

| ID | Task | Deps | Status |
|----|------|------|--------|
| C01 | Freeze decisions (fee truncate, platform_currencies, no insurance semantics) | R00 | **DONE** (register) |
| C02 | Phase 5 legacy read migration in app; stop new numeric writes | P01 | PARTIAL |
| C03 | FX tables + quote consumption | C01 | NOT STARTED |
| C04 | fee_schedules + rename insurance helper (additive) | C01 | NOT STARTED |
| C05 | **APPLIED TO STAGING + VERIFIED** (`20260902183828`) | P0, P01, Decision #31 | authorization infra only — no payments |
| C06 | **APPLIED TO STAGING — SCHEMA ONLY** (`20260902191944`) | C05 | not app-wired; live money NO |
| C07 | Build rpc_release_milestone (16-step) | C06, D01-D03 | NOT STARTED |
| C08 | Payout engine + payout_instruments | C07 | NOT STARTED |
| C09 | Refunds/reversals/chargebacks | C07 | NOT STARTED |
| C10 | Material money path (ledger) | D07 | NOT STARTED |
| C11 | Edge function hardening | P0.3–4 | NOT STARTED |
| C12 | PSP integration (still forbidden until approved) | C06, legal | BLOCKED |
| C13 | Reconciliation + treasury | C08 | NOT STARTED |
| C14 | Legacy retirement | C07–C08 | NOT STARTED |

### D01–D07 — Workflow

| ID | Task | Status |
|----|------|--------|
| D01 | Split milestone workflow/financial/payout states | NOT STARTED |
| D02 | evidence_bundles + requirements + verdicts | NOT STARTED |
| D03 | Evidence gate on release | NOT STARTED |
| D04 | Unified dispute model + ledger freeze | NOT STARTED |
| D05 | Real freeze (ledger holds) | NOT STARTED |
| D06 | Arbitration decision → journals | NOT STARTED |
| D07 | Server-signed material handoff tokens | NOT STARTED |

### E / F / G — Security, trust, scale (abbreviated)

- **E01–E08:** KYC tables, legal acceptances, 2FA admin, rate limits, storage policies
- **F01–F08:** Admin console, kill switches, support tickets, trust engine, ops runbooks
- **G01–G04:** Offline outbox, beneficiary scopes, analytics (non-authoritative), DR runbook

### New explicit work packages (from user brief)

| ID | Topic | Namespace |
|----|-------|-----------|
| D08 | Change orders / variations | D |
| D09 | Project cancellation matrix | D |
| D10 | Provider abandonment/replacement | D |
| D11 | Client approval SLA + escalation | D |
| E09 | Contract engine v1 | E |
| E10 | Legal acceptance records | E |
| C15 | Partial material fulfilment qty model | C |
| F09 | Disaster recovery RPO/RTO | F |
| F10 | Financial feature kill switches | F |

### Phase crosswalk (legacy → namespaced)

| Legacy reference | Namespaced |
|------------------|------------|
| Phase 0 / Roadmap 0.x | **P00** |
| Phase 1 / 1.1 / 1.2 | **P01** |
| Phase 3B.0 | **C05** |
| Phase 3B | **C06** |
| Phase 5 | **C02** (scaffolding done) |
| Phase 6 (PHASE5_REPORT) | **P01.5** ledger invariant tests |
| Phase 7 / C7 release | **C07** |
| Phase 11–12 PSP | **C12** |
| Phase 18 advance | **C04/D** design blocker |
| Phase 39 ledger reads | **C14** |
| Product phases A–G | **P/C/D/E/F/G** as above |

---

## Object inventory table (§5 summary)

| Object | Repo | Staging | App callers | Authoritative? | Status |
|--------|------|---------|-------------|--------------|--------|
| ledger_accounts | 20260813 | YES (11 rows) | none | YES (when used) | empty |
| ledger_post_journal | 20260826100000 | YES | none | YES | ready |
| platform_currencies | 20260902100000 | YES (XAF) | none | metadata | applied |
| payments | 20260902191944 | **YES** | none | inbound funding | C06 schema; live money NO |
| escrow_funding_requests | 20260902183828 | **YES** | none | funding auth | C05 applied |
| escrow_funder_approvals | 20260902183828 | **YES** | none | funding auth | C05 applied |
| rpc_create_payment_intent | 20260902191944 | **YES** | none | — | C06 schema |
| rpc_post_escrow_funding | 20260902191944 | **YES** | none | — | C06 schema; service_role |
| release_milestone | legacy/monopoly | **NO** | none | no | DO NOT RECREATE |
| rpc_release_milestone | 01_CANONICAL_MODELS | **NO** | none | target | C07 future |
| transactions | bootstrap + P00 | YES **RLS ON** | none (ledger RPC) | **NO** | **FROZEN** |
| withdrawals | bootstrap + P00 | YES **RLS ON** | admin read-only | **NO** | **FROZEN** |
| milestones.amount_minor | phase5 | YES | hireProvider | workflow | partial |
| process-escrow | functions | **503 repo** | none | **NO** | edge deploy verify |
| escrow-webhook | functions | **503 repo** | none | **NO** | edge deploy verify |

---

## Dependency graph (§58)

```text
                   R00 DOCUMENT RECONCILIATION ✅
                            │
                            ▼
              P00 SECURITY ✅ (operational verify PARTIAL)
                            │
                            ▼
              R00.1 POST-P00 DOC RECONCILIATION ✅
                            │
                            ▼
              P01 DATABASE + APP FOUNDATION ✅
                            │
                            ▼
              C05 ✅ request-scoped funding authorization
                            │
                            ▼
              C06 ✅ inbound funding DB primitives (schema only; live money NO)
                            │
                ┌───────────┴─────────────┐
                ▼                         ▼
     C03/C09/C11/C12/C13/legal        D01/D02
     (before live money)                  │
                │                         │
         C07 release (later)              │
                └───────────┬─────────────┘
                            ▼
                    (not yet operational funding)
```

---

## Launch gate (§59) — current

| Requirement | Met? |
|-------------|------|
| No client balance mutation | **YES (P00)** |
| No client-controlled release amount | **YES (P00)** |
| Admin server-side gate | **YES (P00)** — no seeded admins |
| Phase 3B funding operational | **NO** |
| Signed webhooks | **NO** — fail-closed stubs |
| No mock success | **YES (repo)** — edge deploy unverified |
| Canonical money in all paths | **NO** |
| Ledger-only cash authority | **PARTIAL** — ledger empty; legacy frozen |
| rpc_release_milestone | **NO** |
| Evidence gating | **NO** |
| Payout state machine | **NO** |
| Reconciliation | **NO** |
| KYC + limits | **NO** |
| DB rebuild tested | **YES** — local clean reset PASS (P01, 7 migrations) |
| CI + backup/restore | **PARTIAL** — workflow added |
| Financial kill switch | **PARTIAL** — P00 fail-closed |

**Verdict: NO GO for real-money beta.**

---

## Test strategy (§60) — required before beta

- **SQL:** phase3a/3b/5 suites + new release/concurrency/RLS deny tests
- **TS:** money helpers (exists), role helpers, payout validation
- **Integration:** webhook replay, idempotent funding, failed payout reversal
- **E2E:** full corridor happy path + dispute + cancellation scenarios

---

## Machine-readable status (§63)

See **`docs/CURRENT_STATE.yaml`**.

---

## Document authority hierarchy (§64)

1. Repo + verified staging schema  
2. DECISION_REGISTER.md  
3. **This document**  
4. 01_CANONICAL_MODELS + 02_BUILD_ROADMAP  
5. Phase reports  
6. Historical snapshots  
7. Product vision (00 blueprint intent)

---

## 68 questions — answers

| # | Question | Answer |
|---|----------|--------|
| 1 | Actual staging schema? | **28** public tables; P01 + C05 auth objects; see §B |
| 2 | Applied migrations? | **8** canonical identities (aligned local/staging) |
| 3 | Phase 5 complete? | **Scaffolding yes; migration complete no** (C14 remains) |
| 4 | Stale docs after Phase 5? | Historical maps remain HISTORICAL; fee rounding reconciled P01.9 |
| 5 | hireProvider amount_minor? | **Yes — amount_minor only** (no amount_cfa write) |
| 6 | Client writes authoritative money? | **No** — transactions/withdrawals write-frozen (P00); settlement via ledger only |
| 7 | transactions reachable? | **No** — RLS ON; client INSERT denied (P00) |
| 8 | release_milestone callable? | **Not on staging**; app no longer calls it |
| 9 | Observer mutate financial data? | **No** — `user_can_write_project` excludes observers |
| 10 | /admin gated server-side? | **Yes** — `platform_admins` + `has_admin_role()` + admin layout gate |
| 11 | process-escrow fake success? | **No** — repo 503 fail-closed; **absent on staging** (fail-closed by absence) |
| 12 | Webhook signatures enforced? | **Deferred C11** — webhook absent on staging |
| 13 | Phase 3B funding (C06) unapplied? | **No** — C06 applied (`20260902191944`); schema only; live money NO |
| 14 | Zero ledger funding callers? | **Yes** |
| 15 | Currency table name? | **platform_currencies** |
| 16 | Fee rounding frozen? | **Truncate toward zero** |
| 17 | Why insurance helper? | Phase 3B/5 naming; **rename to service fee** (decision 21 / C04) |
| 18 | Multi-funder release authority? | **OPEN** — owner default + funders veto TBD (C05 funding only) |
| 19 | 16-step release canonical? | **Yes** — do not abbreviate |
| 20 | DB recreate from zero? | **Yes (local)** — **9** active migrations including C05+C06 |
| 21 | CI operational? | **Local engineering checks PASS** (lint/tsc/reset/SQL via npm install substitute). **npm ci reproducibility on Windows host NOT VERIFIED** (EPERM on esbuild). **GitHub Actions NOT EXECUTED**. |
| 22 | Binary build (EAS)? | **BLOCKED ON PRODUCT IDENTIFIER** — `eas.json` present; no bundleIdentifier/package |
| 23 | Before rpc_release_milestone? | P01+C05+C06 schema DONE; D01–D03, C04, decision 18, live-money deps remain |
| 24 | Before PSP enable? | Above + C12 + legal model + reconciliation |
| 25 | Real-money beta conditions? | Launch gate §59 — financial phases still NO |

---

## Recommended next implementation phase

**P00 + P01 + C05 + C06 schema complete.** C06 inbound-funding database infrastructure is on staging. It is **not** operational funding.

**Exact next action:** Address live-money dependencies (**C03 / C09 / C11 / C12 / C13 / legal**) before any PSP activation, webhook deploy, or funding UI. Do **not** jump to C07 solely because C06 RPCs exist. Binary IDs still blocked on product.

---

*End of master plan. Production untouched. No money moved.*

*R00 original audit (2026-09-02): no migrations applied during audit.*
*P00 implementation: security migration applied to staging (`20260902122609`). Financial impact: none.*
*P01: active migration chain restructured; staging P01 apply + history aligned (P01.9); app/CI closure (P01.10).*
