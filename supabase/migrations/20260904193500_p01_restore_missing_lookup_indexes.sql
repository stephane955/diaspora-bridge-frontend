-- =============================================================================
-- P01 restore missing lookup indexes (additive repair)
-- =============================================================================
-- Restores six migration-owned non-unique lookup indexes from
-- 20260902140000_p01_core_app_schema.sql that were absent on staging despite
-- P01 being recorded in schema_migrations (post-C12 index reconciliation).
--
-- Scope: CREATE INDEX IF NOT EXISTS only. No table/column/constraint/RLS/
-- financial function/data changes. Historical P01 remains untouched.
--
-- Idempotent on clean local reset: P01 already creates these six indexes;
-- this migration no-ops safely via IF NOT EXISTS.
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_project_applications_project
  ON public.project_applications(project_id);

CREATE INDEX IF NOT EXISTS idx_project_applications_provider
  ON public.project_applications(provider_id);

CREATE INDEX IF NOT EXISTS idx_messages_project
  ON public.messages(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user
  ON public.notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_project_updates_project
  ON public.project_updates(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_project_expenses_project
  ON public.project_expenses(project_id);
