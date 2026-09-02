# DiasporaBridge — Platform Blueprint & Gap Analysis

> **STATUS: PARTIALLY_STALE / GAP ANALYSIS — NOT CURRENT SCHEMA TRUTH**  
> Pre-P00/P01 findings remain useful historical evidence.  
> **Current state authority:** `docs/CURRENT_STATE.yaml` + `docs/04_MASTER_RECONCILIATION_AND_EXECUTION_PLAN.md`

**Generated:** 2026-09-02
**Basis:** full read of `app/` (54 routes), `supabase/migrations/` (25 files), `supabase/functions/` (10 edge functions), `lib/`, `utils/`, `hooks/`, `context/`, `package.json`, `app.json`, plus `REMEDIATION_INVENTORY.md`
**Companion documents:**
- `01_CANONICAL_MODELS.md` — the concrete data/state/event designs to implement
- `02_BUILD_ROADMAP.md` — ordered work plan with dependency graph
- `03_RISK_REGISTER.md` — security, fraud, regulatory and operational risk

---

## Part 0 — How to read this document

`REMEDIATION_INVENTORY.md` already answers *"what is broken in the money layer?"* very well. This document answers the three questions it does **not** cover:

1. **What is missing from the product** relative to the eight-engine vision (identity, money, project, evidence, materials, communication, disputes, trust)?
2. **Which engines does the vision not even name yet**, but which the business cannot legally or operationally run without?
3. **In what order should it be built**, so that nothing has to be rewritten twice?

Every claim below is grounded in a file that exists in this repo. Where something is absent, it says ABSENT rather than guessing.

---

## Part 1 — The one-page verdict

You are much further along than a typical pre-seed build. The honest summary:

```
                    WHAT YOU ACTUALLY HAVE
   ┌────────────────────────────────────────────────────────────┐
   │                                                            │
   │  A very good PRODUCT SHELL          (~85% of surface)      │
   │  A very good LEDGER DESIGN          (~90% of intake path)  │
   │  A dangerous MONEY IMPLEMENTATION   (~15% of full cycle)   │
   │  An absent TRUST / OPS / COMPLIANCE (~5%)                  │
   │                                                            │
   └────────────────────────────────────────────────────────────┘
```

**The single most important structural finding in this whole analysis:**

> Your ledger has 19 journal types including `milestone_release`, `payout_settled`,
> `refund`, `chargeback`, `supplier_payment` and `payout_reversed`.
> **Not one of them has an RPC that can post it.**
>
> Phase 3B built the *inbound* path (`payment` → PSP → `rpc_post_escrow_funding`).
> There is **no ledger-backed outbound path at all**. Every franc that leaves the
> platform today leaves through legacy code: `release_milestone()` with a
> client-supplied amount, or a `withdrawals` INSERT with no balance check on a
> table that has **RLS switched off**.

So money can flow *into* the correct system and can only flow *out* through the wrong one. That is the defining gap. It is also good news: the hard conceptual work (double-entry model, account purposes, idempotency, append-only enforcement) is already done and does not need redesigning — it needs *completing*.

The second most important finding:

> Your ledger enforces `CHECK (currency = 'XAF')` on every account and journal.
> Your customer is **in Germany, France, the US and Canada, and pays in EUR / USD / CAD.**
> There is no FX engine, no rate table, no inbound-currency column, no FX P&L account.
> The product's core user cannot be represented in the accounting system.

Third:

> Two admin screens exist (`app/admin/payouts.tsx`, `app/admin/verify_requests.tsx`).
> Neither is behind any authorisation check. `resolveAccountRole()` does not even
> know that an `admin` role exists. Any authenticated user who types the URL can
> reach the payout approval queue.

---

## Part 2 — Current system map (as built, not as intended)

```
        ┌──────────────────────── DIASPORA BRIDGE (today) ───────────────────────┐
        │                                                                        │
        │  ██████████████████████████████░░░░  PRODUCT SHELL      85%            │
        │   54 expo-router screens, 4-tab client, 4-tab provider, supplier       │
        │   stack, tamagui + blur + flashlist, 5-language i18n, haptics          │
        │                                                                        │
        │  ████████████████████████████░░░░░░  PROJECT ENGINE     78%            │
        │   projects, milestones, applications, bids, contracts, observers       │
        │   ── no canonical state machine, statuses are free text                │
        │                                                                        │
        │  ██████████████████████████░░░░░░░░  EVIDENCE ENGINE    72%            │
        │   photo upload, compression, geofence, offline queue, workroom         │
        │   ── evidence is not linked to release authorisation                   │
        │                                                                        │
        │  ████████████████████████░░░░░░░░░░  MATERIALS ENGINE   68%            │
        │   carts, items, suppliers, QR generate + scan, handover photo          │
        │   ── QR signed client-side with a hardcoded string key                 │
        │                                                                        │
        │  ██████████████████████████████░░░░  COMMS ENGINE       80%            │
        │   messages, realtime, voice notes, transcription, translation, push    │
        │                                                                        │
        │  ████████████░░░░░░░░░░░░░░░░░░░░░░  IDENTITY ENGINE    35%            │
        │   KYC photo upload + private bucket + admin approve screen             │
        │   ── one boolean. no levels, no expiry, no liveness, no re-KYC         │
        │                                                                        │
        │  ██████░░░░░░░░░░░░░░░░░░░░░░░░░░░░  MONEY ENGINE       15% real       │
        │   ledger schema excellent; intake RPCs written but NOT APPLIED to      │
        │   staging; zero app callers; outbound path 100% legacy                 │
        │                                                                        │
        │  ██████░░░░░░░░░░░░░░░░░░░░░░░░░░░░  DISPUTE ENGINE     20%            │
        │   3 competing models; freeze is a status flag, not a funds hold        │
        │                                                                        │
        │  ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  TRUST ENGINE       12%            │
        │   tier + success_score + get_provider_stats; reviews table never       │
        │   created; UI shows hardcoded "100%" / "50%"                            │
        │                                                                        │
        │  ██░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  AUDIT ENGINE        8%            │
        │   ledger append-only triggers only. no domain event log, no hash chain │
        │                                                                        │
        │  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  FX ENGINE           0%            │
        │  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  FEE / REVENUE       3%            │
        │  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  PAYOUT / TREASURY   0%            │
        │  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  COMPLIANCE / AML    5%            │
        │  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  ADMIN / BACK-OFFICE 5% (ungated)  │
        │  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  OBSERVABILITY       0%            │
        │  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  TEST / CI / RELEASE 2%            │
        │                                                                        │
        └────────────────────────────────────────────────────────────────────────┘
```

### The dual-authority problem, drawn

This is the picture that matters most. Two money systems run side by side, and the **wrong one is the one the app talks to**:

```
    DESIGNED (Phase 3B, in repo, NOT on staging, 0 app callers)
    ═════════════════════════════════════════════════════════════
      app  ──X──►  rpc_create_payment_intent
                          │
                          ▼
                     payments (amount_xaf bigint, client_request_id UNIQUE)
                          │
                          ▼
                     PSP  ──►  signed webhook  ──►  rpc_begin_psp_webhook_event
                          │                                  │
                          ▼                                  ▼
                     rpc_mark_payment_succeeded      ledger_posted_events
                          │
                          ▼
                     rpc_post_escrow_funding
                          │
                          ▼
                     ledger_post_journal('escrow_funding')
                          │
                          ▼
                     ledger_accounts.balance_xaf     ◄── AUTHORITATIVE
                          │
                          ▼
                     ╳ NOTHING. No release RPC. No payout RPC.
                       No refund RPC. Money enters and cannot leave.


    ACTUAL (what the app really does today)
    ═════════════════════════════════════════════════════════════
      wallet.tsx        ──►  Alert.alert("top up")            ← no funding at all
      project/[id].tsx  ──►  release_milestone(p_amount)      ← CLIENT SETS AMOUNT
      payout-setup.tsx  ──►  SUM(transactions.amount)         ← RLS OFF on table
                        ──►  INSERT withdrawals               ← no balance check
                        ──►  INSERT transactions (negative)   ← client-side debit
      process-escrow    ──►  paymentSuccess = true            ← mock when key unset
      admin/payouts     ──►  UPDATE status = 'processed'      ← no PSP proof, no gate
```

The three lines marked with arrows in the second block are, together, an unauthenticated path from a mobile client to an arbitrary balance mutation. Nothing else in this document is more urgent.

---

## Part 3 — Target architecture

Your six-system sketch is directionally right but under-counts. A cross-border money platform needs **fourteen** systems. Here is the target, with the ones you have not yet named marked `NEW`:

```
                    ┌───────────────────────────────────────┐
                    │        DIASPORA TRUST PLATFORM        │
                    └───────────────────────────────────────┘
                                      │
    ┌─────────────────────────────────┼─────────────────────────────────┐
    │                    LAYER 1 — WHO AND WHAT                        │
    │                                                                   │
    │   IDENTITY & KYC        PROJECT ENGINE        BENEFICIARY   NEW   │
    │   ─────────────────     ──────────────        ────────────        │
    │   levels, documents     projects              observers           │
    │   expiry, re-KYC        milestones            limited visibility  │
    │   liveness, sanctions   scope / templates     no money control    │
    └───────────────────────────────────────────────────────────────────┘
                                      │
    ┌─────────────────────────────────┼─────────────────────────────────┐
    │                    LAYER 2 — WHAT HAPPENED                        │
    │                                                                   │
    │   EVIDENCE ENGINE      MATERIALS ENGINE      COMMS ENGINE         │
    │   ────────────────     ────────────────      ────────────         │
    │   photo/video/GPS      carts, suppliers      project-owned chat   │
    │   invoices, measure    server-signed QR      voice, translation   │
    │   review verdicts      custody handoff       push orchestration   │
    └───────────────────────────────────────────────────────────────────┘
                                      │
    ┌─────────────────────────────────┼─────────────────────────────────┐
    │                    LAYER 3 — MONEY (the core)                     │
    │                                                                   │
    │   FX ENGINE      LEDGER        FEE ENGINE     PAYOUT / TREASURY   │
    │   NEW            ──────        NEW            NEW                 │
    │   ─────────      double-entry  ──────────     ──────────────      │
    │   EUR→XAF        append-only   schedule       provider payouts    │
    │   rate lock      idempotent    tiers          supplier payouts    │
    │   spread P&L     invariants    VAT/tax        float, reconcile    │
    │                                                                   │
    │   PAYMENT INTAKE          RELEASE ENGINE      REFUND / REVERSAL   │
    │   ───────────────         ──────────────      ─────────────────   │
    │   intents, webhooks       server-only         chargebacks         │
    └───────────────────────────────────────────────────────────────────┘
                                      │
    ┌─────────────────────────────────┼─────────────────────────────────┐
    │                    LAYER 4 — WHEN IT GOES WRONG                   │
    │                                                                   │
    │   DISPUTE ENGINE     COMPLIANCE / AML   NEW    TRUST & SAFETY NEW │
    │   ──────────────     ────────────────          ────────────────   │
    │   one canonical      sanctions, limits         fraud rules        │
    │   funds freeze       SAR/STR reporting         collusion signals  │
    │   arbitration        licence boundary          device / velocity  │
    └───────────────────────────────────────────────────────────────────┘
                                      │
    ┌─────────────────────────────────┼─────────────────────────────────┐
    │                    LAYER 5 — PROOF AND CONTROL                    │
    │                                                                   │
    │   AUDIT / EVENT LOG     ADMIN BACK-OFFICE NEW  REPORTING     NEW  │
    │   ─────────────────     ─────────────────────  ──────────────     │
    │   domain event stream   roles & permissions    statements, PDF    │
    │   hash chain            maker/checker          regulator packs    │
    │   reconstruct history   every action logged    investor metrics   │
    └───────────────────────────────────────────────────────────────────┘
                                      │
    ┌─────────────────────────────────┼─────────────────────────────────┐
    │              LAYER 0 — FOUNDATIONS (under everything)             │
    │                                                                   │
    │  RLS · authorisation model · encryption · secret management       │
    │  offline event sync · observability · CI/CD · release engineering │
    │  data retention · privacy (GDPR + Cameroon L.2010/012) · DR       │
    └───────────────────────────────────────────────────────────────────┘
```

**The load-bearing principle**, which belongs at the top of your engineering docs:

> Workflow state, financial accounting, payment settlement, and audit history are
> four separate systems joined only by controlled, server-side transitions.
> The database must never infer that money moved because a user changed a status.
>
> Corollary: `APPROVED ≠ RELEASED ≠ PAID ≠ SETTLED`. Four states, four timestamps,
> four ledger consequences.

---

## Part 4 — Engine by engine

Each section: the target sketch, what you actually have (with file references), and what is missing.

---

### 4.1 🪪 Identity & Verification — 35%

**Target**

```
   SIGNUP
     │
     ▼
   LEVEL 0  account exists, email verified
     │            → can browse, cannot transact
     ▼
   LEVEL 1  phone verified + basic profile
     │            → can create project, cannot fund
     ▼
   LEVEL 2  ID document + selfie liveness + address
     │            → can fund up to tier limit
     ▼
   LEVEL 3  enhanced: source of funds, sanctions screen
                  → high-value funding

   PROVIDER TRACK (independent of the above)
     ┌──────────────────────┬──────────────────────┬──────────────────┐
     │ IDENTITY VERIFIED    │ PROFESSIONAL VERIFIED│ TRUSTED PROVIDER │
     │ CNI matches face     │ trade cert, refs,    │ earned from real │
     │ name is real         │ site visit, insurance│ project history  │
     └──────────────────────┴──────────────────────┴──────────────────┘
       "a real person"        "actually a mason"     "actually good"
```

Your own instinct here was exactly right and it is the thing most competitors get wrong. Encode it as **three independent axes**, never one badge.

**What you have**

| Piece | Where |
|---|---|
| KYC document capture (3 photos) | `app/provider/verification.tsx` |
| Camera ID scan flow | `app/provider/verification-scan.tsx`, `utils/verificationScanResult.ts` |
| Private storage bucket, own-folder policy | `supabase/migrations/storage_buckets.sql:8,17-26` |
| Submission marker | `profiles.verification_submitted_at`, `verification_document_paths` (`verification_submission.sql:4-5`) |
| Admin review queue | `app/admin/verify_requests.tsx` |
| Tier / score columns | `profiles.tier`, `completed_projects`, `success_score` (`provider_tier_gamification.sql:4-7`) |
| Role resolution | `lib/resolveAccountRole.ts` |

**What is missing**

| Gap | Severity | Note |
|---|---|---|
| No `kyc_verifications` table — verification is columns on `profiles` | **P1** | No history, no reviewer identity, no rejection reason, no expiry, no re-verification, no audit trail of who approved what |
| No verification **levels**; it is effectively one boolean | **P1** | Cannot implement transaction limits per level, which is the basis of every AML programme |
| **Client-side KYC is entirely absent** | **P0** | Only providers upload ID. The person *sending money across a border* is unverified. This is inverted from every regulatory regime on earth |
| No liveness / selfie-to-document match | **P2** | A photo of someone else's CNI passes today |
| No sanctions / PEP screening hook | **P1** | Required before any licensed money movement |
| `profiles` has `SELECT USING (true)` | **P0** | `rls_and_auth.sql:117` — every authenticated user can read every profile row, including verification state and any KYC path column added later |
| No `admin` role in the type system | **P0** | `resolveAccountRole.ts` returns only `client \| provider \| supplier \| null`; `platform_admins` is **commented out** in `trigger_dispute_rpc.sql:7` |
| Admin screens have zero authorisation | **P0** | `app/admin/payouts.tsx`, `app/admin/verify_requests.tsx`, no `_layout.tsx`, no gate |
| Reviewer sees raw storage path, not signed URL | P2 | `verify_requests.tsx` — cannot actually review the document |
| No provider *professional* verification distinct from identity | P1 | The three-axis model above is not represented anywhere |
| No supplier onboarding/KYB at all | P1 | `suppliers.is_verified` is a bare boolean set by nobody; no signup route for suppliers exists |
| No document retention / deletion policy | P2 | GDPR: you are storing EU residents' ID documents indefinitely |

**What to add**

- `kyc_verifications` (append-only submissions) + `kyc_decisions` (reviewer, verdict, reason, expiry) — see `01_CANONICAL_MODELS.md §2`.
- `verification_level` enum on `profiles`, with a `tx_limit_xaf` per level driving a server-side check in every funding RPC.
- `platform_admins` table, an `admin` branch in `resolveAccountRole`, an `app/admin/_layout.tsx` gate, **and** a server-side `is_platform_admin()` used in every admin RPC and RLS policy. Client-side gating alone is decoration.
- Replace `profiles_select USING (true)` with a public-projection view (`profiles_public`) exposing only display name, city, trade, rating, verification badge — never document paths, phone, or email.

---

### 4.2 💰 Money Engine — 15% real (the critical path)

**Target — full lifecycle, both directions**

```
  ┌─────────────────────────── INBOUND ────────────────────────────┐
  │                                                                │
  │  Diaspora funds €500                                           │
  │        │                                                       │
  │        ▼                                                       │
  │  FX QUOTE  ── rate locked, id + expiry ──►  fx_quotes          │
  │        │      €500 @ 655.957 = 327 978 XAF                     │
  │        ▼                                                       │
  │  PAYMENT INTENT   payments(amount_minor, currency EUR,          │
  │        │                   settle_currency XAF, fx_quote_id)   │
  │        ▼                                                       │
  │  PSP  ──► signed webhook ──► idempotent event ──► reconcile    │
  │        │                                                       │
  │        ▼                                                       │
  │  LEDGER  Dr psp_stripe  327 978                                │
  │          Cr project_escrow  323 058                            │
  │          Cr platform_fees     4 920   ← fee schedule, not 1.5% hardcode
  │          (+ fx spread → platform_fx_pnl)                       │
  │        │                                                       │
  │        ▼                                                       │
  │  PROJECT FUNDED — escrow balance is now a ledger fact          │
  └────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────── OUTBOUND ───────────────────────────┐
  │                                                                │
  │  PROVIDER  "milestone complete" + evidence                     │
  │        │                                                       │
  │        ▼                                                       │
  │  CLIENT  "approved"        ← workflow state only, no money     │
  │        │                                                       │
  │        ▼                                                       │
  │  rpc_release_milestone(milestone_id)     ← ✱ DOES NOT EXIST ✱   │
  │        │                                                       │
  │        ├── caller is the project client?                       │
  │        ├── milestone state == approved?                        │
  │        ├── required evidence present and accepted?             │
  │        ├── no open dispute on project or milestone?            │
  │        ├── escrow balance >= milestone amount?                 │
  │        ├── no prior release journal for this milestone?        │
  │        └── SELECT ... FOR UPDATE on the escrow account         │
  │        │                                                       │
  │        ▼                                                       │
  │  LEDGER  Dr project_escrow                                     │
  │          Cr provider_payable                                   │
  │          Cr platform_fees / project_retainage                  │
  │        │                                                       │
  │        ▼                                                       │
  │  PAYOUT REQUEST   Dr provider_payable → Cr user_payout_clearing│
  │        │                                                       │
  │        ▼                                                       │
  │  PAYOUT ENGINE ──► MoMo / Orange API ──► callback              │
  │        │                                                       │
  │        ├── settled  → Dr user_payout_clearing Cr psp_momo      │
  │        └── failed   → reverse to provider_payable              │
  └────────────────────────────────────────────────────────────────┘
```

**What you have — and it is genuinely good**

The ledger design is the strongest asset in this repo. Do not redesign it.

| Piece | Where | Quality |
|---|---|---|
| 5 enums, 16 account purposes, 19 journal types, all label-asserted at migrate time | `20260813_phase1_ledger.sql:14-250` | Excellent |
| `ledger_accounts` / `journals` / `lines` / `posted_events`, `bigint` XAF, one-sided line CHECK | `:258-414` | Excellent |
| Append-only enforcement via reject-mutation triggers incl. TRUNCATE | `:507-547` | Excellent |
| Balance-must-net-zero triggers | `:468-490` | Excellent |
| RLS on, **zero policies**, REVOKE from anon/authenticated | `:603-606` | Correct |
| `ledger_post_journal` — SECURITY DEFINER, idempotent, validates a type→purpose matrix, blocks negative balances except allowed purposes | `20260826100000:350-540` | Excellent |
| `ledger_trial_balance`, `ledger_verify_journal_equality`, `ledger_balance_sheet_probe` | `:610-659` | Excellent |
| Multi-funder approvals with 72h window, server-set `approved_at`, immutable keys | `20260826110000` | Good |
| Payment intents with `client_request_id UNIQUE`, status CHECK, PSP webhook dedup | `20260826120000` | Good |
| Written Edge contract forbidding legacy paths | `supabase/tests/PHASE3B_EDGE_CONTRACT.md` | Good |

**What is missing**

| Gap | Severity | Detail |
|---|---|---|
| **No outbound RPC of any kind** | **P0** | 19 journal types; only `escrow_funding` (+ `insurance_fee`) is postable. `milestone_release`, `retainage_release`, `payout_requested`, `payout_settled`, `payout_failed`, `refund`, `refund_settled`, `material_funding`, `supplier_payment`, `chargeback`, `milestone_release_reversal`, `payout_reversed`, `provider_advance_*`, `platform_fee`, `wallet_credit`, `wallet_debit` — **zero implementations** |
| **Phase 3B/3B.0 not applied to staging** | **P0** | `payments`, `escrow_funder_approvals`, all `rpc_*` absent (`REMEDIATION_INVENTORY §3.3`) |
| **Zero app callers for any ledger RPC** | **P0** | The entire ledger is dead code from the product's perspective |
| **`release_milestone(p_amount numeric)` takes the amount from the client** | **P0** | `monopoly_ecosystem.sql:195`, called at `app/diaspora/project/[id].tsx:373-378`. A modified client can release any amount |
| **`transactions` / `withdrawals` have RLS OFF** | **P0** | Staging-confirmed. Client can INSERT arbitrary balance rows; `payout-setup.tsx:91-108` already does exactly that |
| **`process-escrow` returns success with no PSP when keys unset** | **P0** | `:95-100`, `:126-130`, `:153-157` — `paymentSuccess = true` |
| **`escrow-webhook` is unauthenticated and unsigned** | **P0** | No JWT, no signature, no service_role — a public endpoint in the payout path |
| **No FX engine** | **P0 for the business** | `CHECK (currency = 'XAF')` on accounts and journals. No `fx_quotes`, no inbound currency column, no `platform_fx_pnl` purpose, no rate provider. Your primary user pays in EUR |
| **No fee schedule** | **P1** | `v_fee := TRUNC(v_pay.amount_xaf * 0.015)` hardcoded at `20260826120000:594`, and posted as *insurance*. The `platform_fee` journal type is never used. You have no configurable revenue model |
| No payout state machine | **P1** | `withdrawals.status` is free text; required: `requested → authorised → processing → submitted → settled` with `failed / returned / reversed` exceptions |
| No reconciliation | **P1** | Nothing compares PSP settlement reports against `ledger_accounts`. `psp_*` accounts will silently drift |
| No treasury / float model | **P1** | Who holds the XAF that pays providers before the EUR clears? No float account, no prefunding, no liquidity view |
| Money-column chaos | **P1** | `balance_xaf`/`debit_xaf`/`credit_xaf`/`amount_xaf` (bigint) vs `amount_cfa`, `total_materials_cfa`, `labor_amount_cfa`, `unit_price_cfa`, `warranty_retainage_cfa`, `extracted_amount`, `amount`, `price`, `retainage_balance`, `material_budget` (all `numeric`). No `amount_minor` anywhere |
| Two competing advance/credit tables | P2 | `provider_advances` (`monopoly_ecosystem.sql:119`) and `credit_advances` (`monopoly_ecosystem_schema.sql:75`) |
| `@stripe/stripe-react-native` installed, never imported | P2 | Top-up is `Alert.alert` (`wallet.tsx:147-149`) |
| Admin marks payouts paid with no PSP proof | P1 | `admin/payouts.tsx:45-52` |
| Quarantined 50 002 XAF withdrawal unresolved | P2 | Per frozen decision; needs a documented write-off or reconciliation journal |

**What to add** — see `01_CANONICAL_MODELS.md §1` (money model + FX + fees) and §3 (state machines). The minimum set of new RPCs:

```
rpc_request_fx_quote            rpc_release_milestone
rpc_create_payment_intent  ✓    rpc_release_retainage
rpc_attach_payment_psp_ref ✓    rpc_request_payout
rpc_post_escrow_funding    ✓    rpc_authorise_payout
rpc_mark_payment_succeeded ✓    rpc_mark_payout_settled
rpc_begin/complete_webhook ✓    rpc_mark_payout_failed
rpc_post_material_funding       rpc_refund_project
rpc_post_supplier_payment       rpc_post_chargeback
rpc_freeze_funds                rpc_resolve_dispute_split
```

(`✓` = already written in the 3B migration, still unapplied.)

---

### 4.3 🏗️ Project Engine — 78%

**Target**

```
  YAOUNDÉ HOUSE                                    12 500 000 XAF
  ██████████░░░░░  68%                             funded 8 500 000

  ✓ Foundation      2 000 000   APPROVED → RELEASED → PAID → SETTLED
  ✓ Walls           3 000 000   APPROVED → RELEASED → PAID → SETTLED
  ● Roofing         2 500 000   IN PROGRESS   evidence 2/4
  🔒 Electrical     1 500 000   LOCKED        unlocks when Roofing settled
  ◆ Retainage         625 000   HELD until 2026-12-01
```

Four distinct per-milestone timestamps — approved / released / paid / settled — are the product. That table *is* the answer to "what happened to my money".

**What you have**

`projects`, `milestones`, `project_applications`, `project_bids` (`monopoly_ecosystem_schema.sql:6`), `project_contracts` (`apex_enterprise_schema.sql:28`), `project_observers`, `project_defects`, `project_updates`, warranty/retainage columns, `blueprints`, geo coords, weather-delay cron, provider tiering trigger, `hireProvider()` seeding two milestones (`lib/hireProvider.ts`), bid scoring (`utils/bidScoring.ts`), contract PDF (`utils/contractPdf.ts`), full project hub UI (`app/diaspora/project/[id].tsx`), workroom (`app/workroom/[id].tsx`).

**What is missing**

| Gap | Severity | Detail |
|---|---|---|
| **`projects` and `milestones` are never `CREATE TABLE`'d in any migration** | **P0** | They exist only as ALTERs plus a *staging-only* stub (`staging/000_app_baseline_min.sql`, explicitly not in migration history). You cannot rebuild your own database from `supabase/migrations/` |
| Same for `messages`, `notifications`, `reviews`, `project_expenses`, `project_updates`, `project_applications`, `transactions`, `withdrawals` | **P0** | ~10 core tables have no authoritative DDL |
| No milestone state machine | **P1** | `milestones.status` is free text; values `locked`/`paid`/`in_review` appear only in RPC bodies and cron functions. No CHECK, no transition function |
| Workflow and financial state collapsed into one column | **P1** | `status = 'paid'` is simultaneously a workflow claim and a money claim. This is the root of the whole dual-authority problem |
| No sequential-unlock enforcement server-side | P1 | "Step 2 cannot open until Step 1 is paid" is described in the vision, implemented nowhere. Needs `milestones.sequence` + a server check |
| `milestones` UPDATE allowed to every project participant | **P1** | `rls_and_auth.sql:63-70` uses `user_can_access_project`, which includes **observers**. A read-only family member can mutate milestone rows |
| Same flaw on `project_expenses` | P1 | Direct approve path |
| `projects` owner UPDATE covers money columns | **P1** | Budget, status, `retainage_balance`, `warranty_*` all client-writable |
| Two competing bid models | P2 | `project_applications` vs `project_bids` |
| No project templates / verticals | P2 | Construction is hardcoded in the schema shape. Education/health/agriculture (Part 5.12) need a `project_type` + template abstraction |
| Progress % is fabricated in the UI | P2 | `app/diaspora/index.tsx:113` — `status === 'in_progress' ? 0.65 : 0.3`. Must be derived from settled milestone value ÷ budget |
| `project_contracts` and `project_disputes` are SELECT-only | P2 | `apex_enterprise_schema.sql:79-90` — no INSERT policy, so the app writes them how? Verify; likely a silent failure |
| No change-order / variation flow | P2 | Real construction always changes scope. Today that means editing the budget, which corrupts the funding relationship |

---

### 4.4 📸 Evidence Engine — 72%

**Target**

```
   PROVIDER submits
     │  photos (n≥required)  ·  video  ·  invoice  ·  measurement
     │  captured_at  ·  GPS ± accuracy  ·  device  ·  content hash
     ▼
   EVIDENCE BUNDLE  (immutable, per milestone)
     │
     ▼
   CLIENT reviews ──┬── ACCEPT   → milestone.approved_at
                    ├── REVISE   → back to in_progress, reason recorded
                    └── DISPUTE  → dispute engine, funds frozen
     │
     ▼
   Bundle verdict is a PRECONDITION of rpc_release_milestone
```

**What you have**

Milestone evidence upload in `app/workroom/[id].tsx:122-184`; site updates with geofence in `app/provider/post_update.tsx` + `utils/geofence.ts`; receipt capture in `app/provider/add-receipt.tsx`; on-device compression to ~800px / q0.5–0.7 in `lib/storage.ts:6-10` (the "3G fix" — genuinely implemented); private `project_media` bucket gated by `user_can_access_project` (`storage_buckets.sql:30-48`); signed-URL resolution (`hooks/useEvidenceImageUrl.ts`, `components/EvidenceImage.tsx`); offline queue (`utils/offlineQueue.ts`, `hooks/useOfflineWorkroom.ts`); `project_media_meta` for spatial/360.

**What is missing**

| Gap | Severity | Detail |
|---|---|---|
| No `evidence_bundles` / `evidence_items` tables | **P1** | Evidence is scattered across `project_updates`, `project_media_meta`, `project_expenses`. There is no addressable object that a release decision can point at |
| Evidence is **not** a precondition for release | **P0** | `release_milestone` checks nothing about evidence |
| No client accept / revise / dispute verdict record | **P1** | The vision's three-way branch has no data model |
| No content hash / tamper evidence | P1 | A photo can be replaced in storage with no trace |
| No capture-time integrity | P1 | Gallery images are indistinguishable from camera captures; `captured_at` is client-asserted. Trivial to submit last month's photo, or someone else's |
| GPS is advisory only | P1 | `geofence.ts` checks distance client-side and can be bypassed; no server-side verification, no mock-location detection |
| Receipt OCR is a stub that always returns `null` | P2 | `utils/receiptOcr.ts:5-9`. The "AI receipt scanner" pillar does not exist yet |
| No required-evidence spec per milestone | P2 | Nothing says "roofing needs 4 photos + 1 invoice" |
| No video support | P2 | Vision mentions video; only images are handled |
| `utils/syncQueue.ts` is dead code | P2 | Written, never imported. Two half-built queues |

---

### 4.5 📦 Materials & Supplier Engine — 68% (your real moat, and closest to done)

**Target**

```
   CART  ──► client approves ──► LEDGER: escrow → project_materials_escrow
     │
     ▼
   SUPPLIER confirms ──► prepares ──► SERVER issues signed handoff token
     │                                        │
     │                                        ▼
     │                            provider presents QR at depot
     │                                        │
     ▼                                        ▼
   SUPPLIER scans ──► server verifies signature + single-use + expiry
     │
     ▼
   CUSTODY RECORD  (who, what, when, where, photo)
     │
     ▼
   LEDGER: project_materials_escrow → supplier_payable → payout
     │
     ▼
   TIMELINE: "100 bags cement purchased → handed to Jean → used in roofing"
```

That last line is the thing no competitor can copy quickly. It is worth finishing.

**What you have**

`suppliers`, `project_material_carts`, `project_material_cart_items` (generated `total_cfa`), cart build UI (`app/provider/material-cart.tsx`), cart hub (`app/provider/cart-hub.tsx`), client approval (`components/ClientApprovalCard.tsx`), supplier dashboard (`app/supplier/dashboard.tsx`), QR scan + handover photo (`app/supplier/scanner.tsx`), hardened cart RLS state gating (`20260602_harden_material_cart_rls.sql:3-29`), ledger purposes `project_materials_escrow` / `supplier_payable` and journal types `material_funding` / `supplier_payment` already in the enum.

**What is missing**

| Gap | Severity | Detail |
|---|---|---|
| **QR is signed client-side with a hardcoded shared string** | **P0** | `QR_SIGNING_KEY = 'material_cart_qr_v1'` in `app/provider/material-cart.tsx:31-34` and `app/supplier/scanner.tsx:23-32`, with a djb2-style hash. The key ships in the app bundle. Anyone can mint a valid handoff token and mark materials collected. Must become a server-issued HMAC/JWT, single-use, short expiry |
| Cart approval moves no money | **P1** | `payment_status` is a text column; no `material_funding` journal is ever posted |
| Supplier payment path absent | **P1** | `supplier_payable` account purpose exists; nothing credits or settles it |
| **Two supplier models** | P1 | `material-cart.tsx` uses `profiles.role='supplier'`; `app/provider/suppliers.tsx` uses the `suppliers` table |
| **Two `project_material_carts` definitions** | P1 | `monopoly_ecosystem.sql:56` (`total_materials_cfa`, `labor_amount_cfa`) vs `material_cart_supplier.sql:8` (`total_amount_cfa`, `payment_status`). Whichever applies last wins |
| No supplier onboarding / KYB / signup route | P1 | No `app/signup` supplier branch; `suppliers.is_verified` set by nobody |
| `suppliers` is `SELECT USING (true)` | P2 | `monopoly_ecosystem.sql:88` — including pricing and contact data |
| No price catalogue / market-rate reference | P2 | The "budget matches market rates" pillar needs a `material_prices` reference table with regional rates |
| No inventory/fulfilment states | P2 | `ordered → prepared → ready → collected → disputed` not modelled |
| Cart-hub "Scan QR" opens ID verification | P2 | `cart-hub.tsx:146-149` routes to `/provider/verification-scan?type=front` — wrong destination |
| No partial collection | P2 | 100 bags ordered, 60 delivered has no representation |

---

### 4.6 💬 Communication Engine — 80% (strongest non-money engine)

**What you have**

`messages` with realtime (`hooks/useProjectMessages.ts`), inbox threads for both roles, full-screen chat + `ChatRoom` component, voice notes (`hooks/useVoiceRecorder.ts`) with Whisper transcription (`supabase/functions/transcribe-voice`) and GPT translation (`supabase/functions/translate-message`), unread counts, read-state persistence (`lib/chatReadState.ts`), push via `webhook_outbox` triggers → `send-push` / `push-on-insert`, system messages from `weather-delay-cron`, `ProjectChatFab`.

Voice + auto-translation for a low-literacy, multilingual provider base is a genuinely differentiated choice.

**What is missing**

| Gap | Severity | Detail |
|---|---|---|
| `messages` has no `CREATE TABLE` | **P0** | Same DDL gap as §4.3 |
| Chat is not part of the immutable project record | P1 | Messages are mutable (`messages_update` policy exists) and not hash-chained. The "when there's a dispute, you have the history" promise is not enforceable |
| `push-on-insert` and `send-push` are unauthenticated | **P1** | Public endpoints that will send arbitrary push notifications to any device token |
| `webhook_outbox` policy is `ALL USING (true) WITH CHECK (true)` | **P1** | `triggers_and_webhooks.sql:20-21` — any authenticated user can read and write the outbox |
| No structured/system event messages in the timeline | P2 | Approvals, releases and disputes should appear inline as typed events, not free text |
| No notification preferences or digest | P2 | Only an on/off toggle |
| No moderation / abuse reporting | P2 | Needed once strangers transact |
| No off-platform-payment detection | P2 | "Just send me MoMo directly" is the primary leakage risk in every marketplace |

---

### 4.7 💸 Release Engine — ~0% correct

This is not really a separate engine so much as the missing hinge between §4.3, §4.4 and §4.2. Covered above; restating because it is the single highest-value piece of work in the repo.

```
   TODAY                              REQUIRED
   ─────                              ────────
   client taps "pay"                  client taps "approve"
        │                                  │
        ▼                                  ▼
   client types amount               server reads milestone.amount
        │                                  │
        ▼                                  ▼
   release_milestone(p_amount)       rpc_release_milestone(milestone_id)
        │                                  │
        ▼                                  ├─ 6 authorisation checks
   UPDATE milestones                       ├─ FOR UPDATE lock
   INSERT transactions                     ├─ idempotency key
        │                                  ▼
        ▼                             ledger_post_journal('milestone_release')
   money "moved" because                   │
   a status changed                        ▼
                                      payout engine (separate, async)
```

Required checks, all server-side, all in one transaction: caller is client → milestone state is `approved` → evidence bundle accepted → no open dispute → escrow balance sufficient → no existing release journal for this milestone → `SELECT FOR UPDATE` on the escrow account → post journal → advance milestone financial state.

---

### 4.8 🛑 Dispute Engine — 20%

**Target**

```
   CLIENT: "foundation not to spec"  ──►  OPEN DISPUTE
        │
        ├── LEDGER: project_escrow ──► platform_compliance_hold   (real freeze)
        ├── milestone financial state ──► frozen
        ├── release RPCs ──► reject while dispute open
        │
        ▼
   PROVIDER responds + evidence     (SLA clock)
   CLIENT rebuts + evidence         (SLA clock)
        │
        ▼
   ADMIN arbitration  (maker/checker, reasoned decision, recorded)
        │
        ├── client wins  → refund journal
        ├── provider wins→ release journal
        └── split        → 700 000 provider / 300 000 client, both via ledger
        │
        ▼
   Outcome feeds TRUST ENGINE for both parties
```

**What you have**

Three models, none canonical:

| Model | Where |
|---|---|
| `disputes` table | `20260328_enterprise_disputes_favorites_support.sql:9` — has a proper status CHECK |
| `project_disputes` table | `apex_enterprise_schema.sql:47` — SELECT-only RLS |
| `milestones.dispute_status` + `projects.dispute_milestone_id` + `arbitration_admin_id` | `apex_enterprise_schema.sql:42-45` |
| `trigger_dispute()` RPC | `trigger_dispute_rpc.sql:11` — sets `projects.status='disputed'` |
| RLS lock during dispute | `trigger_dispute_rpc.sql:58-62` — blocks project UPDATE when disputed |
| UI | `components/OpenDisputeSheet.tsx`; `app/diaspora/project/[id].tsx:480-512` writes to **both** `disputes` and `project_disputes` |

**What is missing**

| Gap | Severity | Detail |
|---|---|---|
| No canonical dispute entity | **P1** | Flagged as the Phase 17 blocker in `REMEDIATION_INVENTORY §4.3`. The app double-writes two tables |
| **Freeze is a status flag, not a funds hold** | **P0** | `platform_compliance_hold` and `compliance_hold`/`compliance_release` journal types exist and are never used. Opening a dispute does not actually immobilise money |
| No provider response flow | P1 | Only the client can act |
| No admin arbitration workflow | **P1** | `arbitration_admin_id` column exists; no screen, no RPC, no decision record |
| No split-resolution mechanics | P1 | The 700k/300k example has no implementation |
| No SLA / escalation clock | P2 | Disputes can sit forever |
| No evidence attachment to disputes | P1 | Depends on §4.4 |
| Dispute outcome does not affect reputation | P2 | Depends on §4.9 |
| No appeal path or external arbitration binding | P2 | Legal enforceability in Cameroon is untested |

---

### 4.9 🧠 Trust Engine — 12%

**Target**

```
   PROVIDER TRUST PROFILE
   ══════════════════════════════════════════════
   Identity verified          ✓  2026-04-12  exp 2028-04-12
   Professional verified      ✓  mason · 2 refs · insured
   ─────────────────────────────────────────────
   Projects completed        47      Milestones     213
   On-time delivery          94%     First-pass approval  97%
   Disputes                   3      Lost              1
   Avg response          2h 18m      Repeat clients   68%
   Material discrepancies     1      Evidence rejections 4
   ─────────────────────────────────────────────
   TIER: GOLD     Max project value: 8 000 000 XAF
   ══════════════════════════════════════════════

   → new provider  = low cap, more evidence, faster milestones
   → proven        = higher cap, fewer checks
   → high-risk job = extra verification, staged retainage
```

**What you have**

`profiles.tier` / `completed_projects` / `success_score` (`provider_tier_gamification.sql:4-7`), `compute_provider_tier()`, `sync_provider_tier_on_project_complete` trigger, `get_provider_stats()` returning completion rate / avg review / dispute count (`monopoly_ecosystem.sql:13-42`), `favorite_providers`, `project_bids.ai_score`, `utils/bidScoring.ts`.

**What is missing**

| Gap | Severity | Detail |
|---|---|---|
| **`reviews` table is never created** | **P0** | Only RLS policies reference it (`rls_and_auth.sql:122-129`). `get_provider_stats` averages a table that may not exist |
| Trust metrics displayed are hardcoded | P2 | `app/provider/profile.tsx:230-232` shows `100%` / `50%` from a boolean |
| No metric derived from real behaviour | P1 | On-time %, response time, first-pass approval, evidence rejection rate, material discrepancy count — none computed |
| Trust does not gate anything | **P1** | No project-value cap by tier, no extra-verification rule, no dynamic retainage. This is the whole point of the engine |
| No supplier reputation | P2 | `suppliers.is_verified` only |
| No client-side reputation | P2 | Bad clients (never approve, always dispute) are invisible to providers |
| No anomaly detection | P2 | Phase F territory, but the event data needed for it (§4.10) must be captured *now* |
| Ratings not tied to completed+settled milestones | P1 | Review farming is trivially possible |

---

### 4.10 🔐 Audit Engine — 8%

**Target**

```
   Every state change writes ONE row to an append-only event stream:

   domain_events
   ┌────┬─────────────────────┬───────────┬────────┬──────────┬─────────┐
   │ seq│ event_type          │ aggregate │ actor  │ payload  │ prev_hash│
   ├────┼─────────────────────┼───────────┼────────┼──────────┼─────────┤
   │ 1  │ PROJECT_CREATED     │ project:8 │ u:tina │ {...}    │ 0000... │
   │ 2  │ PAYMENT_INITIATED   │ payment:3 │ u:tina │ {...}    │ a91f... │
   │ 3  │ PAYMENT_CONFIRMED   │ payment:3 │ psp    │ {...}    │ 7c02... │
   │ 4  │ FUNDS_ESCROWED      │ project:8 │ system │ {...}    │ 3ee8... │
   │ 5  │ EVIDENCE_SUBMITTED  │ ms:12     │ u:jean │ {...}    │ b510... │
   │ 6  │ MILESTONE_APPROVED  │ ms:12     │ u:tina │ {...}    │ 4d7a... │
   │ 7  │ FUNDS_RELEASED      │ ms:12     │ system │ {...}    │ 9f31... │
   └────┴─────────────────────┴───────────┴────────┴──────────┴─────────┘
     hash_n = H(seq || event_type || payload || hash_{n-1})

   Purpose is NOT "blockchain". Purpose is:
   "six months later, in a dispute, we can prove what happened and when."
```

**What you have**

Ledger append-only triggers (`20260813:507-547`), `ledger_journals.idempotency_key UNIQUE`, `ledger_posted_events` with `psp_event_id UNIQUE`, `webhook_outbox`, `tax_report_audit`, `escrow_funder_approvals.approval_signature_hash`.

**What is missing**

| Gap | Severity | Detail |
|---|---|---|
| **No domain event table at all** | **P1** | The 13-event taxonomy in your vision exists nowhere in the schema |
| No hash chain | P1 | `approval_signature_hash` is a single field, not a chain. No tamper evidence for non-ledger facts |
| No actor attribution outside the ledger | **P1** | Who approved this KYC? Who processed this payout? Who edited this budget? Unanswerable |
| No admin action log | **P0** | Given the ungated admin screens, there is no record of admin activity whatsoever |
| Business tables are freely mutable | P1 | Only `ledger_journals`/`ledger_lines` are protected |
| No point-in-time reconstruction | P1 | Cannot answer "what did this project look like on 12 June?" |
| No retention / legal-hold policy | P2 | Compliance requirement |

---

### 4.11 📡 Offline-first — 45%

**Target**

```
   Provider on site, no signal
     ├─ take photo        ─┐
     ├─ attach evidence    │ all writes go to a LOCAL EVENT LOG
     ├─ write note         │ with client-generated UUIDs
     └─ mark progress     ─┘
                │
       network returns
                ▼
        SYNC QUEUE (ordered, retried, backoff)
                ▼
        SERVER validates each event
                ├─ accept  → ACK, apply
                ├─ dup     → ACK (idempotent, no double-apply)
                └─ reject  → surfaced to user with reason
                ▼
        LOCAL LOG reconciled with server truth
```

**What you have**

`useNetworkStatus` (NetInfo), `useOfflineWorkroom` (cache + pending evidence + auto/manual sync), `utils/offlineQueue.ts` (AsyncStorage queue for `project_update` inserts), React Query with AsyncStorage persistence (`context/QueryProvider.tsx`), offline banner + manual sync button (`app/workroom/[id].tsx:281-301`), image compression before upload.

This is real, working offline capability — better than most apps at this stage.

**What is missing**

| Gap | Severity | Detail |
|---|---|---|
| It is **caching + two ad-hoc queues**, not an event log | P1 | Your own note says this "should eventually become an offline event system"; that is correct and it is not one yet |
| `utils/syncQueue.ts` is dead code | P2 | Never imported. Consolidate to one queue |
| No client-generated IDs for offline-created rows | P1 | Only `payments.client_request_id` exists. An offline-created evidence item cannot be referenced until it syncs |
| No server-side idempotency for non-payment writes | **P1** | Retried evidence uploads will duplicate |
| No conflict resolution | P1 | Provider edits offline, client edits online — last write wins silently |
| No AsyncStorage size management | P2 | AsyncStorage is not designed for many queued images; MMKV or expo-sqlite is the right substrate |
| No background upload | P2 | Sync stops when the app is backgrounded — exactly what happens when a provider pockets the phone |
| No sync observability | P2 | Nothing reports stuck items or repeated failures |
| No SMS/USSD fallback | P2 | Some providers will not have a usable smartphone at all |

---

### 4.12 👨‍👩‍👧 Beneficiary / Family layer — 30%

**Target**

```
   PROJECT OWNER (funds, approves, disputes)     Stephane, Germany
        │
        ├── CO-FUNDER (approves multi-sig)       Brother, France
        │
        ├── BENEFICIARY (sees, comments,         Mother, Douala
        │   cannot move money)
        │
        ├── PROVIDER (works, submits evidence)   Jean, mason
        │
        └── SUPPLIER (delivers materials)        Depot, Yaoundé
```

**What you have**

`project_observers` table, invite-token generation and claim (`utils/observers.ts`), public join route (`app/observer/join.tsx`), read-only project UI when `projectAccessRole === 'observer'` (`app/diaspora/project/[id].tsx:629-691`), invite UI at `:953`. Plus `projects.funder_ids uuid[]` and `escrow_funder_approvals` for multi-funder.

This is a real head start on a feature most competitors lack.

**What is missing**

| Gap | Severity | Detail |
|---|---|---|
| **Observers can UPDATE milestones and expenses** | **P0** | `user_can_access_project` includes observers, and `rls_and_auth.sql:63-80` uses it for UPDATE. The read-only role is read-only *only in the UI* |
| No distinction between observer and beneficiary | P2 | Beneficiary is a named party with standing (should receive notifications, may confirm delivery); observer is a spectator |
| No granular visibility scopes | P2 | Should be able to share progress without sharing amounts — the single most-requested family feature |
| Observer invite tokens generated client-side | P1 | `utils/observers.ts` — should be server-issued and single-use |
| No beneficiary confirmation step | P2 | "Mother confirms the roof exists" is a powerful second evidence source, independent of the provider |
| No co-funder UI | P2 | `escrow_funder_approvals` has no screen |
| No supplier signup or supplier role in `resolveAccountRole` gating beyond redirect | P2 | Supplier has a stack, no tabs, no onboarding |

---

## Part 5 — The engines you have not named yet

These are the gaps that do not appear anywhere in the vision document and are not in `REMEDIATION_INVENTORY.md`. Several are existential rather than merely technical.

### 5.1 💱 FX Engine — **0%, and it blocks the business model**

Your customer is in Germany and pays EUR. Your ledger physically cannot record that:

```sql
-- 20260813_phase1_ledger.sql:266-267
currency char(3) NOT NULL DEFAULT 'XAF'
  CHECK (currency = 'XAF')
```

Needed: `fx_rate_sources`, `fx_rates` (bid/ask/mid, timestamp, source), `fx_quotes` (quote id, pair, rate, spread, expiry, locked amounts), a `platform_fx_pnl` account purpose, and an inbound-currency column set on `payments`. Also: who bears the movement between quote and settlement, and how you disclose the spread (in the EU, price transparency for currency conversion is regulated).

One structural relief: EUR→XAF is **pegged** at 655.957 via the CFA franc's euro peg. That removes market risk on the EUR corridor and makes a fixed-rate implementation defensible for v1. USD, CAD and GBP corridors are *not* pegged and will need real rates. Design for the general case, ship the pegged case.

### 5.2 🧾 Fee & Revenue Engine — 3%

Today your entire revenue model is one hardcoded line:

```sql
-- 20260826120000_phase3b_escrow_funding.sql:594
v_fee := TRUNC(v_pay.amount_xaf * 0.015);   -- posted as INSURANCE, not fee
```

The `platform_fee` journal type is never posted. Needed: a `fee_schedules` table (fee type, basis points, fixed component, min/max, currency, effective dates), a `fee_computations` record per transaction so a fee is always explainable, tier-based pricing, VAT/TVA handling (19.25% in Cameroon — does it apply to your service fee?), and clean separation of *fee* from *insurance premium* from *FX spread*. Right now you cannot answer "what did we earn last month, and from what?"

### 5.3 🏦 Payout, Treasury & Reconciliation — 0%

```
   Provider requests 500 000 XAF
        │
        ▼
   AUTHORISE  ── limits, sanctions re-check, balance lock
        │
        ▼
   BATCH  ── group by carrier, respect MoMo/Orange rate limits
        │
        ▼
   SUBMIT ── MoMo API / Orange API, store provider reference
        │
        ▼
   POLL / CALLBACK ── settled | failed | pending | returned
        │
        ▼
   RECONCILE ── daily carrier statement vs ledger psp_momo balance
        │
        ▼
   EXCEPTIONS ── stuck, duplicate, returned, wrong recipient
```

None of this exists. `withdrawals` rows are marked processed by hand in an ungated admin screen. Also absent: float/liquidity management (you need XAF on hand in Cameroon before the EUR clears in Europe), a break/exception queue, and a daily reconciliation job. A payments company without reconciliation discovers its losses from customers.

### 5.4 ⚖️ Compliance, AML & Regulatory — 5% (**read this section twice**)

What you have: `compliance-check` edge function (threshold flag), `projects.compliance_review_pending`, `platform_compliance_hold` account purpose.

What is missing is not a feature list — it is a licence question:

> Taking money from a person in Germany and paying it to a person in Cameroon is
> **cross-border money transmission**, regardless of the construction wrapper.
> In the EU this requires a payment institution licence or an agent/partner
> arrangement under PSD2. In CEMAC it falls under BEAC/COBAC rules on payment
> services and FX. Nothing about "escrow for a construction project" removes that.

Concretely missing: a decision on licensing (own licence vs regulated partner vs marketplace-with-licensed-PSP-of-record); KYC on the *sender*; sanctions/PEP screening; transaction monitoring rules; SAR/STR filing capability; per-level transaction limits; source-of-funds capture above thresholds; a documented AML programme and an accountable compliance officer; records retention (typically 5–10 years); data protection compliance in both jurisdictions (GDPR for the diaspora user, Cameroon Law 2010/012 for local data).

The technical shape of this matters for architecture: **if you use a licensed PSP as merchant/payment-institution of record, much of this obligation transfers to them** — but only if your money flow is designed so that you never take possession of client funds. That is an architectural decision that becomes very expensive to reverse after Phase 3B goes live. Decide it before, not after.

### 5.5 🛠️ Admin / Back-office — 5%, ungated

Two screens, no authorisation, no audit. A platform like this needs an operator console: KYC review with document viewer, dispute arbitration desk, payout approval with maker/checker (two humans for anything above a threshold), refund/reversal tooling, user lookup and support view, ledger explorer and trial balance, reconciliation break queue, feature flags and limit configuration, and an admin action log for every one of those actions. Plus tiered admin roles — a support agent must not be able to approve a payout.

### 5.6 🕵️ Trust & Safety / Fraud — 0%

The specific attacks this product invites, none of which are addressed:

| Attack | Mechanism today |
|---|---|
| Fake evidence | Gallery photo, old photo, someone else's site. No capture integrity |
| GPS spoofing | `geofence.ts` is client-side |
| Collusion | Client + provider agree to fake completion to extract laundered funds. No detection |
| Forged material handoff | Client-side QR key in the app bundle (§4.5) |
| Receipt inflation | OCR stub; no market-rate comparison |
| Account takeover | No 2FA, no device binding, no login anomaly detection |
| Payout to wrong/mule number | No name-matching against KYC, no cooldown after changing payout details |
| Review farming | Self-dealing projects; ratings not tied to settled money |
| Chargeback abuse | `chargeback` journal type exists, no handling |
| Off-platform leakage | No detection of "pay me directly" in chat |

### 5.7 📊 Observability & Incident Response — 0%

No Sentry or equivalent. No structured logging. No alerting on failed payments, stuck payouts, webhook failures, or ledger imbalance. No dashboards. No on-call runbook. When a provider says "I never got my money", there is currently no way to find out why.

The ledger already ships the right primitive: `ledger_verify_journal_equality()` and `ledger_trial_balance()`. Run them on a schedule and alert on non-zero. That is a one-day task with outsized value.

### 5.8 🧪 Testing, CI/CD & Release — 2%

| Thing | State |
|---|---|
| JS/TS tests | **Zero files.** No jest, no vitest, no testing-library |
| E2E | None. No Detox, no Maestro |
| SQL tests | Good — `phase3a_ledger_posting.sql`, `phase3b_escrow_funding.sql`, `phase3a_verify_readonly.sql` |
| CI | **None.** No `.github/workflows`, no GitLab CI |
| Typecheck script | Missing (`tsc --noEmit` is not in `package.json`) |
| `eas.json` | **Missing** — you cannot build a store binary |
| `ios.bundleIdentifier` / `android.package` | **Missing** in `app.json` |
| Secrets | Supabase URL + anon key **hardcoded** in `lib/supabase.ts:10-11` |
| Env pattern | No `EXPO_PUBLIC_*` usage; `expo-secure-store` installed but unused |
| Staging vs prod | App points at **production** `xtyqcdktwxzuezarnqhz` while the CLI is linked to staging `tvorurbmzrpwvxwztpix` |
| Migration integrity | 19 of 25 migration files are untimestamped and skipped by `db push`; ~10 core tables have no DDL |
| DR / backups | Undocumented. No tested restore |
| Deep link | `app.json` scheme is `diasporabridge`; `process-escrow` returns `diaspora-bridge://escrow-return` — **broken redirect** |

For a system that moves money, "no CI and no tests" is the gap that will eventually cause the incident, and "no `eas.json`" is the gap that stops you shipping at all.

### 5.9 📄 Financial Reporting & Statements — 25%

You have client-side PDF (`utils/pdfReceipt.ts`, `utils/contractPdf.ts`, `expo-print`) and a `generate-tax-report` edge function. Missing: the project financial statement from your vision (funded / released / frozen / remaining / fees / materials / payouts, reconciling to the ledger), a per-user account statement, server-side PDF with immutable archival (the edge `pdf-generate` is a placeholder returning `https://your-project.supabase.co/...`), monthly platform P&L, and regulator/auditor export packs.

### 5.10 🎧 Support & CS — 8%

`support_tickets` table exists (`20260328:95`). No agent view, no SLA, no macros, no ticket-to-project linkage, no in-app help centre, no phone/WhatsApp channel — which is how Cameroonian providers will actually want to reach you.

### 5.11 📈 Product Analytics & Data — 0%

No analytics SDK, no funnel instrumentation, no cohort/retention analysis, no data warehouse or dbt-style modelling. You will be unable to answer "where do funding attempts drop off?" or produce credible investor metrics (GMV, take rate, repeat funding rate, provider retention).

### 5.12 🌍 Vertical Abstraction — 0%

The expansion thesis (education, healthcare, agriculture, business) requires that "project" be generic. Today the schema is construction-shaped: `milestones`, `material_budget`, `warranty_retainage_cfa`, `project_defects`, `blueprints`. Before the second vertical you need a `project_type` enum plus a template model defining, per type: milestone structures, required evidence kinds, counterparty type (provider vs school vs hospital), and confirmation semantics ("tuition receipt from institution" rather than "photo of wall").

Do **not** build this now. Do make sure Phase C/D naming does not hardcode construction into the money layer — the ledger's generic `project_escrow` purpose is already correctly neutral.

### 5.13 ⚙️ Operating Model (Cameroon reality)

Not software, but it determines whether the software matters: provider sourcing and vetting on the ground, physical site inspection for high-value projects, supplier partnerships and negotiated pricing, a local entity and bank/mobile-money accounts, XAF liquidity, local dispute/arbitration counsel, a Douala/Yaoundé support presence, and enforceable local contracts. Your moat is regulated money movement **plus** verified local providers **plus** evidence **plus** materials **plus** milestones **plus** dispute resolution **plus** accumulated trust history. PostgreSQL is one seventh of that.

---

## Part 6 — Consolidation debt: what to delete

Duplicate models are a large share of your risk. Pick one of each and delete the rest:

| Concept | Competing implementations | Recommendation |
|---|---|---|
| Money authority | `ledger_*` vs `transactions`/`withdrawals` | **Ledger.** Freeze legacy behind RLS deny, then retire |
| Disputes | `disputes` / `project_disputes` / `milestones.dispute_status` | **`disputes`** (it has the status CHECK); migrate and drop the others |
| Material carts | `monopoly_ecosystem.sql:56` vs `material_cart_supplier.sql:8` | Merge into one DDL with one amount column |
| Suppliers | `suppliers` table vs `profiles.role='supplier'` | **`suppliers`** table, linked to an auth user |
| Bids | `project_applications` vs `project_bids` | Pick one; `project_bids` has scoring |
| Advances | `provider_advances` vs `credit_advances` | Pick one; defer the whole feature |
| Multi-sig | `compliance_aml_escrow_insurance.sql:25` vs `20260826110000` | **3B.0** (already the frozen decision) |
| Offline queue | `utils/offlineQueue.ts` vs `utils/syncQueue.ts` | One queue; delete the dead one |
| Types | `database.types.ts` (manual, `[key: string]: any`) vs `types/models.ts` | **Generated** types via `supabase gen types` |
| Role screens | `app/role.tsx` orphan vs login tabs | Delete `role.tsx` |

---

## Part 7 — Scorecard

| # | Engine | Now | Blocker | Priority |
|---|---|---|---|---|
| 1 | Money — ledger design | 90% | — | keep |
| 2 | Money — inbound impl | 40% | not applied to staging, no app callers | **P0** |
| 3 | Money — outbound impl | **0%** | no release/payout/refund RPC | **P0** |
| 4 | FX | **0%** | `CHECK currency='XAF'` | **P0** |
| 5 | Fees & revenue | 3% | hardcoded 1.5% | P1 |
| 6 | Payout & treasury | 0% | manual admin marking | **P0** |
| 7 | Reconciliation | 0% | none | P1 |
| 8 | Identity & KYC | 35% | no client KYC, no levels, no admin gate | **P0** |
| 9 | Project engine | 78% | no DDL for core tables, no state machine | **P0** |
| 10 | Evidence | 72% | not linked to release; no integrity | P1 |
| 11 | Materials | 68% | client-side QR key; no money path | **P0** |
| 12 | Communication | 80% | no DDL; unauth push endpoints | P1 |
| 13 | Disputes | 20% | 3 models; freeze moves no money | P1 |
| 14 | Trust | 12% | `reviews` table absent; gates nothing | P1 |
| 15 | Audit / events | 8% | no domain event log, no admin log | P1 |
| 16 | Offline | 45% | caching not event sync | P2 |
| 17 | Beneficiary | 30% | observers can write | **P0** |
| 18 | Compliance / AML | 5% | licensing undecided | **P0 (business)** |
| 19 | Admin back-office | 5% | ungated | **P0** |
| 20 | Trust & safety / fraud | 0% | none | P1 |
| 21 | Observability | 0% | none | P1 |
| 22 | Test / CI / release | 2% | no tests, no CI, no `eas.json` | P1 |
| 23 | Reporting | 25% | no statements | P2 |
| 24 | Support | 8% | table only | P2 |
| 25 | Analytics | 0% | none | P2 |
| 26 | Vertical abstraction | 0% | deliberate | P3 |

**The eight P0 items, in the order they must be done, are in `02_BUILD_ROADMAP.md`.**

---

## Part 8 — The product promise, and what it costs to keep

> *"Your money. Your project. Your proof — even when you're thousands of kilometres away."*

Mapped to what has to be true in the code:

| Promise word | Requires | Status |
|---|---|---|
| **Your money** | Ledger is the only authority; no client-controlled amounts; reconciliation proves the balance | ✗ legacy paths live |
| **Your project** | Server-enforced milestone state machine; sequential unlock; immutable history | ✗ free-text status |
| **Your proof** | Evidence bundles with integrity, chained events, exportable statements | ✗ no bundles, no chain |
| **Even when far away** | Offline sync, low-bandwidth, French, push, family visibility | ◐ genuinely good, incomplete |

Three of four are not yet true. All three are reachable in a single focused phase — and none of them requires throwing away work you have already done. That is the good news buried in a long list of gaps: the foundation is sound, the shell is attractive, and the missing pieces are additive rather than corrective.
