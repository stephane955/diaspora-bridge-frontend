# Active migrations

Files in this directory are the **only** migrations executed during `supabase db reset` and forward staging/production deploys (when authorized).

## Current active chain (post-P01)

```text
20260812000000  p01_minimal_bootstrap     — core prerequisite tables
20260813        phase1_ledger             — ledger schema
20260826100000  phase3a_ledger_posting    — posting RPC
20260902100000  phase5_canonical_money    — amount_minor scaffolding
20260902122609  p00_security_lockdown     — security freeze (staging applied identity)
20260902140000  p01_core_app_schema       — app structural schema
```

## Version identity note

Staging records P00 as `20260902122609` (applied via MCP). Local file uses the same version prefix to match applied history. Do not create a second P00 migration.

## Not in active path

| Location | Purpose |
|----------|---------|
| `supabase/legacy/` | Historical reference SQL — **never auto-apply** |
| `supabase/future_migrations/` | C05/C06 Phase 3B — **not in reset** |
| `supabase/staging/` | Staging bootstrap reference (superseded by `20260812000000`) |

## Adding migrations

1. Use timestamp `YYYYMMDDHHMMSS_description.sql`
2. Never edit already-applied migration files in place
3. Additive only for staging/production
4. Run `supabase/tests/p01_schema_contract.sql` after reset
5. Regenerate `database.types.ts` from staging

## Production

**Forbidden** without explicit authorization. Development targets staging via `EXPO_PUBLIC_*`.

## C05/C06 reintroduction

When Phase 3B is authorized, copy from `future_migrations/`, re-review against current schema, create **new** timestamped files here — do not restore old filenames blindly.
