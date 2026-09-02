# DiasporaBridge — Decision Register

```yaml
generated: 2026-09-02
last_verified: 2026-09-02
repo_head: be1af5a0333a0b75867fdc60c6f8bb7670558e54
working_tree_state: uncommitted P00/P01 + C05 apply (20260902183828 staging; C06 future)
staging_ref: tvorurbmzrpwvxwztpix
production_ref: xtyqcdktwxzuezarnqhz
production_touched: false
status: ACTIVE
authority: docs/04_MASTER_RECONCILIATION_AND_EXECUTION_PLAN.md
supersedes: scattered decisions in 00–03 docs and REMEDIATION_INVENTORY
```

Statuses: **FROZEN** · **OPEN** · **BLOCKED ON LEGAL** · **BLOCKED ON PRODUCT**

---

## Original decisions (1–17) — reconciled

| # | Decision | Options | Recommendation | Status |
|---|----------|---------|----------------|--------|
| 1 | Ledger is sole cash authority | ledger_* vs transactions | **ledger_*** | **FROZEN** (not operational) |
| 2 | Settlement currency | XAF only in ledger | **XAF** | **FROZEN** |
| 3 | No dual-write legacy+ledger | forbidden vs allowed | **forbidden** | **FROZEN** |
| 4 | No legacy backfill without plan | forbidden | **forbidden** | **FROZEN** |
| 5 | Opening ledger balances | 0 vs reconstructed | **0** | **FROZEN** |
| 6 | Production quarantine 50,002 XAF | do not modify | **do not modify** | **FROZEN** |
| 7 | No PSP activation until approved | forbidden | **forbidden** | **FROZEN** |
| 8 | No production schema changes | forbidden | **forbidden** | **FROZEN** |
| 9 | APPROVED ≠ RELEASED ≠ PAID ≠ SETTLED | separate state machines | **separate** | **FROZEN** — P00 removed client fake-settlement path; canonical D01/C07/C08 release states not yet implemented |
| 10 | Foreign currency in payments/fx only | ledger multicurrency vs payments layer | **payments/fx layer** | **FROZEN** |
| 11 | EUR→XAF peg for v1 corridor | peg vs live FX | **peg with quote record** | **OPEN** (FX tables not built) |
| 12 | Launch corridor DE→CM construction | narrow vs broad | **narrow beta** | **FROZEN** (product) |
| 13 | Regulatory model for client funds | A licensed PI / B agent / C PSP MoR | **Investigate with counsel** | **BLOCKED ON LEGAL** |
| 14 | Retainage on final milestone | 10% warranty hold | **10% retainage via ledger** | **OPEN** (not implemented) |
| 15 | Dispute arb authority | internal / external / hybrid | **hybrid with documented arb** | **BLOCKED ON LEGAL** |
| 16 | Legacy transactions retirement | freeze RLS deny → retire | **freeze then retire (C14)** | **FROZEN** direction |
| 17 | Phase numbering | ambiguous vs namespaced | **Use R## / P## / C## / D## / E## / F## / G##** | **FROZEN** (this register) |

---

## New decisions (18–30)

| # | Decision | Options | Recommendation | Status |
|---|----------|---------|----------------|--------|
| 18 | Multi-funder release authority | owner only / N-of-N / threshold / delegated controller | **Owner releases; co-funders get veto window before first release (TBD).** Release authority remains **OPEN**. Funding multisig is separately frozen in **Decision #31** (request-scoped; does not decide release). | **OPEN** |
| 19 | Fee rounding rule | truncate toward zero / round half up | **Truncate toward zero** — matches applied Phase 3B/5 SQL + TS (`platform_fee_bps_minor`, `insuranceFeeMinor`). `01_CANONICAL_MODELS.md` reconciled P01.9. Diff only at 101 XAF (1 vs 2). | **FROZEN** (applied code wins) |
| 20 | Canonical currency table name | `currencies` vs `platform_currencies` | **`platform_currencies`** — exists on staging; do not create second table | **FROZEN** |
| 21 | Insurance vs service fee | insurance premium / platform service fee | **Rename semantics to platform service fee** (`platform_fee_service_minor` additive migration later). No insurance product without insurer. | **OPEN** (rename not applied) |
| 22 | Client approval SLA | auto-approve / manual review / provider escalate | **Provider escalate + manual review default; auto-approve only after legal sign-off** | **BLOCKED ON LEGAL** |
| 23 | Project cancellation policy | per-case matrix | **Define matrix in D-engine; ledger journals only** | **OPEN** |
| 24 | Provider replacement policy | new contract + preserved history | **New contract version + assignment RPC; preserve provider history** | **OPEN** |
| 25 | Change-order financial semantics | mutate milestone vs new milestone/version | **Never mutate committed amounts; change order → new milestone/version + funding delta** | **FROZEN** direction |
| 26 | Payout destination change policy | immediate / cooldown+notify | **24–48h cooldown + owner notification + audit event** | **OPEN** |
| 27 | Contract versioning/signature model | client PDF vs server contract engine | **Server contract engine with hash archive (§37 blueprint)** | **OPEN** |
| 28 | Supplier partial-delivery payment rule | pay on cart approval vs collected qty | **Pay on collected/accepted qty only unless explicit prepay term** | **OPEN** |
| 29 | DR RPO/RTO | TBD | **RPO 24h / RTO 4h target for beta; document runbook before live money** | **OPEN** |
| 30 | Financial kill-switch authority | admin roles | **treasury_approver + super_admin; audited in admin_action_log** | **OPEN** |
| 31 | Multi-funder **FUNDING** authorization scope | project-scoped 72h reusable vs request-scoped | **Request-scoped.** Co-funder approval authorizes exactly one funding request: `funding_request_id` (= C06 `client_request_id`) + `project_id` + `requested_by` + exact `amount_xaf`. Quorum = N-of-N **current** distinct co-funders (`projects.funder_ids`); card=0 → no co-funder approval. Window = 72h on `approved_at`. Consumption = first successful `rpc_create_payment_intent`. Reuse across requests/amounts **forbidden**. Release authority = **none** (see #18). **Evidence:** C05 applied staging `20260902183828`; local C05 tests PASS; staging verification PASS. | **FROZEN** |

---

## Phase 5 naming decision

| Label | Meaning | Accurate today? |
|-------|---------|-----------------|
| **Phase 5 — Canonical money scaffolding** | Added `amount_minor`, `currency`, `platform_currencies`, fee helpers; documented ledger equivalence | **YES (staging)** |
| **Phase 5 — Canonical money migration complete** | No numeric money columns; all paths use bigint+currency; legacy retired | **NO** |

**Recommendation:** Retitle reports to **"Phase 5 scaffolding complete (staging)"** until C14 legacy retirement.

---

## hireProvider verified behavior (2026-09-02, P01.9)

| Question | Answer |
|----------|--------|
| Writes `amount_minor`? | **YES** |
| Still writes `amount_cfa`? | **NO** (P01.9 — canonical write only) |
| Violates ledger dual-write freeze? | **NO** (legacy columns only; no ledger write) |
| Uses Number or BigInt? | **Number** (`Math.floor` on bidAmount) |
| Derives from `projects.budget`? | **NO** — uses `bidAmount` param |
| Client-side milestone creation? | **YES** — direct INSERT |
| Observers can mutate amounts after? | **NO** — P00 `milestones_update` uses `user_can_write_project`, which excludes observers (owner/provider only). `user_can_access_project` is read-path. |

---

## Release RPC target (unchanged)

Authoritative contract remains **`rpc_release_milestone(p_milestone_id uuid, p_client_request_id uuid)`** with 16-step checks in `01_CANONICAL_MODELS.md` §3.3. **Do not build abbreviated variants.**

---

## Fee rounding evidence (150 bps / 1.5%)

| Gross XAF | Truncate `(g*15)/1000` | Half-up `round(g*15/1000)` | Differs? |
|-----------|------------------------|----------------------------|----------|
| 1 | 0 | 0 | no |
| 33 | 0 | 0 | no |
| 67 | 1 | 1 | no |
| 99 | 1 | 1 | no |
| 101 | **1** | **2** | **yes** |
| 1,000,001 | 15,000 | 15,000 | no |

**Frozen rule:** truncate (applied in DB + TS).
