# C11 ↔ C06 ↔ C12 Event Compatibility Review

**Updated:** 2026-09-04 (C11-D1 design only)  
**C06:** `20260902191944` APPLIED STAGING SCHEMA ONLY  
**C12:** `20260903192834` APPLIED STAGING SCHEMA ONLY  
**C11:** design only — **no SQL**  
**Live money:** NO

## What C11 owns / does not own

| Owns | Does not own |
|------|----------------|
| Cryptographic/authenticity verification | C05 funding authorization |
| Canonical inbound event identity + replay | C03 FX economics |
| Correlation to C12 attempts | C06 logical payment identity |
| Classification + quarantine | C12 attempt/payment transitions |
| Evidence for C13 | Ledger journals (via C12 only) |
| Handoff of refund/chargeback authenticity to C09 | C09 accounting overlays |

## Existing C06 objects (actual SQL)

### `ledger_posted_events` (Phase 1)

Columns: `id`, `psp_event_id` UNIQUE, `event_type`, `psp_ref`, `received_at`, `processed_at`, `journal_id`, `status` (`received|processed|failed|ignored`).

Comment authority: **PSP/webhook event deduplication. Does not post journals.**

Insufficient for C11 authenticity store:

- no signature/raw body / payload hash
- no verification_result
- no quarantine reason
- no attempt_id correlation
- status model is ledger-processing oriented, not authenticity-oriented
- `rpc_begin_psp_webhook_event` can reset non-processed rows back to `received` (retry), which is unsafe as sole authenticity evidence

### `ledger_canonical_psp_event_id(provider, raw_id)`

Returns `lower(provider) || ':' || trim(raw_id)`.

**Reusable** as the canonical *identity string* for uniqueness.

### `rpc_begin_psp_webhook_event` / `rpc_complete_psp_webhook_event`

Service-only. Begin inserts/locks `ledger_posted_events` and returns proceed/retry. Complete sets processed/failed/ignored + optional journal_id.

**Reusable as ledger-posting bookkeeping**, not as the primary authenticity layer.

## Recommended data model (Decision #44 proposal)

**Option D — additive `provider_events` + keep `ledger_posted_events` ledger-only**

```text
provider_events (C11)
  = authenticity, raw evidence, correlation, quarantine, processing disposition

ledger_posted_events (C06/ledger)
  = optional compatibility dedupe when a journal is actually posted
```

Reject Option C (reuse ledger_posted_events as primary) — it cannot safely represent rejected/quarantined verified events with raw evidence.

Option B (events + processing_attempts) is deferred unless concurrency evidence requires it.

## Generic event envelope (provider-neutral)

Conceptual fields (not SQL):

```text
id
psp_provider
provider_event_id_raw
canonical_event_id          -- provider:raw via ledger_canonical_psp_event_id
provider_event_type_raw
received_at
verified_at
verification_result         -- unsigned | rejected | verified
payload_hash
raw_payload_ref_or_bytes    -- size-capped; retention policy; no client SELECT
signature_metadata_redacted -- algorithm/version only; never secret
payment_attempt_id          -- nullable until correlated
provider_attempt_ref        -- from payload after verify
processing_status           -- received | quarantined | processed | ignored
quarantine_reason
processed_at
```

Provider-specific verifiers (Stripe/MoMo/Orange) are **out of scope** until selected provider contracts are verified in-repo.

## State machine

Split authenticity from business processing:

```text
HTTP received
  → verification_result = rejected     (stop)
  → verification_result = verified
        → processing_status = quarantined   (ambiguous / late / conflict)
        → processing_status = ignored       (duplicate/no-op)
        → processing_status = processed     (C12 transition invoked successfully)
```

## Attempt correlation (Decision #42 proposal)

Precedence:

1. Outbound idempotency identity = **`payment_attempt.id`** (frozen C12 rule)
2. Confirm `psp_provider` matches payment/attempt
3. Confirm `provider_attempt_ref` matches attempt (attach-once / winner rules)
4. Deny/quarantine if zero matches, >1 matches, provider mismatch, incompatible terminal state

Never use amount + user + approximate time as authority.

## Event matrix (minimum)

| Event class | Verify | Dedupe | C12 call | Else |
|-------------|--------|--------|----------|------|
| Success (allowed) | yes | yes | `rpc_finalize_payment_attempt_success` | — |
| Success duplicate | yes | hit | none (idempotent same outcome) | ignore/processed |
| Success late after attempt.failed | yes | yes | **NO** | quarantine → C13 |
| Success unknown attempt | yes | yes | NO | quarantine |
| Success wrong provider/ref | yes | yes | NO | reject/quarantine |
| Hard decline / cancel (clear) | yes | yes | `rpc_fail_payment_attempt` | — |
| Temporary processing / unknown | yes | yes | NO auto-fail | await / quarantine |
| Failure after success | yes | yes | NO reopen | quarantine / C09 if refund semantics |
| Processing after success | yes | yes | NO | ignore |
| Chargeback/refund/dispute | yes | yes | NO money mutate | handoff C09 after authenticity |

## Idempotency layers (distinct)

| Layer | Mechanism |
|-------|-----------|
| HTTP delivery replay | unique canonical event id |
| Event processing replay | processing_status + same disposition |
| C12 transition replay | existing C12 success/fail idempotency |
| Ledger replay | `escrow_funding:{payment_id}` + payment.ledger_journal_id |

Inbound webhook dedupe ≠ outbound provider request idempotency (`DOUBLE_PROVIDER_HTTP_SUBMISSION` remains OPEN).

## Concurrency / lock order

```text
1. Verify authenticity without financial locks
2. Upsert/lock provider_events row
3. Call C12 which owns:
   funding_request → payment → fx_quote → payment_attempt
```

Do not reverse C12 lock order. Event-row locks must not create cycles with financial locks.

## Success authority

```text
verifier PASS
+ unique canonical event
+ exact attempt correlation
+ provider/ref exact
+ business transition allowed
+ not quarantined
  → rpc_finalize_payment_attempt_success
```

C12 remains the only DB mutation/ledger gate for success.

## Environment separation

```text
staging credentials / endpoints / event namespace
production credentials / endpoints / event namespace
```

No staging secret may validate production traffic.

## RLS (design)

Future `provider_events`:

```text
RLS ON
authenticated INSERT/UPDATE/DELETE DENY
observer/provider-user/supplier DENY
raw payload / signature material not client-readable
optional sanitized status SELECT = separate product decision
```

## Flags

```text
C11_D1_PASS: YES
PROVIDER_NEUTRAL_C11_SCHEMA_DESIGN_READY: YES
PROVIDER_SPECIFIC_VERIFIER_READY: NO
C11_SCHEMA_CANDIDATE_EXISTS: NO
C11_SCHEMA_APPLIED: NO
PSP_INTEGRATED: NO
LIVE_MONEY_READY: NO
```
