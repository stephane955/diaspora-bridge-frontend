-- Performance indexes: Avoid RLS "trap" (full table scans) when using user_can_access_project()
-- and other policy helpers. Index all foreign keys and columns used in policy predicates.
-- Run after rls_and_auth and apex_enterprise_schema.

-- ========== Projects: owner (client) and assigned provider ==========
-- RLS policies use owner_id and assigned_provider_id; index for fast lookups.
CREATE INDEX IF NOT EXISTS idx_projects_owner_id
  ON public.projects (owner_id);

CREATE INDEX IF NOT EXISTS idx_projects_assigned_provider_id
  ON public.projects (assigned_provider_id);

-- ========== project_id on child tables (used in user_can_access_project via JOINs) ==========
CREATE INDEX IF NOT EXISTS idx_messages_project_id
  ON public.messages (project_id);

CREATE INDEX IF NOT EXISTS idx_milestones_project_id
  ON public.milestones (project_id);

CREATE INDEX IF NOT EXISTS idx_project_expenses_project_id
  ON public.project_expenses (project_id);

CREATE INDEX IF NOT EXISTS idx_project_updates_project_id
  ON public.project_updates (project_id);

-- ========== project_observers: user_id for "can I access this project?" ==========
CREATE INDEX IF NOT EXISTS idx_project_observers_user_id
  ON public.project_observers (user_id);

-- project_observers.project_id already indexed in apex_enterprise_schema (idx_project_observers_project)

-- ========== Optional: composite for common filters ==========
CREATE INDEX IF NOT EXISTS idx_projects_owner_status
  ON public.projects (owner_id, status);

CREATE INDEX IF NOT EXISTS idx_projects_provider_status
  ON public.projects (assigned_provider_id, status);

CREATE INDEX IF NOT EXISTS idx_milestones_project_status
  ON public.milestones (project_id, status);

COMMENT ON INDEX idx_projects_owner_id IS 'RLS: fast project list for client (owner)';
COMMENT ON INDEX idx_projects_assigned_provider_id IS 'RLS: fast project list for provider';
COMMENT ON INDEX idx_project_observers_user_id IS 'RLS: fast observer project access check';
