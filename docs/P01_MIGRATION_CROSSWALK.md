# P01 Migration Crosswalk

Maps legacy SQL files to canonical P01 owners. **Do not apply legacy files directly.**

| OLD FILE | OBJECTS | PROBLEM | NEW AUTHORITATIVE OWNER | CARRIED? |
|----------|---------|---------|-------------------------|----------|
| `staging/000_app_baseline_min.sql` | profiles, projects, milestones, observers, stubs | outside migration history | `20260812000000_p01_minimal_bootstrap.sql` | YES |
| `legacy/rls_and_auth.sql` | RLS policies, user_can_access_project | profiles public; observer writes | P00 + P01 RLS | PARTIAL |
| `legacy/monopoly_ecosystem.sql` | release_milestone, suppliers, carts, advances | client amount RPC; financial semantics | P01 tables; **release_milestone DO NOT RECREATE** | PARTIAL |
| `legacy/apex_enterprise_schema.sql` | contracts, disputes, observers | duplicate observer DDL | P01 core schema | YES |
| `legacy/trigger_dispute_rpc.sql` | trigger_dispute | profiles.role=admin | P01 trigger_dispute → platform_admins | YES |
| `legacy/compliance_aml_escrow_insurance.sql` | escrow_funder_approvals | future financial | C05 future_migrations | DEFERRED |
| `future_migrations/c06_phase3b_escrow_funding.sql` | payments, funding RPCs | posts ledger | C06 (new timestamp after review) | DEFERRED |
| `legacy/triggers_and_webhooks.sql` | webhook_outbox | ALL USING true | E5 / server-only future | REMOVED |

## release_milestone rule

```text
monopoly_ecosystem.sql → release_milestone(p_amount)
Status: DO NOT RECREATE in active chain
Future: rpc_release_milestone (C07) with 16-step contract
```

## Duplicate models

| Domain | Canonical (P01) | Legacy duplicate | Future |
|--------|-----------------|------------------|--------|
| Disputes | `project_disputes` | `disputes` table refs in app | D04 consolidation |
| Material carts | `project_material_carts` (JSON items) | `project_material_cart_items` in monopoly | D07 handoff |
| Applications | `project_applications` | none in repo DDL | — |
