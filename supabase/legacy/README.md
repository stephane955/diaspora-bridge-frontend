# Legacy SQL — reference only

Files in this directory are **historical reference**. They must **not** be applied directly during `supabase db reset` or staging deploy.

## Why archived

These untimestamped or superseded migrations contained:

- Permissive RLS (`USING (true)` on profiles)
- Legacy financial triggers and `release_milestone(p_amount)` RPC
- Duplicate/competing table definitions
- Observer write access on financial/workflow tables

## Canonical replacements

See:

- `docs/P01_MIGRATION_CROSSWALK.md` — old file → new owner mapping
- `docs/P01_SCHEMA_OWNERSHIP_MAP.md` — single authority per object
- `supabase/migrations/` — active reset chain only

## Do not apply

Running these files against staging or production would reintroduce pre-P00 security defects.
