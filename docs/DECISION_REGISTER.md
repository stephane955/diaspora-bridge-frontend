# DiasporaBridge — Decision Register

```yaml
generated: 2026-09-02
last_verified: 2026-09-04
repo_head: fbea0b12c18c1936b34ffe00a5db2a29719c66d7
working_tree_state: C05/C06/C03/C12 applied staging schema only; post-C12 index drift documented (6 P01 lookup indexes missing on staging); C11-D1 design; live money NO
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
| 11 | EUR→XAF corridor pricing/reference | peg vs live FX vs provider executable quote | **See freeze below (C03-D1).** Historical wording was “peg with quote record.” | **FROZEN** (C03-D1) |
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
| 32 | Cross-border funding denomination / quote direction | TARGET-XAF-FIRST vs SOURCE-EUR-FIRST | **V1 TARGET-XAF-FIRST.** Client selects exact Cameroon project funding target in XAF. C05 authorizes that exact XAF. Trusted provider supplies exact foreign `source_amount_minor` + execution economics to deliver the target. Quote binds to `funding_request_id` + requester + project + exact target XAF. Source-first “I want to spend €N” is **DEFERRED** (separate future design). Not release governance. | **FROZEN** (C03-D1) |
| 33 | Payment vs attempt provider authority | Model A same-provider on P1 vs Model B provider-per-attempt | **V1 Model A.** One logical payment → one canonical `payments.psp_provider`. Every C12 attempt MUST use that same provider. Cross-provider retry **DEFERRED**. No C06 provider redesign in V1. Evidence: C06 create/idempotency/mark_succeeded/ledger purpose. | **FROZEN** (C12-D2) |
| 34 | Logical payment status vs attempt status on retry | Attempt failure ⇒ P1 failed vs attempt-local failure | **Attempt failure is attempt-local while retries remain possible.** `P1.requires_action` = retryable idle; `P1.processing` = exactly one active attempt; `P1.failed`/`canceled` = terminal logical payment (no reopen). **Forbidden:** failed/canceled → processing/succeeded. Future C12-aware C03 requote uses attempt history + `requires_action`, not P1 failed/canceled. | **FROZEN** (C12-D2) |
| 35 | `payments.psp_ref` under multiple attempts | Final settled ref vs first-attach legacy | **`payment_attempts.provider_attempt_ref`** = per-execution refs. **`payments.psp_ref`** = winning/successful execution ref for C06 settlement. Promote winner ref only during authoritative success finalization. Never attach a failed attempt ref to `payments.psp_ref`. | **FROZEN** (C12-D2) |
| 36 | One active nonterminal attempt per payment | Strict one-active vs parallel attempts | **At most ONE nonterminal attempt per logical payment** (future partial unique index on nonterminal statuses). Parallel attempts **DEFERRED**. | **FROZEN** (C12-D2) |
| 37 | Logical payment funding mode | attempt.fx_quote_id-only vs immutable payment funding_mode | **One immutable `payments.funding_mode` ∈ {`xaf_native`,`cross_border`}.** Cross-border attempts require `fx_quote_id`; XAF-native requires `fx_quote_id IS NULL`. Mode switching forbidden. Additive C12 column + create-path wrappers; staging payments=0 so backfill clean. | **FROZEN** (C12-D2) |
| 38 | Initial quote / attempt bootstrap | Re-consume Q1 vs bind already-consumed Q1 | **Initial A1 binds already-consumed C03 Q1** (`Q1.payment_id=P1`, `status=consumed`) without re-consuming. **Retry A2+** consumes fresh usable Qn atomically with attempt insert. | **FROZEN** (C12-D2) |

---

## Decision #11 freeze (C03-D1) — EUR→XAF corridor pricing/reference

**Historical OPEN wording:** “EUR→XAF peg for v1 corridor — peg vs live FX — peg with quote record.” That conflated monetary EUR/XAF parity with a commercial payment-execution quote.

**Frozen (2026-09-03):**

- V1 funding denomination is **TARGET-XAF-FIRST** (Decision #32).
- Underlying EUR/XAF monetary reference is **externally fixed CFA/euro parity**, not a DiasporaBridge-configured market FX rate.
- Execution economics come from a **trusted licensed provider/server quote**.
- DiasporaBridge **records** the quote. It does **not** invent an exchange rate, act as FX-price authority, or guarantee fee-free conversion at reference parity.
- Provider quote supplies exact `source_amount_minor`, provider identity, provider quote reference, expiry, and applicable execution economics.
- C05 / C06 / ledger remain bound to exact `target_amount_xaf`.
- No hardcoded fallback quote is accepted for money movement.
- Provider execution charges are **not** “FX spread” by default; they are distinct from platform fees (C04) and from reference parity.
- Insurance remains **NONE**.

**Does not decide:** specific provider, fee schedules, or Decision #13 legal operating model.

---

## Decisions #33–#38 (C12-D2) — payment-attempt authority FROZEN

| # | Topic | Frozen rule | Status |
|---|-------|-------------|--------|
| 33 | Provider authority | Same-provider V1; attempt.psp_provider = payment.psp_provider; cross-provider DEFERRED | **FROZEN** |
| 34 | Payment vs attempt status | Attempt failure local; P1 requires_action=retryable idle; processing=active; failed/canceled terminal; **no reopen** | **FROZEN** |
| 35 | `payments.psp_ref` | Attempt refs per attempt; payment.psp_ref = successful winner only; atomic promotion on success | **FROZEN** |
| 36 | One active attempt | At most one nonterminal attempt per payment | **FROZEN** |
| 37 | Funding mode | Immutable payment `funding_mode` xaf_native\|cross_border; attempts must agree | **FROZEN** |
| 38 | Initial quote bootstrap | A1 binds consumed Q1; retries consume fresh usable quotes atomically | **FROZEN** |

**Still OPEN (not frozen):** late provider success after attempt marked failed (quarantine via C11/C13); Decision #13 legal; double provider HTTP submission (ops/orchestration).

**Next:** C11-D1 authenticated provider-event design. C12 schema DONE. Live money NO.

---

## Decisions #39–#44 (C11-D1) — provider-event design proposals

| # | Decision | Options | Recommendation | Status |
|---|----------|---------|----------------|--------|
| 39 | Canonical provider-event identity | raw id only vs `(provider, raw_id)` vs ledger namespace | **Reuse `ledger_canonical_psp_event_id` = `provider:raw_id`** as unique event key; C11 wraps it with authenticity metadata | **OPEN** (C11-D1) |
| 40 | Raw payload / hash retention | hash-only vs hash+redacted raw vs full raw forever | **Store payload_hash always; retain raw body (size-capped) for dispute window only; no client SELECT; no auth headers** | **OPEN** (C11-D1) |
| 41 | Authenticity vs processing states | single status vs split | **Split:** verification_result (unsigned/rejected/verified) independent of processing_status (received/quarantined/processed/ignored) | **OPEN** (C11-D1) |
| 42 | Attempt correlation precedence | payment_attempt.id metadata vs provider_attempt_ref vs amount heuristics | **Primary:** outbound idempotency = `payment_attempt.id`; **confirm:** provider + provider_attempt_ref exact match; **never** amount/time heuristics | **OPEN** (C11-D1) |
| 43 | Late / out-of-order event policy | auto-mutate vs quarantine | **Authentic late success after attempt.failed → quarantine for C13; never auto reopen/succeed** | **OPEN** (C11-D1) |
| 44 | ledger_posted_events role | replace vs reuse as primary vs keep ledger-only | **Option D:** additive `provider_events` (C11 authenticity/evidence) while keeping `ledger_posted_events` as ledger-posting dedupe compatibility only — do not overload it as authenticity store | **OPEN** (C11-D1) |

Do **not** freeze provider-specific crypto (Stripe/MoMo/Orange) until a real provider integration task verifies contracts.

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
