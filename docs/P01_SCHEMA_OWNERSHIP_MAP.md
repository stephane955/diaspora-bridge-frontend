# P01 Schema Ownership Map

> **HISTORICAL — P01 POINT-IN-TIME SNAPSHOT**  
> **DO NOT USE FOR CURRENT SCHEMA STATE.**  
> Rows marked C05/C06 FUTURE described P01-reset ownership. After later applies: `escrow_*` owned by C05 `20260902183828`; `payments` owned by C06 `20260902191944`.

One authoritative source per active object after P01.

| Object | Owner migration | Notes |
|--------|-----------------|-------|
| `ledger_accounts`, `ledger_journals`, `ledger_lines`, `ledger_posted_events` | Phase 1 (`20260813`) | Cash authority when funded |
| `ledger_post_journal`, posting helpers | Phase 3A | No outbound path yet |
| `platform_currencies`, `amount_minor` columns, fee helpers | Phase 5 | Scaffolding only |
| `platform_admins`, `has_admin_role`, profile privacy, observer split | P00 (`20260902122609`) | Security baseline |
| `profiles`, `projects`, `milestones`, `project_observers`, stubs | Bootstrap (`20260812000000`) | Prerequisite |
| `project_applications`, `messages`, `notifications`, `reviews`, … | P01 (`20260902140000`) | App structural |
| `transactions`, `withdrawals` | Bootstrap + P00 freeze | LEGACY — non-authoritative |
| `payments` | C06 FUTURE | Must not exist after P01 reset |
| `escrow_funder_approvals` | C05 FUTURE | Must not exist after P01 reset |
| `rpc_release_milestone` | C07 FUTURE | Must not exist after P01 reset |

## Functions

| Function | Owner | PUBLIC EXECUTE |
|----------|-------|----------------|
| `ledger_post_journal` | Phase 3A | service_role only |
| `ledger_healthcheck` | P00 | service_role only |
| `rpc_get_user_available_balance` | P00 | authenticated |
| `has_admin_role` | P00 | authenticated |
| `user_can_read_project` / `user_can_write_project` | P00 | authenticated |
| `get_provider_stats` | P01 | authenticated |
| `trigger_dispute` | P01 | authenticated |
| `release_milestone` | **NONE** | must be absent |
