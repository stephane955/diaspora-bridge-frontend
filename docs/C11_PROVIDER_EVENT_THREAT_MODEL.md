# C11 Provider-Event Threat Model

**Updated:** 2026-09-04 (C11-D1 design only)  
**Scope:** Authenticated provider-event design — **no SQL, no edge deploy, no PSP calls**  
**Depends on:** C06 `20260902191944`, C12 `20260903192834`  
**LIVE_MONEY_READY:** NO

## Authority boundary

```text
C05 FUNDING REQUEST     = exact XAF authorization
C03 FX QUOTE            = foreign-source economics
C06 PAYMENT             = one logical funding identity
C12 PAYMENT ATTEMPT     = one real provider execution attempt
C11 PROVIDER EVENT      = authenticity + dedupe + correlation + classification
LEDGER / C06 post       = accounting/cash authority (via C12 finalization)
C09 CHARGEBACK/REFUND   = post-success financial overlays
C13 RECONCILIATION      = exception / treasury resolution
```

```text
AUTHENTIC EVENT ≠ VALID BUSINESS TRANSITION ≠ MONEY MOVED
```

## Intended chain

```text
external PSP/provider
  → raw HTTP bytes
  → C11 provider-specific cryptographic/authenticity verification
  → canonical event identity (provider:raw_id)
  → dedupe / replay protection
  → exact attempt correlation
  → event classification
  → if allowed: C12 controlled transition
  → ledger exact XAF once (via C12 success path)
```

Never:

```text
client says succeeded → C12 success
provider JSON string "succeeded" alone → money moved
C11 directly UPDATE payments / payment_attempts / INSERT ledger
```

## Threat matrix

| Threat | Rating | Notes |
|--------|--------|-------|
| Unsigned webhook | **MITIGATED BY DESIGN** | Reject before parse/business |
| Bad signature | **MITIGATED BY DESIGN** | verification_result=rejected |
| Wrong secret / provider | **MITIGATED BY DESIGN** | env-scoped secrets; provider mismatch deny |
| Replayed valid event | **MITIGATED BY DESIGN** | UNIQUE(provider, raw_event_id) / canonical id |
| Same raw event ID different provider | **MITIGATED BY DESIGN** | namespaced identity |
| Tampered body | **MITIGATED BY DESIGN** | signature over required raw representation |
| JSON reserialization breaking signature | **MITIGATED BY DESIGN** | capture raw bytes first; verify; then parse |
| Timestamp / old-but-valid signature | **PROVIDER-SPECIFIC** | tolerance windows per provider contract |
| Event ID substitution | **MITIGATED BY DESIGN** | identity from verified material + unique store |
| Provider ref substitution | **MITIGATED BY DESIGN** | exact match to attempt/payment after verify |
| Attempt ID substitution | **MITIGATED BY DESIGN** | correlation rules + quarantine on ambiguity |
| Wrong environment secret | **MITIGATED BY DESIGN** | staging≠production credentials/endpoints |
| Staging event → production | **MITIGATED BY DESIGN** | env separation; production untouched in this task |
| Duplicate concurrent delivery | **MITIGATED BY DESIGN** | unique insert + processing idempotency |
| Out-of-order event | **MITIGATED BY DESIGN** | matrix: process / ignore / quarantine |
| Late success after attempt.failed | **OPEN / QUARANTINE** | authentic → quarantine → C13; never auto succeed |
| Event bombing / rate abuse | **OPEN** | edge rate limits (E-phase) |
| Oversized payload | **MITIGATED BY DESIGN** | hard size cap before store |
| Malformed body | **MITIGATED BY DESIGN** | reject after verify attempt / parse fail quarantine |
| Secret leakage in logs | **MITIGATED BY DESIGN** | never log auth headers/secrets |
| Double outbound HTTP submission | **OPEN** | orchestration; not solved by inbound dedupe |
| Client fake success | **MITIGATED BY DESIGN** | C12 service-only finalization remains |
| Chargeback mutates history | **NOT APPLICABLE** | C09 overlay; C11 authenticates only |

## Raw-body requirement (frozen architecture)

```text
1. Capture exact raw request bytes (or provider-required representation)
2. Verify provider signature against that representation
3. Only then parse / normalize / classify
```

Provider-specific exceptions must be documented in the verifier task — not invented here.

## Secret boundary

```text
Provider secrets: server/edge secret store only
Not in Expo app / client env / public DB / logs
Staging secrets ≠ production secrets
Rotation considered at implementation
```

## Readiness

| Flag | Verdict |
|------|---------|
| `C11_D1_PASS` | **YES** (design) |
| `PROVIDER_NEUTRAL_C11_SCHEMA_DESIGN_READY` | **YES** |
| `PROVIDER_SPECIFIC_VERIFIER_READY` | **NO** |
| `C11_SCHEMA_CANDIDATE_EXISTS` | **NO** |
| `C11_SCHEMA_APPLIED` | **NO** |
| `PSP_INTEGRATED` | **NO** |
| `LIVE_MONEY_READY` | **NO** |
