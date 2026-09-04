# C12 ↔ C03 ↔ C05 ↔ C06 Compatibility Review

**Updated:** 2026-09-03 (C12 APPLIED STAGING SCHEMA ONLY `20260903192834`)  
**C05:** `20260902183828` APPLIED  
**C06:** `20260902191944` APPLIED SCHEMA ONLY  
**C03:** `20260903175839` APPLIED STAGING SCHEMA ONLY  
**C12:** `20260903192834` APPLIED STAGING SCHEMA ONLY  
**Live money:** NO

## Domain separation

```text
C05 FUNDING REQUEST  = exact XAF authorization
C03 FX QUOTE         = foreign-source economic terms
C06 PAYMENT          = one logical inbound funding identity
C12 PAYMENT ATTEMPT  = one real provider execution attempt
C11 PROVIDER EVENT   = authenticated external fact
LEDGER               = accounting/cash authority
```

## Cardinality

```text
1 funding_request → 1 payment P1 → 0..N attempts A1..An
```

Forbidden: reopen C05; create P2; reopen terminal P1.failed/canceled; second escrow journal.

---

## Applied SQL facts (authority)

### C06

- Create sets `psp_provider`, status `requires_action`
- Idempotent replay rejects different provider/amount
- `rpc_attach_payment_psp_ref`: attach-once; may set status `processing`
- `rpc_mark_payment_succeeded`: requires matching provider + psp_ref; **rejects** `failed`/`canceled`
- Ledger purpose from `payment.psp_provider`; journal key `escrow_funding:{payment_id}`

### C03 (pre-C12 applied behavior)

- Initial Q1 usable → wrapper creates P1 → **marks Q1 consumed** with `payment_id=P1`
- Exact consumed Q1 retry → same P1
- Fresh usable Q2 while P1 exists → `payment_attempt_required`
- **Current** requote after intent: only when P1 is `failed`/`canceled` (and no ledger)
- Current requote **DENY** on `requires_action` / `processing` / `succeeded` / ledgered
- Lock order: funding_request → payment → fx_quote

---

## Frozen V1 model (C12-D2)

| Decision | Rule |
|----------|------|
| **#33** | Same-provider: `attempt.psp_provider = payment.psp_provider`; cross-provider DEFERRED |
| **#34** | Attempt failure ≠ P1 failure; P1.failed/canceled terminal; **no reopen** |
| **#35** | Attempt refs on attempts; `payments.psp_ref` = successful winner only |
| **#36** | At most one nonterminal attempt per payment |
| **#37** | Immutable `payments.funding_mode` ∈ {xaf_native, cross_border} |
| **#38** | A1 binds already-consumed Q1; retries consume fresh usable quotes |

---

## Logical payment state machine (C12-era)

| Status | Meaning |
|--------|---------|
| `requires_action` | No currently active execution; more action/retry permitted |
| `processing` | Exactly one active (nonterminal) attempt |
| `succeeded` | Authoritative provider success accepted |
| `failed` | Terminal logical abandonment / exhaustion |
| `canceled` | Terminal logical cancellation |

### Allowed transitions (V1)

```text
requires_action → processing     (create active attempt)
processing → requires_action     (attempt failed/canceled retryably)
processing → succeeded           (authoritative success finalization)
requires_action → failed|canceled
processing → failed|canceled     (payment-level abandon while active — rare/admin)
```

### Forbidden

```text
failed → processing | succeeded
canceled → processing | succeeded
succeeded → anything
```

Chargebacks/refunds are **C09 overlays**, not status rewrites.

---

## Attempt state machine (conceptual V1)

| Status | Terminal? | Provider submitted? | Provider ref may exist? | New retry may start? |
|--------|-----------|---------------------|-------------------------|----------------------|
| `created` | no | no | optional/null | no (this is the active one) |
| `submitted` | no | yes (outbound) | may be null until returned | no |
| `processing` | no | yes | usually yes | no |
| `succeeded` | yes | yes | required (winner) | no |
| `failed` | yes | maybe | may exist on attempt only | yes (if P1 retryable) |
| `canceled` | yes | maybe | may exist on attempt only | yes (if P1 retryable) |

`attempt.failed` ≠ `payment.failed`.  
`attempt.canceled` ≠ `payment.canceled`.

---

## Quote consumption — INITIAL vs RETRY

### INITIAL (current applied C03 + Decision #38)

```text
Q1 usable
  → C03 wrapper creates P1
  → C03 marks Q1 consumed (Q1.payment_id = P1)
  → BEFORE any C12 attempt exists

C12 creates A1:
  payment_id = P1
  fx_quote_id = Q1   (must be THE consumed quote for P1)
  does NOT re-consume Q1
```

Derivation: sole candidate is `fx_quotes` where `payment_id = P1 AND status = consumed` for the initial bootstrap when no attempts exist. Do not accept arbitrary consumed quotes.

### RETRIES (C12)

```text
A1 failed/canceled
P1 → requires_action
no nonterminal attempt
  → C12-aware C03 may record usable Q2
  → C12 creates A2 + consumes Q2 atomically
```

If A2 create aborts: Q2 remains usable.

---

## Pre-C12 vs C12-era requote

| Era | Rule |
|-----|------|
| **Applied C03 today** | Post-intent Q2 only if P1 `failed`/`canceled` (no ledger). DENY `requires_action`. |
| **Future C12-aware C03** (additive `CREATE OR REPLACE` in C12 candidate — not D2) | Q2 allowed only if: `P1.status = requires_action` AND `ledger_journal_id IS NULL` AND ≥1 prior terminal failed/canceled **attempt** AND **no** nonterminal attempt AND P1 not succeeded/failed/canceled. |

Still DENY after C12 model active when:

```text
active attempt exists
P1.processing
P1.succeeded | failed | canceled
ledger_journal_id IS NOT NULL
```

Do **not** edit historical C03 migration file.

---

## Provider / psp_ref (#33 / #35)

```text
attempt.psp_provider MUST = payment.psp_provider
payment_attempts.provider_attempt_ref = every execution ref
payments.psp_ref = winning successful ref only
```

Failed attempt refs stay on attempts. Never attach failed A1 ref to `payments.psp_ref` (would block winner via C06 attach-once).

### Atomic success finalization (service-only, one DB transaction)

After C11-authenticated event:

```text
lock funding_request → payment → quote(if needed) → attempt
verify event / provider / ref / no other succeeded attempt
verify P1 not succeeded/ledgered; not failed/canceled
mark An succeeded
promote An.provider_attempt_ref → payments.psp_ref
compose existing C06 mark-succeeded + post_escrow_funding semantics
commit
```

**Composition note:** Do not use early `rpc_attach_payment_psp_ref` for failed attempts. Additive service-only success wrapper may set `payments.psp_ref` then invoke C06 success/posting inside one transaction. Historical C06 unchanged.

---

## Funding mode (#37)

```text
payments.funding_mode ∈ { xaf_native, cross_border }  — immutable
cross_border → every attempt requires fx_quote_id
xaf_native   → every attempt requires fx_quote_id IS NULL
```

### Additive compatibility (future C12 SQL — not D2)

- Staging `payments` rows = 0 → no backfill
- Additive column + immutability enforcement
- Cross-border create: C03 wrapper (additive replace) sets `funding_mode = cross_border` after/with P1 create
- XAF-native create: additive native wrapper sets `funding_mode = xaf_native`
- Once C12 operational: unclassified direct C06 creates must be blocked (revoke/replace path) so live payments cannot omit mode
- App funding currently unwired → safe cutover window

Attempt.fx_quote_id alone is **insufficient** as the sole corridor authority (mode switching risk across attempts).

---

## Lock order

```text
1) escrow_funding_requests
2) payments
3) fx_quotes          (when quote involved)
4) payment_attempts
```

Compatible with C03-R3.1 and C06.

---

## Concurrency

| Scenario | Outcome |
|----------|---------|
| A1 processing + create A2 | DENY — one-active (#36) |
| Success finalization + create A2 | Both lock payment; success → P1.succeeded; A2 DENY |
| Success vs requote | Requote denied while processing/succeeded/active attempt |

---

## Late provider success after attempt.failed

**OPEN.** Do not assume failed attempts can never succeed at the provider. Policy:

- Prefer terminal attempt immutability in-core
- Late contradictory events → C11/C13 quarantine / reconciliation exception
- Must not silently authorize a parallel retry charge or second ledger post

---

## Provider-submission idempotency

Stable key for outbound PSP: **`payment_attempt.id`** (or deterministic key uniquely derived from it). One DB attempt → at most one intended PSP charge identity. Double HTTP submission remains **OPEN** at orchestration layer.

---

## Security

| Actor | Direct attempt DML | Success / attach / ledger |
|-------|--------------------|---------------------------|
| Client | DENY | DENY |
| Observer | DENY | DENY |
| Provider user | DENY | DENY |
| service_role | YES (trusted RPCs) | YES |

Optional future: payer calls tightly controlled DEFINER create/retry RPC — never direct table DML; never client-supplied money authority.

---

## Executable candidate flows (C12-R)

### INITIAL CROSS-BORDER

```text
Q1 usable
  → C03 rpc_create_cross_border_payment_intent
  → nested historical C06 creates P1
  → P1.funding_mode = cross_border (same txn; deferred NOT NULL)
  → Q1 consumed by C03 (Q1.payment_id = P1)
  → A1 via rpc_create_payment_attempt binds Q1 (does NOT re-consume)
```

### RETRY

```text
A1 failed (rpc_fail_payment_attempt)
  → P1.requires_action (P1 is NOT failed)
  → C12-aware rpc_record_fx_quote issues Q2
  → rpc_create_payment_attempt(A2, Q2) consumes Q2 atomically
Forced A2 abort → Q2 usable, no A2, P1 requires_action
```

### SUCCESS

```text
C11 future trusted event (not implemented)
  → rpc_finalize_payment_attempt_success (service-only)
  → lock request → payment → quote → attempt
  → attempt succeeded
  → winner provider_attempt_ref → payments.psp_ref
  → nested rpc_mark_payment_succeeded + rpc_post_escrow_funding
  → exactly one XAF escrow_funding journal
Does not call rpc_attach_payment_psp_ref (would force processing / attach in-flight refs).
```

Historical C06 `rpc_create_payment_intent` remains the internal primitive.
External create: `rpc_create_xaf_payment_intent` / `rpc_create_cross_border_payment_intent`.


| Pair | Verdict |
|------|---------|
| C12↔C05 | Compatible — no reopen |
| C12↔C03 | Compatible with #38 bootstrap + future additive requote patch |
| C12↔C06 | Compatible with #33–#36; success via additive wrapper; no historical C06 edit |
| Live money | NO |

## Flags

```text
C12_D2_PASS: YES
DECISION_33..36: FROZEN
DECISION_37: FROZEN (payment funding_mode)
DECISION_38: FROZEN
TERMINAL_PAYMENT_REOPEN_ALLOWED: NO
C03_C12_REQUOTE_PATCH_DEFINED: YES
ATOMIC_SUCCESS_FINALIZATION_DEFINED: YES
C12_SCHEMA_DESIGN_READY: YES
C12_SCHEMA_CANDIDATE_EXISTS: NO
C12_ACTIVE_MIGRATION_EXISTS: YES
C12_LOCAL_PROOF_PASS: YES
C12_CANDIDATE_READY: YES
C12_APPLY_READY: YES
C12_SCHEMA_APPLIED: YES
C12_STAGING_VERIFIED: YES
LIVE_MONEY_READY: NO
```
