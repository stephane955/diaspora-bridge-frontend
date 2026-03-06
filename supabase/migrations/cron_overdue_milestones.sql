-- Cron: Daily job to notify Client and Provider when a milestone is overdue.
-- Requires pg_cron extension (enable in Supabase Dashboard: Database > Extensions > pg_cron).
-- Run this migration after apex_enterprise_schema (milestones, projects, notifications exist).

-- ========== 1. Add due_date to milestones if not present ==========
ALTER TABLE public.milestones
  ADD COLUMN IF NOT EXISTS due_date timestamptz;

COMMENT ON COLUMN public.milestones.due_date IS 'Optional due date; used by cron to flag overdue milestones.';

-- ========== 2. Enable pg_cron (may require Supabase Dashboard enablement first) ==========
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ========== 3. Function: insert overdue-milestone notifications ==========
CREATE OR REPLACE FUNCTION public.notify_overdue_milestones()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_project_title text;
  v_milestone_title text;
BEGIN
  FOR r IN
    SELECT m.id AS milestone_id, m.project_id, m.title AS milestone_title, m.due_date,
           p.owner_id, p.assigned_provider_id, p.title AS project_title
    FROM milestones m
    JOIN projects p ON p.id = m.project_id
    WHERE m.due_date IS NOT NULL
      AND m.due_date < now()
      AND m.status = 'locked'
  LOOP
    v_project_title := COALESCE(r.project_title, 'Project');
    v_milestone_title := COALESCE(r.milestone_title, 'Milestone');

    IF r.owner_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, title, message, type, is_read, project_id, link, route)
      VALUES (
        r.owner_id,
        'Milestone overdue',
        'Milestone "' || v_milestone_title || '" for ' || v_project_title || ' is past due.',
        'milestone_overdue',
        false,
        r.project_id,
        '/diaspora/project/' || r.project_id,
        'diaspora/project/[id]'
      );
    END IF;

    IF r.assigned_provider_id IS NOT NULL AND r.assigned_provider_id IS DISTINCT FROM r.owner_id THEN
      INSERT INTO notifications (user_id, title, message, type, is_read, project_id, link, route)
      VALUES (
        r.assigned_provider_id,
        'Milestone overdue',
        'Milestone "' || v_milestone_title || '" for ' || v_project_title || ' is past due.',
        'milestone_overdue',
        false,
        r.project_id,
        '/workroom/' || r.project_id,
        'workroom/[id]'
      );
    END IF;
  END LOOP;
END;
$$;

-- ========== 4. Schedule daily run at 00:00 UTC ==========
-- If re-running, manually unschedule first: SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'notify_overdue_milestones_daily';
SELECT cron.schedule(
  'notify_overdue_milestones_daily',
  '0 0 * * *',
  $$SELECT public.notify_overdue_milestones()$$
);

COMMENT ON FUNCTION public.notify_overdue_milestones IS 'Cron: inserts notifications for client and provider when milestone.due_date < now() and status = locked.';
