# DiasporaBridge — Document Status Index

```yaml
generated: 2026-09-02
last_verified: 2026-09-02
repo_commit: be1af5a0333a0b75867fdc60c6f8bb7670558e54
authority_hierarchy:
  1: "Actual repo + staging schema (CURRENT_STATE.yaml)"
  2: "DECISION_REGISTER.md"
  3: "04_MASTER_RECONCILIATION_AND_EXECUTION_PLAN.md"
  4: "01_CANONICAL_MODELS.md + 02_BUILD_ROADMAP.md"
  5: "Phase/system reports (PHASE5_REPORT, FINANCIAL_FIELD_INVENTORY, …)"
  6: "Historical snapshots (marked below)"
  7: "00_PLATFORM_BLUEPRINT.md vision/gap analysis"
status_legend:
  CURRENT: "Accurate for planning; verify dates"
  PARTIALLY_STALE: "Mostly valid; specific sections wrong"
  HISTORICAL: "Point-in-time snapshot; do not use for current state"
  SUPERSEDED: "Replaced by newer authoritative doc"
```

---

## Primary architecture documents

| File | Status | Notes | Action |
|------|--------|-------|--------|
| `docs/04_MASTER_RECONCILIATION_AND_EXECUTION_PLAN.md` | **CURRENT** | New authoritative plan (this audit) | Maintain |
| `docs/CURRENT_STATE.yaml` | **CURRENT** | Machine-readable state | Update on each verified change |
| `docs/DECISION_REGISTER.md` | **CURRENT** | Frozen + open decisions | Update when decisions freeze |
| `docs/00_PLATFORM_BLUEPRINT.md` | **PARTIALLY_STALE** | Gap analysis valid; line refs and staging state drift | Add header; use for product gaps not schema truth |
| `docs/01_CANONICAL_MODELS.md` | **CURRENT** | platform_currencies + truncate fee rounding reconciled P01.9 | Maintain; C03/C04 not implemented |
| `docs/02_BUILD_ROADMAP.md` | **PARTIALLY_STALE** | Phase IDs ambiguous (C18, Phase 39) | Crosswalk to R##/P##/C## namespaces in §04_MASTER |
| `docs/03_RISK_REGISTER.md` | **CURRENT** | S1–S13 updated with P00 mitigation status | Maintain |

---

## Phase 5 / money documents

| File | Status | Notes | Action |
|------|--------|-------|--------|
| `docs/PHASE5_REPORT.md` | **CURRENT** (historical phase report) | Next-step pointer corrected to P01 | Maintain |
| `docs/CANONICAL_MONEY_MODEL.md` | **CURRENT** | Matches applied truncate fee rule | Keep |
| `docs/FINANCIAL_FIELD_INVENTORY.md` | **PARTIALLY_STALE** | Phase5 apply blocker resolved; remaining C07/C08/C14 sections future | Maintain future sections only |
| `docs/MILESTONE_AMOUNT_DEPENDENCY_MAP.md` | **HISTORICAL** | W1–W3, R1–R3 describe old release_milestone path | MARK HISTORICAL; superseded by 04_MASTER §J |
| `docs/MONEY_DATA_QUALITY_REPORT.md` | **CURRENT** (post-Phase-5/post-P00 staging) | Executive summary and Phase 5 rows updated | Maintain after schema changes |
| `docs/LEGACY_MONEY_COMPATIBILITY.md` | **CURRENT** | Compatibility rules still valid | Keep |

---

## Other repo documents

| File | Status | Notes | Action |
|------|--------|-------|--------|
| `REMEDIATION_INVENTORY.md` | **PARTIALLY_STALE** | Pre-Phase-5 staging snapshot; ledger counts still valid | MARK as audit input; link to CURRENT_STATE.yaml |
| `docs/C05_MULTISIG_THREAT_MODEL.md` | **CURRENT** | Decision #31 request-scoped threats | Maintain |
| `docs/C05_C06_COMPATIBILITY_REVIEW.md` | **CURRENT** | C05+C06 both applied schema | Maintain |
| `docs/C06_PAYMENT_FUNDING_THREAT_MODEL.md` | **CURRENT** | Provider-scoped identity mitigated; live blockers OPEN | Maintain |
| `supabase/tests/C05_READINESS_CONTRACT.md` | **HISTORICAL REVIEW INPUT** | Pre-apply checklist; C05 now applied | Audit trail |
| `supabase/tests/C06_READINESS_CONTRACT.md` | **HISTORICAL REVIEW INPUT** | Pre-apply checklist; C06 now applied | Audit trail |
| `supabase/tests/c05_schema_contract.sql` | **CURRENT** | Post-C05 CI gate | Maintain |
| `supabase/tests/c05_phase3b0_multisig.sql` | **CURRENT** | Request-scoped security tests | Maintain |
| `supabase/tests/c06_schema_contract.sql` | **CURRENT** | Active-chain CI gate | Maintain |
| `supabase/tests/c06_phase3b_funding.sql` | **CURRENT** | Active-chain disposable funding tests | Maintain |
| `supabase/tests/PHASE3B_EDGE_CONTRACT.md` | **NOT_FOUND** | Indexed historically; file absent on disk | Prefer C05/C06 contracts above |
| `README.md` | **UNKNOWN** | Not audited line-by-line | LOW priority |

---

## Stale statement log (verified 2026-09-02)

| File | Section | Old claim | Current fact | Evidence | Action |
|------|---------|-----------|--------------|----------|--------|
| `MILESTONE_AMOUNT_DEPENDENCY_MAP.md` | §3 W3 | `release_milestone` from `project/[id].tsx` | **HISTORICAL (pre-P00):** direct `milestones.update(paid)` + `transactions.insert`. **CURRENT:** release fail-closed; `rpc_release_milestone` ABSENT; transactions client writes DENIED (P00). | P00 + `handleReleaseFunds` + CURRENT_STATE | **KEEP as historical map; disposition CURRENT ≠ HISTORICAL** |
| `MILESTONE_AMOUNT_DEPENDENCY_MAP.md` | §1 table | `amount_minor` absent until Phase 5 apply | **Present on staging milestones** | staging `information_schema` | **RESOLVED** |
| `MONEY_DATA_QUALITY_REPORT.md` | Executive | Phase 5 conflict detection not applied | `platform_milestone_amounts_conflict()` **exists on staging** | MCP `list_migrations` | **RESOLVED** |
| `FINANCIAL_FIELD_INVENTORY.md` | §3 | Apply Phase 5 to staging | **Already applied** 20260902100000 | staging migration history | **RESOLVED** (P01.9) |
| `01_CANONICAL_MODELS.md` | §1.3 | Round half up on fees | Truncate; platform_currencies | P01.9 doc fix | **RESOLVED** (P01.9) |
| `hireProvider` docs | Various | Writes amount_cfa | **amount_minor only** | lib/hireProvider.ts | **RESOLVED** (P01.9/P01.10) |
| `03_RISK_REGISTER.md` | S2 | `release_milestone` client path | P00 fail-closed release; RPC absent | P00 + staging | **RESOLVED** (historical risk) |
| `PHASE5_REPORT.md` | Title | "COMPLETE" full migration | Scaffolding only; C14 remains | CURRENT_STATE | **KEEP title caveat** |

---

## Recommended metadata header (for active docs)

```yaml
generated: YYYY-MM-DD
last_verified: YYYY-MM-DD
repo_commit: <sha>
staging_ref: tvorurbmzrpwvxwztpix
production_ref: xtyqcdktwxzuezarnqhz
production_touched: false
status: CURRENT | PARTIALLY_STALE | HISTORICAL
authority: <path>
supersedes: <paths>
superseded_by: <path>
```
