# C05 ↔ C06 Compatibility Review

**Updated:** 2026-09-02 (C06 SCHEMA APPLIED staging)  
**C05 staging:** `20260902183828`  
**C06 staging:** `20260902191944`  
**Binding verified:** YES  
**Gross funding:** YES  
**C05 recheck after intent:** NO  
**Live money ready:** NO

## Contract

```text
escrow_funding_requests.id = payments.client_request_id
```

First intent: lock pending request → exact project/requester/amount → N-of-N if co-funders ≥ 1 → insert payment → consume request.  
Retry: return same payment without C05 re-check.  
`rpc_post_escrow_funding`: no C05 re-check; amount from payment row; gross → project_escrow.

## PSP identity (C06 APPLY gate)

| Identity | Method |
|----------|--------|
| Webhook events | `ledger_canonical_psp_event_id(provider, raw)` → `provider:raw` in UNIQUE `psp_event_id` |
| Payment refs | `UNIQUE(psp_provider, psp_ref)` |

## Compatibility verdict

**YES** — both applied on staging. App-wired false. Operational false. Live money NO.
