# DiasporaBridge — Build Roadmap

> **LEGACY PHASE NUMBERING**  
> Current execution namespace: `R## / P## / C## / D## / E## / F## / G##`  
> Current roadmap authority: `docs/04_MASTER_RECONCILIATION_AND_EXECUTION_PLAN.md`

**Generated:** 2026-09-02
**Reads with:** `00_PLATFORM_BLUEPRINT.md` (what is missing), `01_CANONICAL_MODELS.md` (what to build), `03_RISK_REGISTER.md` (what can go wrong)

This roadmap continues the phase scheme already established in `REMEDIATION_INVENTORY.md` (Phase 1 → 3A → 3B.0 → 3B for migrations; remediation phases 1–43 for execution) and extends it with the product phases A–G.

**Standing constraints (frozen, from `REMEDIATION_INVENTORY.md §14):**

```yaml
production_changes:  FORBIDDEN         # ref xtyqcdktwxzuezarnqhz
psp_activation:      FORBIDDEN until approved
dual_write:          FORBIDDEN until approved plan
legacy_backfill:     FORBIDDEN
opening_balances:    ZERO
quarantined_50002:   no ledger backfill
staging_only:        tvorurbmzrpwvxwztpix
```

---

## Part 1 — Dependency graph

Nothing below moves left of its dependencies. The lanes run in parallel; the vertical order inside a lane is strict.

```
 ══════════════════════════════════════════════════════════════════════════
  PHASE 0 · STOP THE BLEEDING              (days, not weeks — do first)
 ══════════════════════════════════════════════════════════════════════════
   0.1 RLS on transactions + withdrawals ──┐
   0.2 gate /admin/* (server + client)  ───┤
   0.3 disable process-escrow mock path ───┼──► SAFE TO CONTINUE
   0.4 auth escrow-webhook              ───┤
   0.5 profiles SELECT USING(true) fix  ───┤
   0.6 observers cannot write           ───┘
   0.7 supabase keys → env; staging in dev builds
   0.8 ledger invariant alerting (trial balance nightly)

 ══════════════════════════════════════════════════════════════════════════
  PHASE 1 · FOUNDATION REPAIR            (must precede all schema work)
 ══════════════════════════════════════════════════════════════════════════
   1.1 write missing DDL for ~10 core tables ──┐
        projects, milestones, messages,        │
        notifications, reviews, project_       │
        expenses, project_updates, project_    ├──► REPRODUCIBLE DB
        applications, transactions, withdrawals│
   1.2 consolidate 19 untimestamped migrations ┤
   1.3 verified fresh `db reset` on staging  ──┤
   1.4 generated types (supabase gen types) ───┤
   1.5 CI: lint + tsc + fresh-migrate + SQL tests
   1.6 eas.json + bundleIdentifier + package ──┘

 ══════════════════════════════════════════════════════════════════════════
  PHASE C · FINANCIAL CORE               (the heart; nothing ships without it)
 ══════════════════════════════════════════════════════════════════════════
        ┌── C1 freeze money model decisions (§12 of canonical models)
        │        │
        │        ▼
        ├── C2 currencies + amount_minor convention
        │        │
        │        ├──► C3 fx_rates / fx_quotes / platform_fx_pnl
        │        ├──► C4 fee_schedules / fee_computations
        │        │
        │        ▼
        ├── C5 apply 3B.0 to staging + tests        [remediation phase 7]
        ├── C6 apply 3B to staging + tests          [remediation phase 11]
        │        │
        │        ▼
        ├── C7 ★ rpc_release_milestone  (THE missing hinge)
        ├── C8 ★ payout state machine + payout RPCs
        ├── C9 ★ refund / reversal / chargeback RPCs
        ├── C10 material_funding + supplier_payment RPCs
        │        │
        │        ▼
        ├── C11 edge functions rewritten to the 3B contract
        ├── C12 real PSP integration (Stripe / MoMo / Orange)
        ├── C13 reconciliation job + break queue
        └── C14 app migrated off SUM(transactions) onto ledger reads
                 │
                 ▼
             LEGACY MONEY PATHS RETIRED

 ══════════════════════════════════════════════════════════════════════════
  PHASE D · WORKFLOW CORE                (parallel with C after C2)
 ══════════════════════════════════════════════════════════════════════════
   D1 four-track milestone state machine + transition guard
   D2 evidence_bundles / items / requirements
   D3 evidence acceptance gates release          ──► depends on C7
   D4 canonical dispute model (consolidate 3 → 1)
   D5 real funds freeze via compliance_hold      ──► depends on C7
   D6 admin arbitration workflow + split resolution
   D7 server-signed material handoff tokens
   D8 sequential milestone unlock

 ══════════════════════════════════════════════════════════════════════════
  PHASE E · IDENTITY, SECURITY, COMPLIANCE   (parallel with C and D)
 ══════════════════════════════════════════════════════════════════════════
   E1 platform_admins + admin_role + has_admin_role()
   E2 kyc_submissions / decisions / verification_states
   E3 CLIENT-side KYC (currently absent entirely)
   E4 transaction_limits enforced in funding RPCs
   E5 full RLS overhaul against the §9 matrix + negative tests
   E6 domain_events + hash chain + admin_action_log
   E7 sanctions / PEP screening hook
   E8 secret management, key rotation, 2FA for admins
   E9 retention + deletion (GDPR + Cameroon L.2010/012)

 ══════════════════════════════════════════════════════════════════════════
  PHASE F · TRUST & OPERATIONS           (needs real project data)
 ══════════════════════════════════════════════════════════════════════════
   F1 reviews table + eligibility rule
   F2 trust_profiles computed nightly
   F3 trust caps actually gate project value
   F4 admin back-office console (KYC, disputes, payouts, ledger explorer)
   F5 maker/checker on payouts
   F6 observability: Sentry, structured logs, alerts, runbooks
   F7 fraud rules engine
   F8 financial statements + PDF archival
   F9 support tooling

 ══════════════════════════════════════════════════════════════════════════
  PHASE G · SCALE                        (only after F is real)
 ══════════════════════════════════════════════════════════════════════════
   G1 offline event log (replace caching)
   G2 beneficiary layer with visibility scopes
   G3 project_type + vertical templates
   G4 education / healthcare / agriculture / business
   G5 additional corridors and currencies
   G6 analytics + data warehouse
```

---

## Part 2 — Phase 0: stop the bleeding

Eight items. None takes more than a day. Every one of them closes a path by which money or personal data can leave the system without authorisation. Do these **before** any new feature work, and before Phase 3B goes anywhere near production.

### 0.1 — RLS on `transactions` and `withdrawals`

**Why:** RLS is OFF on both (staging-confirmed). `app/provider/payout-setup.tsx:91-108` inserts a `withdrawals` row and a negative `transactions` row from the client. Any user can insert a positive one instead.

```sql
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals  ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.transactions FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.withdrawals FROM anon, authenticated;
CREATE POLICY withdrawals_select_own ON public.withdrawals
  FOR SELECT TO authenticated USING (user_id = auth.uid());
```

**Test:** as `authenticated`, `INSERT INTO transactions` must fail; `SELECT` on another user's withdrawal must return zero rows.
**App impact:** balance reads in `wallet.tsx`, `diaspora/index.tsx`, `earnings.tsx`, `payout-setup.tsx`, `active.tsx` will break. That is the point — replace them with a `SECURITY DEFINER` balance function in the same change.

### 0.2 — Gate `/admin/*`

**Why:** `app/admin/payouts.tsx` and `app/admin/verify_requests.tsx` have no layout and no check. Any authenticated user can approve payouts.

Do all three layers: `platform_admins` + `has_admin_role()` (per canonical models §2), RLS policies on every table those screens touch, and an `app/admin/_layout.tsx` redirect. Add `admin` to `resolveAccountRole.ts`.

**Test:** a plain client session hitting `/admin/payouts` gets redirected **and** the underlying UPDATE is refused by RLS.

### 0.3 — Remove the mock-success payment path

**Why:** `supabase/functions/process-escrow/index.ts:95-100`, `:126-130`, `:153-157` set `paymentSuccess = true` when the API key is unset. Marks a project funded with no money received.

```ts
if (!stripeKey) {
  return new Response(JSON.stringify({ error: "psp_not_configured" }),
    { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
```

Fail closed on all three providers. Per `PHASE3B_EDGE_CONTRACT.md:47` this function must not be in the new escrow path at all — this is a stopgap until C11 replaces it.

### 0.4 — Authenticate `escrow-webhook`

**Why:** no JWT, no signature, no service_role, and it sits in the payout path. It is currently a stub, which is the only reason it is not already an incident.

Require a shared secret header **and** the PSP signature, verified before the body is parsed. Same treatment for `push-on-insert` and `send-push`, which are also open.

### 0.5 — Fix `profiles SELECT USING (true)`

**Why:** `rls_and_auth.sql:117`. Every authenticated user can read every profile row — and this is the table verification state lives on.

Restrict to `id = auth.uid()`, add a `profiles_public` view with the display-safe columns, and repoint the marketplace, proposals, applicant and chat screens at the view.

### 0.6 — Observers must not write

**Why:** `user_can_access_project()` returns true for observers, and `rls_and_auth.sql:63-80` uses it for `UPDATE` on `milestones` and `project_expenses`. Your read-only family role can mutate milestones.

Split the function into `user_can_read_project()` and `user_can_write_project()`; use the write variant in every `UPDATE`/`INSERT`/`DELETE` policy. Audit all 20+ call sites.

### 0.7 — Get keys out of source

**Why:** `lib/supabase.ts:10-11` hardcodes the URL and anon key for **production** `xtyqcdktwxzuezarnqhz`, while the CLI is linked to staging. Development work is pointed at the live database.

Move to `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` via `app.config.ts`; separate `.env.development` (staging) from `.env.production`; rotate the exposed anon key. The anon key is designed to be public, but with RLS gaps like 0.1 and 0.5 open, it is currently a real capability.

### 0.8 — Ledger invariant alerting

**Why:** cheapest high-value monitoring available, and the functions already exist.

Nightly scheduled job: `ledger_verify_journal_equality()` must return zero rows; `ledger_trial_balance()` must net to zero. Alert loudly on either. Later add `domain_events_verify_chain()`.

**Phase 0 exit criteria:** every item above has a passing negative test, and no path exists from an authenticated mobile client to a balance mutation or another user's PII.

---

## Part 3 — Phase 1: foundation repair

### 1.1 — Write the missing DDL (**highest structural priority after Phase 0**)

Roughly ten core tables have no `CREATE TABLE` anywhere in `supabase/migrations/`: `projects`, `milestones`, `messages`, `notifications`, `reviews`, `project_expenses`, `project_updates`, `project_applications`, plus the `transactions`/`withdrawals` stubs. They exist only as ALTERs against an assumed schema, plus a *staging-only* bootstrap explicitly outside migration history.

The consequence: **you cannot rebuild your own database from your own repository.** Every future migration is built on sand, and disaster recovery is not possible.

Method — do not guess:
1. Dump the real schema from production read-only: `supabase db dump --schema public --data-only=false`.
2. Split it into `0000_baseline_<domain>.sql` files that mirror what exists today, exactly.
3. Apply to a fresh staging database and diff against the dump until the diff is empty.
4. Register the baseline in migration history without re-running it on existing environments (`supabase migration repair`).

### 1.2 — Consolidate the 19 untimestamped migrations

They are skipped by `db push`, apply in alphabetical order if ever run, and contain conflicting definitions (two `project_material_carts`, two `escrow_funder_approvals`, two `suppliers`, three dispute models). Fold each into the baseline or into a properly timestamped migration, resolving duplicates per `00_PLATFORM_BLUEPRINT.md` Part 6.

### 1.3 — Prove reproducibility

`supabase db reset` on a scratch project must produce a schema identical to staging. Until that command works, no other migration work is trustworthy. Add it to CI.

### 1.4 — Generated types

`database.types.ts` is hand-written with a `[key: string]: any` catch-all (`:21-26`) and typed `Functions` as `any` (`:84-87`). Replace with `supabase gen types typescript --linked`, add an npm script, and check drift in CI. Then remove `types/models.ts` duplication.

### 1.5 — CI pipeline (currently none)

```yaml
on: [push, pull_request]
jobs:
  quality:
    - npm ci
    - npm run lint
    - npx tsc --noEmit             # add this script; missing today
    - npm test                     # add jest; zero tests exist today
  database:
    - supabase start
    - supabase db reset            # proves 1.3
    - psql -f supabase/tests/phase3a_ledger_posting.sql
    - psql -f supabase/tests/phase3b_escrow_funding.sql
    - psql -f supabase/tests/rls_negative.sql   # new, from §9 matrix
```

### 1.6 — Release engineering

Add `eas.json`, `ios.bundleIdentifier`, `android.package`, `extra.eas.projectId` (push tokens currently fall back without it — `hooks/usePushNotifications.ts:31-37`), and fix the deep-link mismatch: `app.json` scheme is `diasporabridge`, `process-escrow/index.ts:167-168` returns `diaspora-bridge://escrow-return`.

---

## Part 4 — Phase C: financial core

This is the phase that determines whether the product exists. Ordered.

| # | Work | Depends on | Definition of done |
|---|---|---|---|
| C1 | Freeze the 17 decisions in canonical models §12 | — | Written, dated, signed off. Items 1, 2, 5, 16 especially |
| C2 | `currencies` table; `amount_minor` convention; convert legacy `numeric` money columns | C1, 1.1 | No `numeric`/`float` money column remains; every amount has a currency |
| C3 | `fx_rate_sources`, `fx_rates`, `fx_quotes`, `platform_fx_pnl`, `fx_conversion` journal type, `rpc_request_fx_quote` | C2 | A EUR quote can be issued, locked, expired, and consumed exactly once |
| C4 | `fee_schedules`, `fee_computations`, `platform_fee` posting; remove the hardcoded 1.5% at `20260826120000:594` | C2 | Every fee traceable to a schedule row; funding/insurance/FX-spread separated |
| C5 | Apply `20260826110000_phase3b0_multisig_approvals.sql` to staging; run tests | 1.3 | 3B.0 suite green; 72h expiry verified; funder RLS verified |
| C6 | Apply `20260826120000_phase3b_escrow_funding.sql` to staging; run tests | C5 | `phase3b_escrow_funding.sql` green end to end |
| **C7** | **`rpc_release_milestone`** — the 16-step contract in canonical models §3.3 | C6, D1, D2 | All 16 assertions tested including concurrent double-release and replay |
| C8 | Payout state machine + `rpc_request_payout` / `authorise` / `mark_settled` / `mark_failed`; maker-checker above threshold | C7 | Insufficient-balance, duplicate, and failure-reversal cases tested |
| C9 | `rpc_refund_project`, `rpc_post_chargeback`, `milestone_release_reversal`, `payout_reversed` | C7 | Every reversal posts a compensating journal; originals never mutated |
| C10 | `rpc_post_material_funding`, `rpc_post_supplier_payment` | C7, D7 | Cart approval moves escrow → materials escrow → supplier payable |
| C11 | Rewrite edge functions to `PHASE3B_EDGE_CONTRACT.md`; retire `process-escrow` and `escrow-webhook` | C6 | Signature verify before parse; idempotent events; amount reconciled from DB, never from the webhook body |
| C12 | Real Stripe / MTN MoMo / Orange Money integration | C11, E4 | Sandbox → staging → limited live. `@stripe/stripe-react-native` finally wired |
| C13 | Reconciliation job + `psp_settlement_lines` + `reconciliation_breaks` | C12 | Daily run; every break owned and aged; `psp_*` balances tie to external statements |
| C14 | Migrate app reads off `SUM(transactions)` onto ledger RPCs; delete legacy write paths | C7, C8 | Zero app references to `transactions`, `withdrawals`, `release_milestone` |

**Phase C exit criteria:** a franc can enter from a EUR card, sit in project escrow, be released against approved evidence, reach a provider's MoMo wallet, and be reconciled against the carrier statement — with every step idempotent, authorised server-side, and reconstructable from the ledger. And no legacy money path remains reachable.

---

## Part 5 — Phases D, E, F, G

Condensed; each item expands into the designs in `01_CANONICAL_MODELS.md`.

### Phase D — Workflow core

| # | Work | Note |
|---|---|---|
| D1 | Four-track milestone state machine + transition guard trigger | Canonical models §3.2. `financial_state` mutable only inside a ledger RPC |
| D2 | `evidence_bundles` / `evidence_items` / `evidence_requirements` | Include `content_sha256` and `capture_source` |
| D3 | Evidence acceptance becomes a precondition of C7 | Closes the "trust me" → "here is the evidence" loop |
| D4 | Consolidate three dispute models into `disputes` | Stop the double-write at `project/[id].tsx:480-512` |
| D5 | Freeze moves money via `compliance_hold` | The journal type already exists and is unused |
| D6 | Admin arbitration + split resolution | `arbitration_admin_id` exists with no workflow |
| D7 | Server-signed single-use handoff tokens | Removes `QR_SIGNING_KEY` from the app bundle |
| D8 | Sequential milestone unlock | `sequence` column + server check |

### Phase E — Identity, security, compliance

| # | Work | Note |
|---|---|---|
| E1 | `platform_admins`, `admin_role`, `has_admin_role()` | Hardens Phase 0.2 properly |
| E2 | `kyc_submissions` / `kyc_decisions` / `verification_states` | Replaces columns on `profiles`; gives history and expiry |
| E3 | **Client-side KYC** | Entirely absent today; the sender is unverified |
| E4 | `transaction_limits` enforced in every funding RPC | Makes levels mean something |
| E5 | RLS overhaul against §9 matrix, with negative tests | Every row of the matrix gets a refusal test |
| E6 | `domain_events` + hash chain + `admin_action_log` | The audit engine your vision describes |
| E7 | Sanctions / PEP screening hook | Required before licensed movement |
| E8 | Secret management, rotation, admin 2FA | Follows Phase 0.7 |
| E9 | Retention and deletion | GDPR + Cameroon L.2010/012 |

### Phase F — Trust and operations

| # | Work | Note |
|---|---|---|
| F1 | `reviews` table + eligibility tied to settled releases | The table your RLS already assumes |
| F2 | `trust_profiles` computed nightly from real events | Replaces hardcoded `100%`/`50%` |
| F3 | Trust caps gate project value | Enforce in `hireProvider` and funding RPC |
| F4 | Admin back-office console | KYC review with document viewer, arbitration desk, payout queue, ledger explorer, break queue, limits config |
| F5 | Maker/checker on payouts above threshold | Two distinct `treasury` users |
| F6 | Sentry, structured logging, alerts, runbooks | Zero observability today |
| F7 | Fraud rules engine | Velocity, device, collusion signals, off-platform detection |
| F8 | Financial statements + server PDF archival | The statement in your vision, reconciling to the ledger |
| F9 | Support tooling | SLA, ticket-to-project linkage, WhatsApp channel |

### Phase G — Scale

| # | Work |
|---|---|
| G1 | Offline event log replacing caching (canonical models §10) |
| G2 | Beneficiary layer with visibility scopes; amounts hidden independently of progress |
| G3 | `project_type` + template abstraction |
| G4 | Education, healthcare, agriculture, business verticals |
| G5 | New corridors and currencies |
| G6 | Analytics and data warehouse |

---

## Part 6 — The next ten actions

Concrete, ordered, each independently shippable.

| # | Action | Why now |
|---|---|---|
| 1 | `ENABLE ROW LEVEL SECURITY` on `transactions` and `withdrawals`; revoke client writes | Open path from a phone to an arbitrary balance |
| 2 | Create `platform_admins` + `has_admin_role()`; gate `/admin/*` in RLS **and** UI; add `admin` to `resolveAccountRole` | Anyone can approve payouts today |
| 3 | Make `process-escrow` fail closed when PSP keys are missing | Projects can be marked funded with no money |
| 4 | Require signature + secret on `escrow-webhook`, `push-on-insert`, `send-push` | Three open endpoints, one in the payout path |
| 5 | Replace `profiles_select USING (true)` with self-only + `profiles_public` view | Every user can read every profile |
| 6 | Split `user_can_access_project()` into read/write; fix `milestones` and `project_expenses` UPDATE policies | Observers can mutate milestones |
| 7 | Move Supabase keys to `EXPO_PUBLIC_*`; point dev builds at staging; rotate the key | Dev work is hitting production |
| 8 | Schedule `ledger_trial_balance()` + `ledger_verify_journal_equality()` nightly with alerting | One day of work, permanent safety net |
| 9 | Baseline DDL for the ~10 tables with no `CREATE TABLE`; prove `db reset` reproduces staging | You cannot currently rebuild your own database |
| 10 | Add CI: lint, `tsc --noEmit`, `db reset`, existing SQL tests | Everything after this depends on a green pipeline |

Actions 1–8 are days of work and close every P0 security hole. Actions 9–10 unblock all subsequent schema work. Only then start Phase C1 (freeze the money decisions) — which is, per `REMEDIATION_INVENTORY.md §16`, exactly where the existing plan says the next approved work begins.

---

## Part 7 — Sequencing advice

**Do not** apply Phase 3B to production before Phase 0 is complete. 3B is well designed, but pushing it live while `transactions` has RLS off and `/admin` is ungated means running two money systems, one of which is wide open.

**Do not** build C12 (real PSP) before C13 (reconciliation) is at least designed. Live money without reconciliation means learning about losses from customers.

**Do** build C7 (`rpc_release_milestone`) as the very first new financial RPC. It is the missing hinge; everything downstream — payouts, disputes, trust, statements — assumes it exists.

**Do** run Phase D1/D2 in parallel with C2–C6, because C7 depends on both. Two lanes, one convergence point.

**Do not** start Phase G before Phase F is real. A second vertical multiplies every gap in the first.

**Consider** narrowing the launch corridor to Germany → Cameroon, EUR only, construction only, one city, twenty vetted providers, manual compliance review on every transaction. That makes Phase C3 trivial (pegged rate), Phase E7 a human process rather than a vendor integration, and Phase F7 unnecessary at first. Every one of those becomes a real engineering project at scale — but none of them needs to be one to prove the thesis.

---

## Part 8 — Definition of done, per phase

| Phase | Done when |
|---|---|
| **0** | No authenticated client can mutate a balance or read another user's PII. Every fix has a negative test |
| **1** | `supabase db reset` reproduces staging exactly. CI green on lint, types, migrations, SQL tests |
| **C** | EUR in → escrow → evidence-gated release → MoMo out → reconciled. Zero legacy money paths reachable |
| **D** | No status change moves money. Evidence gates release. One dispute model. Freeze holds funds in the ledger |
| **E** | Both sides KYC'd with levels and limits. RLS matrix fully tested including refusals. Every admin action logged |
| **F** | Trust computed from real events and gating project value. Reconciliation breaks owned and aged. Alerts fire before customers notice |
| **G** | A second vertical ships without touching the money layer |
