# C05 Multisig Threat Model (Phase 3B.0 funding approvals)

**Generated:** 2026-09-02  
**Updated:** 2026-09-02 (C05-R2 request-scoped freeze — Decision #31)  
**Scope:** Funding approvals only — not release governance (Decision #18 OPEN)  
**Candidate:** `supabase/future_migrations/c05_phase3b0_multisig_approvals.sql`  
**Staging:** C05 objects ABSENT (review only)

Chain:

```text
PROJECT PARTICIPATION
        ≠
FUNDING REQUEST AUTHORIZATION
        ≠
PAYMENT INTENT
        ≠
PSP SETTLEMENT
        ≠
LEDGER POSTING
        ≠
MILESTONE RELEASE
```

Ratings: **BLOCKED** | **MITIGATED** | **OPEN** | **NOT APPLICABLE**

| Threat | Rating | Notes |
|--------|--------|-------|
| Fake approval (random user) | MITIGATED | Approve RPC requires auth.uid() ∈ current funder_ids |
| Approve as another funder | MITIGATED | funder_id derived from auth.uid() only |
| Timestamp spoof (past/future) | MITIGATED | BEFORE trigger forces `approved_at := clock_timestamp()` |
| Client refresh after consume | MITIGATED | Approve/revoke DENY unless status=pending |
| Approval replay beyond scope | **MITIGATED** | UNIQUE(request,funder); amount/requester/project bound on request row |
| Same request ID / different amount | MITIGATED | Create + intent reject scope mismatch |
| Same request ID / different requester | MITIGATED | requested_by = auth.uid() at create; intent requires match |
| Cross-request replay (same project/amount) | MITIGATED | Approvals keyed by funding_request_id |
| Single co-funder bypass | MITIGATED | C06 gates when distinct co-funders **≥ 1** (not > 1) |
| Roster shrink bypass | MITIGATED | Client UPDATE blocked; rpc_set_project_funders add-only |
| Roster add before consume | MITIGATED | Helper re-reads current roster |
| Roster add after consume | MITIGATED | Intent already created; no retroactive invalidate |
| Expired approval | MITIGATED | `approved_at >= now()-72h` at intent create only |
| TOCTOU intent→PSP→ledger | MITIGATED | No approval re-check at `rpc_post_escrow_funding` |
| PSP async capture then refuse | MITIGATED | Ledger path independent of C05 after intent |
| Idempotent retry after consumption | MITIGATED | Payment exists → return same intent without re-approval |
| Concurrent same-ID create | MITIGATED | UNIQUE client_request_id + FOR UPDATE request + unique_violation path |
| Concurrent different-amount | MITIGATED | Immutable request amount + mismatch errors |
| Revocation race before intent | MITIGATED | FOR UPDATE on request; approve/revoke require pending; check inside same txn as consume |
| Direct table mutation | MITIGATED | No INSERT/UPDATE/DELETE grants; RPC-only writes |
| RLS bypass | MITIGATED | RLS ON; SELECT participant-only |
| SECURITY DEFINER misuse | MITIGATED | Fixed search_path; PUBLIC execute revoked |
| Duplicate approval rows | MITIGATED | UNIQUE(funding_request_id, funder_id) |
| Duplicate funder_ids fake quorum | MITIGATED | Distinct non-null set |
| NULL/empty roster | MITIGATED | card=0 → true |
| Misleading signature hash | MITIGATED | Field **removed** (no crypto protocol) |
| Release authority via C05 | NOT APPLICABLE | No coupling |
| Ledger write via C05 | NOT APPLICABLE | No journal calls |

## Apply gate implication

`C05_APPLY_READY = YES` when local C05 + C05/C06 disposable integration PASS and Decision #31 frozen (this document).  
Still do **not** apply to staging in C05-R2 — separate APPLY task.
