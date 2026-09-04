# DiasporaBridge — Document Status Index

```yaml
generated: 2026-09-02
last_verified: 2026-09-04
repo_commit: fbea0b12c18c1936b34ffe00a5db2a29719c66d7
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
| `docs/04_MASTER_RECONCILIATION_AND_EXECUTION_PLAN.md` | **CURRENT** | Post P01 index repair (12 migrations / 31 tables / 51 policies / 91 indexes) | Maintain |
| `docs/CURRENT_STATE.yaml` | **CURRENT** | Machine-readable state; post_c12_index_reconciliation repaired | Update on each verified change |
| `supabase/migrations/20260904193500_p01_restore_missing_lookup_indexes.sql` | **CURRENT** | Additive repair of 6 P01 lookup indexes; historical P01 untouched | Do not redesign without review |
| `docs/DECISION_REGISTER.md` | **CURRENT** | #11/#32 FROZEN (C03-D1); #13 BLOCKED ON LEGAL | Maintain |
| `docs/C05_MULTISIG_THREAT_MODEL.md` | **CURRENT** | Post-apply header; Decision #31 | Maintain |
| `docs/C03_FX_CORRIDOR_THREAT_MODEL.md` | **CURRENT** | C03 APPLIED STAGING — schema only | Maintain |
| `docs/C03_C05_C06_COMPATIBILITY_REVIEW.md` | **CURRENT** | R3.1 lock order; C03 staging APPLIED | Maintain |
| `docs/C12_PAYMENT_ATTEMPT_THREAT_MODEL.md` | **CURRENT** | C12 APPLIED STAGING SCHEMA ONLY | Maintain until C11/PSP |
| `docs/C12_C03_C05_C06_COMPATIBILITY_REVIEW.md` | **CURRENT** | C12 applied staging schema; dual-era C03 | Maintain until C11/PSP |
| `docs/C11_PROVIDER_EVENT_THREAT_MODEL.md` | **CURRENT** | C11-D1 design only; no SQL | Maintain until C11-R |
| `docs/C11_C06_C12_EVENT_COMPATIBILITY_REVIEW.md` | **CURRENT** | C11-D1 design; reuse ledger_posted_events analysis | Maintain until C11-R |
| `supabase/tests/C03_READINESS_CONTRACT.md` | **CURRENT** | Post-APPLY regression checklist | Maintain |
| `supabase/migrations/20260903175839_c03_fx_quotes_cross_border.sql` | **CURRENT** | C03 APPLIED STAGING — schema only | Do not redesign without review |
| `docs/P01_MIGRATION_INVENTORY.md` | **HISTORICAL P01 SNAPSHOT** | 6/7-migration counts | Do not use as current state |
| `docs/P01_MIGRATION_CROSSWALK.md` | **HISTORICAL P01 SNAPSHOT** | C05/C06 “DEFERRED” is historical | Do not use as current state |
| `docs/P01_SCHEMA_OWNERSHIP_MAP.md` | **HISTORICAL P01 SNAPSHOT** | C05/C06 “FUTURE” is historical | Do not use as current state |
| `docs/00_PLATFORM_BLUEPRINT.md` | **PARTIALLY_STALE** | Gap analysis valid; line refs and staging state drift | Add header; use for product gaps not schema truth |
| `docs/01_CANONICAL_MODELS.md` | **PARTIALLY_STALE** | Designs valid; apply-state + §1.3 FX sketch superseded by C03-D1/R2 | Prefer CURRENT_STATE + C03 compat docs |
| `docs/CANONICAL_MONEY_MODEL.md` | **CURRENT** (amounts) / **PARTIALLY_STALE** (insurance naming) | C06 gross; Decision #21 OPEN | Maintain |
| `docs/02_BUILD_ROADMAP.md` | **PARTIALLY_STALE** | Phase IDs ambiguous (C18, Phase 39) | Crosswalk to R##/P##/C## namespaces in §04_MASTER |
| `docs/03_RISK_REGISTER.md` | **CURRENT** | S1–S13 updated with P00 mitigation status | Maintain |

---

## Phase 5 / money documents

| File | Status | Notes | Action |
|------|--------|-------|--------|
| `docs/PHASE5_REPORT.md` | **CURRENT** (historical phase report) | Next-step pointer corrected to P01 | Maintain |
| `docs/CANONICAL_MONEY_MODEL.md` | **CURRENT** (amounts) / **PARTIALLY_STALE** (insurance naming / old Phase3B apply note) | C06 gross; Decision #21 OPEN | Prefer CURRENT_STATE for apply state |
| `docs/FINANCIAL_FIELD_INVENTORY.md` | **PARTIALLY_STALE** | Phase5 apply blocker resolved; remaining C07/C08/C14 sections future | Maintain future sections only |
| `docs/MILESTONE_AMOUNT_DEPENDENCY_MAP.md` | **HISTORICAL** | W1–W3, R1–R3 describe old release_milestone path | MARK HISTORICAL; superseded by 04_MASTER §J |
| `docs/MONEY_DATA_QUALITY_REPORT.md` | **CURRENT** (post-Phase-5/post-P00 staging) | Executive summary and Phase 5 rows updated | Maintain after schema changes |
| `docs/LEGACY_MONEY_COMPATIBILITY.md` | **CURRENT** | Compatibility rules still valid | Keep |

---

## Other repo documents

| File | Status | Notes | Action |
|------|--------|-------|--------|
| `REMEDIATION_INVENTORY.md` | **PARTIALLY_STALE** | Pre-Phase-5 staging snapshot; ledger counts still valid | MARK as audit input; link to CURRENT_STATE.yaml |
| `docs/C05_MULTISIG_THREAT_MODEL.md` | **CURRENT** | Post-apply header; Decision #31 | Maintain |
| `docs/C05_C06_COMPATIBILITY_REVIEW.md` | **CURRENT** | C05+C06 both applied schema | Maintain |
| `docs/C06_PAYMENT_FUNDING_THREAT_MODEL.md` | **CURRENT** | Applied schema; live blockers OPEN | Maintain |
| `docs/C03_FX_CORRIDOR_THREAT_MODEL.md` | **CURRENT** | C03 APPLIED STAGING — schema only | Maintain |
| `docs/C03_C05_C06_COMPATIBILITY_REVIEW.md` | **CURRENT** | R3.1 lock order; C03 staging APPLIED | Maintain |
| `docs/C12_PAYMENT_ATTEMPT_THREAT_MODEL.md` | **CURRENT** | C12 APPLIED STAGING SCHEMA ONLY | Maintain until C11/PSP |
| `docs/C12_C03_C05_C06_COMPATIBILITY_REVIEW.md` | **CURRENT** | C12 applied staging schema; dual-era C03 | Maintain until C11/PSP |
| `docs/C11_PROVIDER_EVENT_THREAT_MODEL.md` | **CURRENT** | C11-D1 design only; no SQL | Maintain until C11-R |
| `docs/C11_C06_C12_EVENT_COMPATIBILITY_REVIEW.md` | **CURRENT** | C11-D1 design; reuse ledger_posted_events analysis | Maintain until C11-R |
| `supabase/tests/C03_READINESS_CONTRACT.md` | **CURRENT** | Post-APPLY regression checklist | Maintain |
| `supabase/tests/c03_fx_quotes.sql` | **CURRENT** | Active-chain C03 regression | Maintain |
| `supabase/migrations/20260903175839_c03_fx_quotes_cross_border.sql` | **CURRENT** | C03 APPLIED STAGING — schema only | Authoritative; do not dual-maintain future copy |
| `docs/P01_MIGRATION_INVENTORY.md` | **HISTORICAL P01 SNAPSHOT** | 6/7-migration counts | Do not use as current state |
| `docs/P01_MIGRATION_CROSSWALK.md` | **HISTORICAL P01 SNAPSHOT** | C05/C06 “DEFERRED” is historical | Do not use as current state |
| `docs/P01_SCHEMA_OWNERSHIP_MAP.md` | **HISTORICAL P01 SNAPSHOT** | C05/C06 “FUTURE” is historical | Do not use as current state |
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
