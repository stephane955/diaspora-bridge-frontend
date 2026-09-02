# DiasporaBridge — Canonical Models

**Generated:** 2026-09-02  
**Last verified:** 2026-09-02 (P01.9)  
**Status:** PARTIALLY APPLIED — canonical money scaffolding + P01 schema on staging; C05/C06/C07 not applied.  
**Current schema truth:** `docs/CURRENT_STATE.yaml` + `docs/04_MASTER_RECONCILIATION_AND_EXECUTION_PLAN.md`  
**Repo head:** `be1af5a0333a0b75867fdc60c6f8bb7670558e54` (+ uncommitted P00/P01 working tree)

**Frozen applied decisions (override proposals below):**
- Settlement currency table: **`public.platform_currencies`** (not `public.currencies`)
- Fee rounding: **truncate toward zero** (see `lib/money.ts`, `platform_fee_bps_minor`, DECISION_REGISTER #19)
- Insurance naming in legacy helpers → future semantic target = **platform service fee** (C04 rename)

**Purpose:** concrete designs referenced by `00_PLATFORM_BLUEPRINT.md`. Proposals below are reviewed against applied migrations before C05+.

Nothing in this document should be applied to production. Staging only.

---

## §1 — Canonical money model

### 1.1 The problem being solved

Eleven different ways of writing an amount currently coexist:

```
  bigint XAF (correct)          numeric (legacy)
  ─────────────────────         ────────────────────────────────
  ledger_accounts.balance_xaf   provider_advances.amount_cfa
  ledger_lines.debit_xaf        project_material_carts.total_materials_cfa
  ledger_lines.credit_xaf       project_material_carts.labor_amount_cfa
  payments.amount_xaf           project_material_carts.total_amount_cfa
                                project_material_cart_items.unit_price_cfa
                                project_material_cart_items.total_cfa
                                projects.warranty_retainage_cfa
                                projects.material_budget
                                projects.retainage_balance
                                project_expenses.extracted_amount
                                project_bids.amount
                                blueprints.price
                                transactions.amount
                                withdrawals.amount
                                milestones.amount / milestones.amount_cfa
```

`numeric` for money is not wrong in Postgres, but *mixing* it with `bigint` guarantees rounding disagreements between two systems that must agree exactly.

### 1.2 The rule

> **Every monetary amount is `(amount_minor bigint, currency char(3))`.**
> `amount_minor` is the smallest indivisible unit of that currency.
> XAF has **zero** decimal places, so for XAF `amount_minor == amount_xaf`.
> EUR/USD/GBP/CAD have two, so `amount_minor` is cents.
> No `numeric`, no `float`, no `real`, ever, for money.
> No amount column may exist without an adjacent currency column or a
> table-level currency constraint.

Because XAF is a zero-decimal currency, **your existing `*_xaf bigint` columns are already correct** and need no data migration. The work is (a) renaming for consistency, (b) converting the legacy `numeric` columns, and (c) adding currency where a non-XAF amount can appear.

Naming convention:

```
  <thing>_amount_minor  bigint    -- always paired with
  <thing>_currency      char(3)   -- ISO 4217

  e.g.  requested_amount_minor / requested_currency
        settled_amount_minor   / settled_currency
```

Add a reference table so currency arithmetic is never guessed:

```sql
CREATE TABLE public.platform_currencies (
  code          char(3) PRIMARY KEY,
  minor_units   smallint NOT NULL CHECK (minor_units BETWEEN 0 AND 4),
  name          text NOT NULL,
  is_settlement boolean NOT NULL DEFAULT false,  -- can we hold a balance in it?
  is_funding    boolean NOT NULL DEFAULT false   -- can a client pay in it?
);
INSERT INTO public.platform_currencies VALUES
  ('XAF', 0, 'CFA Franc BEAC',   true,  true),
  ('EUR', 2, 'Euro',             false, true),
  ('USD', 2, 'US Dollar',        false, true),
  ('GBP', 2, 'Pound Sterling',   false, true),
  ('CAD', 2, 'Canadian Dollar',  false, true);
```

**Settlement currency stays XAF only.** The ledger continues to hold a single settlement currency — that is a good decision and should be preserved. Foreign currency appears only on the *funding leg*, and is converted before it reaches a ledger account.

### 1.3 FX model

```
   CLIENT sees                LEDGER sees
   ───────────                ───────────
   "Fund €500"                nothing yet
        │
        ▼
   rpc_request_fx_quote('EUR','XAF', 50000)
        │
        ▼
   fx_quotes row:
     quote_id
     sell_currency EUR   sell_amount_minor 50000
     buy_currency  XAF   buy_amount_minor  327978
     mid_rate    655.957     source 'ecb_peg'
     spread_bps  0            (pegged corridor)
     expires_at  now()+15min
        │
        ▼
   rpc_create_payment_intent(project, quote_id, 'stripe')
        │  payments row stores BOTH legs + quote_id
        ▼
   PSP charges €500  ──►  webhook confirms €500 captured
        │
        ▼
   RECONCILE: does the captured foreign amount match the quote?
        │       does the received XAF match buy_amount_minor?
        ▼
   ledger_post_journal('escrow_funding')   ← XAF only, as today
```

Schema:

```sql
CREATE TABLE public.fx_rate_sources (
  code        text PRIMARY KEY,      -- 'ecb_peg' | 'openexchange' | 'manual'
  description text NOT NULL,
  is_active   boolean NOT NULL DEFAULT true
);

CREATE TABLE public.fx_rates (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source       text NOT NULL REFERENCES public.fx_rate_sources(code),
  base         char(3) NOT NULL REFERENCES public.platform_currencies(code),
  quote        char(3) NOT NULL REFERENCES public.platform_currencies(code),
  mid_rate     numeric(20,10) NOT NULL CHECK (mid_rate > 0),  -- rate, not money
  observed_at  timestamptz NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (base <> quote)
);
CREATE INDEX ON public.fx_rates (base, quote, observed_at DESC);

CREATE TABLE public.fx_quotes (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by       uuid NOT NULL REFERENCES auth.users(id),
  sell_currency      char(3) NOT NULL REFERENCES public.platform_currencies(code),
  sell_amount_minor  bigint  NOT NULL CHECK (sell_amount_minor > 0),
  buy_currency       char(3) NOT NULL REFERENCES public.platform_currencies(code),
  buy_amount_minor   bigint  NOT NULL CHECK (buy_amount_minor > 0),
  mid_rate           numeric(20,10) NOT NULL,
  spread_bps         integer NOT NULL DEFAULT 0 CHECK (spread_bps >= 0),
  rate_id            uuid REFERENCES public.fx_rates(id),
  expires_at         timestamptz NOT NULL,
  consumed_by_payment uuid,                 -- FK added after payments exists
  created_at         timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at)
);
```

Two new account purposes are required. Adding enum labels means the Phase 1 label-assertion blocks must be updated in the same migration:

```
  platform_fx_pnl     -- realised gain/loss between quote and settlement
  platform_float_xaf  -- prefunded XAF liquidity held in Cameroon
```

New journal type: `fx_conversion`.

**Rate policy to decide and write down:**
- EUR corridor: the CFA franc is pegged at **1 EUR = 655.957 XAF**. Use `source='ecb_peg'`, `spread_bps=0` or a disclosed margin. No market risk.
- USD/GBP/CAD corridors: floating. Requires a rate feed, a quote validity window (15 min is conventional), and a decision on who bears movement inside the window (you do — that is what the spread pays for).
- Disclosure: EU rules require the exchange rate and any margin over the reference rate to be shown to the payer before authorisation. Design the funding screen to display mid-rate, your margin, and the exact XAF the project receives.

### 1.4 Fee model

Replace the hardcoded `TRUNC(amount_xaf * 0.015)` at `20260826120000_phase3b_escrow_funding.sql:594` with a schedule, and separate the three revenue types that are currently conflated:

```
   FUNDING FEE      charged on money in       → platform_fees
   FX SPREAD        margin on conversion      → platform_fx_pnl
   INSURANCE PREMIUM cover for the project    → platform_insurance
   RELEASE FEE      charged on money out      → platform_fees   (optional)
   PAYOUT FEE       carrier cost pass-through → platform_fees
```

```sql
CREATE TYPE public.fee_kind AS ENUM (
  'funding', 'release', 'payout', 'insurance', 'fx_spread', 'dispute_admin'
);

CREATE TABLE public.fee_schedules (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind           public.fee_kind NOT NULL,
  currency       char(3) NOT NULL REFERENCES public.platform_currencies(code),
  basis_points   integer NOT NULL DEFAULT 0 CHECK (basis_points >= 0),
  fixed_minor    bigint  NOT NULL DEFAULT 0 CHECK (fixed_minor >= 0),
  min_fee_minor  bigint,
  max_fee_minor  bigint,
  psp_provider   text,          -- NULL = any
  payer_tier     text,          -- NULL = any; enables tiered pricing
  effective_from timestamptz NOT NULL,
  effective_to   timestamptz,
  created_by     uuid NOT NULL,
  CHECK (effective_to IS NULL OR effective_to > effective_from),
  CHECK (max_fee_minor IS NULL OR min_fee_minor IS NULL
         OR max_fee_minor >= min_fee_minor)
);

-- every fee ever charged must be explainable
CREATE TABLE public.fee_computations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id       uuid NOT NULL REFERENCES public.fee_schedules(id),
  kind              public.fee_kind NOT NULL,
  basis_amount_minor bigint NOT NULL,
  fee_amount_minor  bigint NOT NULL CHECK (fee_amount_minor >= 0),
  currency          char(3) NOT NULL,
  business_object_type text NOT NULL,   -- 'payment' | 'milestone' | 'payout'
  business_object_id   uuid NOT NULL,
  journal_id        uuid,               -- the ledger journal that booked it
  computed_at       timestamptz NOT NULL DEFAULT now()
);
```

Rounding rule (**FROZEN — applied**): **truncate toward zero on the fee**; counterparty receives the remainder. Example: 101 XAF at 1.5% → truncate = **1 XAF**, half-up would be 2 XAF; canonical = **1 XAF**. Matches `platform_fee_bps_minor`, `insuranceFeeMinor()` in `lib/money.ts`, and DECISION_REGISTER #19.

Also decide: does Cameroonian TVA (19.25%) apply to the platform service fee, and is it charged to the diaspora client or the local provider? This changes the journal shape (a `platform_vat_payable` purpose would be needed) and is much cheaper to answer now.

### 1.5 Ledger extension summary

Additive changes only — the existing structure is preserved:

| Change | Detail |
|---|---|
| New account purposes | `platform_fx_pnl`, `platform_float_xaf`, optionally `platform_vat_payable` |
| New journal types | `fx_conversion`, `material_release`, `dispute_split`, `writeoff` |
| Update label assertions | The `v_expected` arrays at `20260813_phase1_ledger.sql:75-95` and `:145-169` must be extended in the same migration, or `db push` will raise |
| Extend the posting matrix | `ledger_validate_phase3a_matrix` — one allowed debit/credit purpose pair per new type |
| Keep `CHECK (currency='XAF')` on accounts | Correct. Foreign currency lives on `payments` and `fx_quotes`, never on a ledger account |

---

## §2 — Identity & verification model

```sql
CREATE TYPE public.verification_axis AS ENUM (
  'identity',       -- you are a real, named person
  'professional',   -- you are actually a mason/electrician
  'business'        -- KYB for suppliers
);

CREATE TYPE public.verification_status AS ENUM (
  'not_started','submitted','in_review','approved','rejected','expired','revoked'
);

CREATE TABLE public.kyc_submissions (           -- append-only
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id    uuid NOT NULL REFERENCES auth.users(id),
  axis          public.verification_axis NOT NULL,
  document_type text NOT NULL,          -- 'cni' | 'passport' | 'trade_cert' | ...
  storage_paths jsonb NOT NULL,         -- private bucket paths only
  content_hashes jsonb NOT NULL,        -- sha256 per file, tamper evidence
  submitted_at  timestamptz NOT NULL DEFAULT now(),
  client_request_id uuid UNIQUE         -- offline/retry idempotency
);

CREATE TABLE public.kyc_decisions (            -- append-only
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id  uuid NOT NULL REFERENCES public.kyc_submissions(id),
  status         public.verification_status NOT NULL,
  decided_by     uuid NOT NULL REFERENCES auth.users(id),  -- the ADMIN, recorded
  reason_code    text,
  reason_note    text,
  valid_until    timestamptz,           -- forces re-verification
  decided_at     timestamptz NOT NULL DEFAULT now()
);

-- current state, derived, one row per (subject, axis)
CREATE TABLE public.verification_states (
  subject_id uuid NOT NULL REFERENCES auth.users(id),
  axis       public.verification_axis NOT NULL,
  status     public.verification_status NOT NULL DEFAULT 'not_started',
  level      smallint NOT NULL DEFAULT 0 CHECK (level BETWEEN 0 AND 3),
  valid_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (subject_id, axis)
);

-- limits are what make levels meaningful
CREATE TABLE public.transaction_limits (
  level              smallint PRIMARY KEY,
  per_tx_max_minor   bigint NOT NULL,
  daily_max_minor    bigint NOT NULL,
  monthly_max_minor  bigint NOT NULL,
  currency           char(3) NOT NULL DEFAULT 'XAF'
);
```

Every funding and payout RPC must call a limit check against `verification_states.level`. A level table with no enforcement is theatre.

**Admin authorisation**, which currently does not exist at all:

```sql
CREATE TYPE public.admin_role AS ENUM (
  'support',       -- read user + project, no money
  'kyc_reviewer',  -- approve/reject KYC
  'arbitrator',    -- resolve disputes
  'treasury',      -- authorise payouts (maker)
  'treasury_lead', -- approve payouts (checker)
  'superadmin'
);

CREATE TABLE public.platform_admins (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id),
  roles      public.admin_role[] NOT NULL,
  granted_by uuid NOT NULL REFERENCES auth.users(id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE FUNCTION public.has_admin_role(p_role public.admin_role)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins
    WHERE user_id = auth.uid() AND revoked_at IS NULL AND p_role = ANY(roles)
  );
$$;
```

Then: RLS policies on admin-facing tables use `has_admin_role(...)`, **and** `app/admin/_layout.tsx` gates the UI, **and** `resolveAccountRole.ts` learns about `admin`. All three, because the first is the only one that is actually security.

Maker/checker for payouts above a threshold: `treasury` authorises, `treasury_lead` approves, and the two must be different `user_id`s.

---

## §3 — State machines

### 3.1 The separation that everything depends on

```
   ONE milestone, FOUR independent state tracks
   ═══════════════════════════════════════════════════════════════

   WORKFLOW      locked → in_progress → in_review → approved
                                            ↑           │
                                     revision_requested ┘
                                            │
                                        disputed

   FINANCIAL     unfunded → funded → release_authorised → released
                                │                            │
                            frozen ←──────── dispute ────────┘

   PAYOUT        none → requested → authorised → processing
                              → submitted → settled
                              → failed → returned → reversed

   EVIDENCE      none → submitted → under_review → accepted
                                         │
                                    → rejected

   RULE: a WORKFLOW transition may never, by itself, cause a
   FINANCIAL transition. Only a server RPC that validates all four
   tracks may post to the ledger.
```

Today all four are collapsed into one free-text `milestones.status` where `'paid'` means everything at once. That single column is the origin of the dual-authority problem.

### 3.2 Enums and transition enforcement

```sql
CREATE TYPE public.milestone_workflow_state AS ENUM (
  'locked','in_progress','in_review','revision_requested','approved',
  'disputed','cancelled'
);
CREATE TYPE public.milestone_financial_state AS ENUM (
  'unfunded','funded','frozen','release_authorised','released','refunded'
);
CREATE TYPE public.payout_state AS ENUM (
  'none','requested','authorised','processing','submitted',
  'settled','failed','returned','reversed'
);
CREATE TYPE public.evidence_state AS ENUM (
  'none','submitted','under_review','accepted','rejected'
);
CREATE TYPE public.payment_state AS ENUM (
  'created','requires_action','processing','succeeded',
  'failed','cancelled','expired','reversed'
);
CREATE TYPE public.dispute_state AS ENUM (
  'open','awaiting_provider','awaiting_client','under_review',
  'resolved','withdrawn','expired'
);
```

Enforce transitions with a table plus a trigger, not with prose in a comment:

```sql
CREATE TABLE public.milestone_workflow_transitions (
  from_state public.milestone_workflow_state NOT NULL,
  to_state   public.milestone_workflow_state NOT NULL,
  actor      text NOT NULL,   -- 'client' | 'provider' | 'admin' | 'system'
  PRIMARY KEY (from_state, to_state, actor)
);
-- ... one row per legal transition ...

CREATE FUNCTION public.milestones_guard_transition() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.workflow_state IS DISTINCT FROM OLD.workflow_state THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.milestone_workflow_transitions
      WHERE from_state = OLD.workflow_state
        AND to_state   = NEW.workflow_state
        AND actor      = current_setting('app.actor_role', true)
    ) THEN
      RAISE EXCEPTION 'illegal milestone transition % -> % by %',
        OLD.workflow_state, NEW.workflow_state,
        current_setting('app.actor_role', true);
    END IF;
  END IF;
  -- financial_state may ONLY be changed by a SECURITY DEFINER ledger RPC
  IF NEW.financial_state IS DISTINCT FROM OLD.financial_state
     AND current_setting('app.ledger_context', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'financial_state may only change inside a ledger RPC';
  END IF;
  RETURN NEW;
END $$;
```

That last block is the mechanical enforcement of your top-level principle. It is worth writing carefully.

### 3.3 The release contract

```
rpc_release_milestone(p_milestone_id uuid, p_client_request_id uuid)
  SECURITY DEFINER, authenticated caller

  1  SELECT milestone JOIN project FOR UPDATE
  2  assert auth.uid() = project.client_id            -- authorisation
  3  assert workflow_state = 'approved'               -- workflow
  4  assert evidence_state = 'accepted'               -- evidence
  5  assert financial_state = 'funded'                -- financial
  6  assert NOT EXISTS (open dispute on project or milestone)
  7  assert verification level of client >= required
  8  SELECT project_escrow account FOR UPDATE
  9  assert escrow balance >= milestone.amount_minor
 10  assert NOT EXISTS (journal WHERE business_object_id = milestone
                                  AND journal_type = 'milestone_release')
 11  compute fee via fee_schedules → fee_computations
 12  compute retainage if final milestone
 13  ledger_post_journal(
       'milestone_release',
       idempotency_key := 'ms_rel:' || p_milestone_id,
       lines := [ Dr project_escrow      amount
                  Cr provider_payable    amount - fee - retainage
                  Cr platform_fees       fee
                  Cr project_retainage   retainage ])
 14  milestone.financial_state := 'released'
 15  emit MILESTONE_RELEASED domain event
 16  RETURN { journal_id, released_minor, fee_minor, retainage_minor }

  Idempotent: step 10 plus the deterministic idempotency key make a
  retried call a no-op that returns the original result.
```

The equivalent contracts for `rpc_request_payout`, `rpc_authorise_payout`, `rpc_mark_payout_settled`, `rpc_mark_payout_failed`, `rpc_refund_project`, `rpc_freeze_funds`, `rpc_resolve_dispute_split`, `rpc_post_material_funding` and `rpc_post_supplier_payment` follow the same shape: lock → assert every track → check for prior journal → post → advance state → emit event.

---

## §4 — Domain event model

### 4.1 Event taxonomy

Your vision lists 13 events. The full set needed to reconstruct any history:

```
  IDENTITY          MONEY IN              PROJECT
  ────────          ────────              ───────
  USER_REGISTERED   FX_QUOTE_ISSUED       PROJECT_CREATED
  KYC_SUBMITTED     PAYMENT_INITIATED     PROJECT_PUBLISHED
  KYC_APPROVED      PAYMENT_CONFIRMED     BID_SUBMITTED
  KYC_REJECTED      PAYMENT_FAILED        PROVIDER_HIRED
  KYC_EXPIRED       FUNDS_ESCROWED        CONTRACT_SIGNED
  LIMIT_BREACHED    FUNDING_REVERSED      MILESTONE_CREATED
                                          MILESTONE_STARTED

  EVIDENCE               MONEY OUT             MATERIALS
  ────────               ─────────             ─────────
  EVIDENCE_SUBMITTED     RELEASE_AUTHORISED    CART_CREATED
  EVIDENCE_ACCEPTED      FUNDS_RELEASED        CART_APPROVED
  EVIDENCE_REJECTED      PAYOUT_REQUESTED      MATERIALS_FUNDED
  REVISION_REQUESTED     PAYOUT_AUTHORISED     HANDOFF_TOKEN_ISSUED
  MILESTONE_APPROVED     PAYOUT_SUBMITTED      MATERIALS_COLLECTED
                         PAYOUT_SETTLED        SUPPLIER_PAID
                         PAYOUT_FAILED
  DISPUTE                PAYOUT_REVERSED       ADMIN
  ───────                REFUND_ISSUED         ─────
  DISPUTE_OPENED         CHARGEBACK_RECEIVED   ADMIN_ACTION_TAKEN
  FUNDS_FROZEN                                 LIMIT_OVERRIDDEN
  PROVIDER_RESPONDED     TRUST                 FEE_SCHEDULE_CHANGED
  DISPUTE_ESCALATED      ─────                 MANUAL_JOURNAL_POSTED
  DISPUTE_RESOLVED       REVIEW_SUBMITTED
  FUNDS_UNFROZEN         TIER_CHANGED
```

### 4.2 Schema with hash chain

```sql
CREATE TABLE public.domain_events (
  seq            bigserial PRIMARY KEY,
  event_id       uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  event_type     text NOT NULL,
  aggregate_type text NOT NULL,           -- 'project' | 'milestone' | 'payment'
  aggregate_id   uuid NOT NULL,
  actor_type     text NOT NULL,           -- 'user' | 'admin' | 'system' | 'psp'
  actor_id       uuid,
  payload        jsonb NOT NULL,
  journal_id     uuid REFERENCES public.ledger_journals(id),  -- if money moved
  occurred_at    timestamptz NOT NULL DEFAULT now(),
  prev_hash      bytea NOT NULL,
  hash           bytea NOT NULL
);

CREATE INDEX ON public.domain_events (aggregate_type, aggregate_id, seq);
CREATE INDEX ON public.domain_events (event_type, occurred_at DESC);

-- hash = sha256(seq || event_type || aggregate_id || payload::text
--               || occurred_at || prev_hash)
-- set by a BEFORE INSERT trigger reading the previous row's hash
-- under an advisory lock so the chain cannot fork under concurrency.
```

Then reuse the pattern you already got right on the ledger: `RAISE EXCEPTION` triggers on UPDATE, DELETE and TRUNCATE; RLS enabled with **zero** policies; `REVOKE ALL` from `anon` and `authenticated`; reads only through a `SECURITY DEFINER` function that scopes to projects the caller can see.

Verification function, mirroring `ledger_verify_journal_equality()`:

```sql
CREATE FUNCTION public.domain_events_verify_chain(p_from bigint DEFAULT 1)
RETURNS TABLE (seq bigint, expected bytea, actual bytea, ok boolean) ...
```

Run it nightly. Alert on any `ok = false`. That is the whole "tamper evidence" story, and it does not require a blockchain.

**Admin actions get their own stricter table** because they are the highest-risk events and must never be filterable out of the main stream:

```sql
CREATE TABLE public.admin_action_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id     uuid NOT NULL REFERENCES auth.users(id),
  admin_roles  public.admin_role[] NOT NULL,   -- roles held at time of action
  action       text NOT NULL,
  target_type  text NOT NULL,
  target_id    uuid,
  before_state jsonb,
  after_state  jsonb,
  reason       text NOT NULL,                  -- mandatory justification
  ip_address   inet,
  performed_at timestamptz NOT NULL DEFAULT now()
);
```

---

## §5 — Evidence model

```sql
CREATE TABLE public.evidence_bundles (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     uuid NOT NULL,
  milestone_id   uuid,
  submitted_by   uuid NOT NULL REFERENCES auth.users(id),
  state          public.evidence_state NOT NULL DEFAULT 'submitted',
  submitted_at   timestamptz NOT NULL DEFAULT now(),
  reviewed_by    uuid REFERENCES auth.users(id),
  reviewed_at    timestamptz,
  review_note    text,
  client_request_id uuid UNIQUE          -- offline idempotency
);

CREATE TABLE public.evidence_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id     uuid NOT NULL REFERENCES public.evidence_bundles(id),
  kind          text NOT NULL,           -- photo|video|invoice|receipt|measurement
  storage_path  text NOT NULL,           -- private bucket
  content_sha256 bytea NOT NULL,         -- tamper evidence
  byte_size     bigint NOT NULL,
  captured_at   timestamptz,             -- device-asserted, treat as a claim
  capture_source text NOT NULL,          -- 'camera' | 'gallery'  ← record it
  gps_lat       double precision,
  gps_lng       double precision,
  gps_accuracy_m double precision,
  device_model  text,
  created_offline boolean NOT NULL DEFAULT false,
  uploaded_at   timestamptz NOT NULL DEFAULT now()
);

-- what a milestone REQUIRES before it can be approved
CREATE TABLE public.evidence_requirements (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id uuid NOT NULL,
  kind         text NOT NULL,
  min_count    smallint NOT NULL DEFAULT 1,
  requires_gps boolean NOT NULL DEFAULT false,
  note         text
);
```

Two things worth emphasising: recording `capture_source` costs nothing and makes gallery-sourced "site photos" visible to reviewers and to fraud rules; and `content_sha256` lets you prove a stored file was never swapped, which is exactly the artefact you want six months into a dispute.

---

## §6 — Unified dispute model

Consolidate the three existing models into one. `disputes` (from `20260328`) is the right base because it already has a status CHECK.

```sql
ALTER TABLE public.disputes
  ADD COLUMN state public.dispute_state NOT NULL DEFAULT 'open',
  ADD COLUMN milestone_id uuid,
  ADD COLUMN frozen_amount_minor bigint,
  ADD COLUMN frozen_journal_id uuid REFERENCES public.ledger_journals(id),
  ADD COLUMN resolution_kind text,        -- 'client'|'provider'|'split'|'withdrawn'
  ADD COLUMN client_share_minor bigint,
  ADD COLUMN provider_share_minor bigint,
  ADD COLUMN resolution_journal_id uuid REFERENCES public.ledger_journals(id),
  ADD COLUMN arbitrator_id uuid REFERENCES auth.users(id),
  ADD COLUMN response_due_at timestamptz,
  ADD COLUMN resolved_at timestamptz,
  ADD CONSTRAINT dispute_split_sums CHECK (
    resolution_kind <> 'split'
    OR (client_share_minor + provider_share_minor = frozen_amount_minor)
  );

CREATE TABLE public.dispute_submissions (   -- both sides file evidence
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id uuid NOT NULL REFERENCES public.disputes(id),
  party      text NOT NULL CHECK (party IN ('client','provider')),
  bundle_id  uuid REFERENCES public.evidence_bundles(id),
  statement  text,
  filed_at   timestamptz NOT NULL DEFAULT now()
);
```

Then migrate `project_disputes` rows in, drop `project_disputes`, and reduce `milestones.dispute_status` to a generated/derived read of `disputes`. Stop the double-write at `app/diaspora/project/[id].tsx:480-512`.

**The freeze must move money**, not set a flag:

```
   DISPUTE_OPENED
     → ledger_post_journal('compliance_hold',
         Dr project_escrow            frozen_amount
         Cr platform_compliance_hold  frozen_amount)
     → disputes.frozen_journal_id = <journal>
     → milestone.financial_state = 'frozen'
     → rpc_release_milestone now fails step 6 for this project

   DISPUTE_RESOLVED (split 700k / 300k of 1 000 000)
     → ledger_post_journal('dispute_split',
         Dr platform_compliance_hold  1 000 000
         Cr provider_payable            700 000
         Cr project_escrow              300 000)   -- returned to escrow
```

Both `compliance_hold` and `compliance_release` journal types already exist in your enum and are used by nothing. The plumbing is waiting.

---

## §7 — Trust model

Derive metrics from settled facts, never from self-reported status. Materialise nightly so profile screens stay fast.

```sql
CREATE TABLE public.reviews (            -- the table your RLS already assumes
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid NOT NULL,
  milestone_id  uuid,
  reviewer_id   uuid NOT NULL REFERENCES auth.users(id),
  subject_id    uuid NOT NULL REFERENCES auth.users(id),
  rating        smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment       text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, reviewer_id, subject_id),
  CHECK (reviewer_id <> subject_id)
);
-- eligibility rule enforced in RPC, not policy:
-- a review may only be written if a milestone_release journal exists
-- for this project and the reviewer is a party to it.

CREATE TABLE public.trust_profiles (
  subject_id              uuid PRIMARY KEY REFERENCES auth.users(id),
  projects_completed      integer NOT NULL DEFAULT 0,
  milestones_completed    integer NOT NULL DEFAULT 0,
  on_time_rate            numeric(5,4),
  first_pass_approval_rate numeric(5,4),
  evidence_rejection_rate numeric(5,4),
  disputes_total          integer NOT NULL DEFAULT 0,
  disputes_lost           integer NOT NULL DEFAULT 0,
  material_discrepancies  integer NOT NULL DEFAULT 0,
  avg_response_seconds    integer,
  repeat_client_rate      numeric(5,4),
  gmv_settled_minor       bigint NOT NULL DEFAULT 0,
  tier                    text NOT NULL DEFAULT 'bronze',
  max_project_value_minor bigint NOT NULL DEFAULT 500000,
  computed_at             timestamptz NOT NULL DEFAULT now()
);
```

The point of the last column is that trust must **gate** something. Enforce `max_project_value_minor` inside `hireProvider` and inside the funding RPC. A new provider gets a small first project; a proven one gets larger ones. Without that enforcement the whole engine is decoration.

---

## §8 — Materials handoff: server-signed tokens

Replacing the client-side key at `app/provider/material-cart.tsx:31-34` and `app/supplier/scanner.tsx:23-32`.

```
   CLIENT approves cart
        │
        ▼
   rpc_post_material_funding(cart_id)
        Dr project_escrow → Cr project_materials_escrow
        │
        ▼
   SUPPLIER confirms  →  rpc_issue_handoff_token(cart_id)
        │                  server generates a random 32-byte nonce,
        │                  stores sha256(nonce), returns nonce ONCE
        ▼
   QR encodes: cart_id + nonce + exp     (nonce never stored in plaintext)
        │
        ▼
   SUPPLIER scans  →  rpc_redeem_handoff_token(cart_id, nonce)
        │              server: sha256 match? not expired? not already used?
        │              caller is the assigned supplier?
        ▼
   material_handoffs row + custody photo
        │
        ▼
   rpc_post_supplier_payment(cart_id)
        Dr project_materials_escrow → Cr supplier_payable
```

```sql
CREATE TABLE public.handoff_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id     uuid NOT NULL,
  nonce_sha256 bytea NOT NULL,        -- never the nonce itself
  issued_to   uuid NOT NULL,          -- provider who will present it
  redeemable_by uuid NOT NULL,        -- supplier who may scan it
  expires_at  timestamptz NOT NULL,
  redeemed_at timestamptz,
  redeemed_by uuid,
  UNIQUE (cart_id, nonce_sha256)
);

CREATE TABLE public.material_handoffs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id       uuid NOT NULL,
  token_id      uuid NOT NULL REFERENCES public.handoff_tokens(id),
  supplier_id   uuid NOT NULL,
  provider_id   uuid NOT NULL,
  items_delivered jsonb NOT NULL,     -- supports partial collection
  photo_path    text,
  gps_lat       double precision,
  gps_lng       double precision,
  occurred_at   timestamptz NOT NULL DEFAULT now()
);
```

Single-use, short-lived, server-verified, and it supports partial collection — which is what actually happens at a depot.

---

## §9 — RLS target matrix

Principles, in priority order:

1. **Deny by default.** RLS on, no policies, then add the narrowest policy that works.
2. **Split read from write.** `user_can_access_project()` currently grants *write* to observers because it answers only "is this person involved?" Replace it with `user_can_read_project()` and `user_can_write_project()`.
3. **No money table is ever writable by `authenticated`.** All mutation via `SECURITY DEFINER` RPC.
4. **No table exposes another user's PII.** Public profile data comes from a projection view.

| Table | anon | authenticated | Notes |
|---|---|---|---|
| `ledger_*` | – | – | keep as is: RLS on, zero policies |
| `domain_events` | – | – | read via SECURITY DEFINER fn only |
| `admin_action_log` | – | – | superadmin read via fn |
| `payments` | – | SELECT own | already correct |
| `fx_quotes` | – | SELECT own | insert via RPC |
| `fee_schedules` | – | SELECT active | pricing must be visible |
| `fee_computations` | – | SELECT own tx | explainability |
| `transactions` | – | **–** | **enable RLS, zero policies, retire** |
| `withdrawals` | – | SELECT own | **enable RLS**; insert via RPC only |
| `projects` | – | SELECT if party; UPDATE own **non-money cols only** | column-level split needed |
| `milestones` | – | SELECT if party; **UPDATE via RPC only** | remove the current UPDATE policy |
| `project_expenses` | – | SELECT if party; INSERT provider; **no UPDATE** | approval via RPC |
| `evidence_bundles` | – | SELECT if party; INSERT provider; UPDATE reviewer only | |
| `evidence_items` | – | SELECT if party; INSERT own bundle; no UPDATE | append-only |
| `disputes` | – | SELECT if party; INSERT if party; **UPDATE via RPC** | |
| `profiles` | – | SELECT **self only** | replaces `USING (true)` |
| `profiles_public` (view) | – | SELECT all | name, city, trade, rating, badges only |
| `kyc_submissions` | – | SELECT own, INSERT own | |
| `kyc_decisions` | – | SELECT own | INSERT by `has_admin_role('kyc_reviewer')` |
| `platform_admins` | – | – | superadmin only |
| `suppliers` | – | SELECT verified subset | replaces `USING (true)` |
| `handoff_tokens` | – | **–** | RPC only; nonce never readable |
| `webhook_outbox` | – | **–** | replaces `ALL USING (true)` |
| `messages` | – | SELECT if party; INSERT if party; **no UPDATE/DELETE** | immutable record |
| `reviews` | – | SELECT all; INSERT via RPC | eligibility check in RPC |
| `trust_profiles` | – | SELECT all | computed only |
| storage `kyc_documents` | – | own folder | already correct |
| storage `project_media` | – | `user_can_read_project` | already correct |
| storage `avatars` | SELECT | own folder write | public read is fine |

Every row of that table needs a test asserting the *negative* case — that the wrong role is refused. Positive-only RLS tests are how RLS bugs ship.

---

## §10 — Offline event sync

Turn the two ad-hoc queues into one local event log with server-side idempotency.

```
   DEVICE                                    SERVER
   ──────                                    ──────
   local_events (expo-sqlite / MMKV)
   ┌────┬──────────────┬─────────┬────────┐
   │ id │ type         │ payload │ state  │
   ├────┼──────────────┼─────────┼────────┤
   │ u1 │ EVIDENCE_ADD │ {...}   │ queued │
   │ u2 │ NOTE_ADD     │ {...}   │ queued │
   │ u3 │ MILESTONE_RQ │ {...}   │ queued │
   └────┴──────────────┴─────────┴────────┘
     id = client-generated UUID v4, created offline
        │
        │  network returns; ordered, exponential backoff
        ▼
   POST /sync  { events: [...] }  ──────►  for each event:
                                              client_request_id seen?
                                                yes → return prior result
                                                no  → validate + apply
                                           ◄──────  per-event ack/reject
        │
        ▼
   apply acks; surface rejects with a human-readable reason
```

Requirements:
- `client_request_id uuid UNIQUE` on **every** offline-creatable table (evidence bundles, items, messages, project updates, expenses, milestone requests). Only `payments` has this today.
- Per-event results, never a single batch status — one bad event must not block the queue.
- Move the store from AsyncStorage to `expo-sqlite` or MMKV. Queued images will exceed AsyncStorage's practical limits.
- Add `expo-task-manager` + `expo-background-fetch` so sync survives backgrounding, which is the normal case on a building site.
- A sync status screen: queued count, last attempt, last error, manual retry. You already have the banner in `app/workroom/[id].tsx:281-301` — extend it.
- Delete `utils/syncQueue.ts` or make it the single implementation.

---

## §11 — Reconciliation

```
   DAILY, per PSP / carrier
   ═══════════════════════════════════════════════════════

   1  fetch settlement report (Stripe payouts, MoMo statement,
                               Orange statement, bank statement)
   2  load into psp_settlement_lines (raw, immutable)
   3  match: psp_ref → payments.psp_ref → ledger journal
   4  classify each line:
        MATCHED            amounts and dates agree
        MISSING_IN_LEDGER  PSP has it, we do not      → investigate
        MISSING_IN_PSP     we have it, PSP does not   → investigate
        AMOUNT_MISMATCH    both have it, differ       → break
        DUPLICATE          two ledger entries, one PSP line
   5  every non-MATCHED line becomes a row in reconciliation_breaks
      with an owner and an age
   6  assert:  sum(psp_* ledger balances)
                 == sum(external account balances)
      alert on any difference

   ALSO NIGHTLY, independent of PSPs:
      ledger_verify_journal_equality()   → must return zero rows
      ledger_trial_balance()             → must net to zero
      domain_events_verify_chain()       → must be all ok
```

Those last three already exist or are trivial to add, and they are the cheapest high-value monitoring you can deploy. Wire them to an alert before you wire anything else.

---

## §12 — Decisions to freeze before writing migrations

Answer these in writing; each one is expensive to reverse later.

| # | Decision | Options |
|---|---|---|
| 1 | Regulatory posture | own licence · regulated partner as PI-of-record · marketplace where the PSP holds funds |
| 2 | Do you ever hold client funds? | if no, escrow is a *reservation* over PSP-held funds and much of §5.4 in the blueprint transfers to your partner |
| 3 | Funding currencies at launch | EUR only (pegged, simple) · EUR+USD · more |
| 4 | Who bears FX movement | you (spread) · client (float rate) |
| 5 | Fee model | % of funding · % of release · subscription · supplier margin · combination |
| 6 | Is VAT charged on fees, and to whom | Cameroon TVA 19.25% treatment |
| 7 | Canonical dispute entity | `disputes` (recommended) |
| 8 | Arbitration authority | internal admin · external arbitrator · Cameroonian court · hybrid |
| 9 | Retainage default | % and hold period, per project type |
| 10 | Provider payout timing | on release · daily batch · on request |
| 11 | Minimum KYC to fund | level 2 for any amount? level 1 under a threshold? |
| 12 | Provider trust caps | starting max project value, and progression rule |
| 13 | Evidence minimums | per milestone type, and who sets them |
| 14 | Data residency | EU region today (`eu-west-1`); is Cameroonian data localisation required? |
| 15 | Retention | KYC docs, evidence, chat, ledger — how long, and deletion mechanics under GDPR |
| 16 | Legacy `transactions` | freeze and retire (recommended) · migrate balances via a documented opening journal |
| 17 | The 50 002 XAF quarantine | written-off via `platform_loss` · reconciled · left frozen with a documented rationale |

Items 1, 2, 5 and 16 gate the schema. The rest can be decided in parallel with Phase C work.
