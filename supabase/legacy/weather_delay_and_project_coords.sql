-- Task 3: Predictive Delay — project coordinates for weather API; project_updates/messages used by cron.
-- Ensure projects can store location for weather checks. Support system messages.

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric;

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS message_type text DEFAULT 'user';

COMMENT ON COLUMN public.projects.latitude IS 'Project site latitude for weather API (predictive delay cron).';
COMMENT ON COLUMN public.projects.longitude IS 'Project site longitude for weather API (predictive delay cron).';
COMMENT ON COLUMN public.messages.message_type IS 'user | system (e.g. weather delay, system alerts).';
