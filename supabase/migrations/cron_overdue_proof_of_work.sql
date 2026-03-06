-- Cron: Daily job to remind Providers when Proof of Work is overdue by more than 7 days.
-- Requires pg_cron (enable in Supabase Dashboard). Run after cron_overdue_milestones.sql if you use both.

CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.notify_overdue_proof_of_work()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT m.id AS milestone_id, m.project_id, m.title AS milestone_title, m.created_at,
           p.owner_id, p.assigned_provider_id, p.title AS project_title
    FROM milestones m
    JOIN projects p ON p.id = m.project_id
    WHERE m.status = 'locked'
      AND (
        (m.due_date IS NOT NULL AND m.due_date < now() - interval '7 days')
        OR (m.due_date IS NULL AND m.created_at < now() - interval '7 days')
      )
  LOOP
    IF r.assigned_provider_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, title, message, type, is_read, project_id, link, route)
      VALUES (
        r.assigned_provider_id,
        'Proof of work overdue',
        'Milestone "' || COALESCE(r.milestone_title, 'Step') || '" for ' || COALESCE(r.project_title, 'project') || ' is over 7 days overdue. Please submit proof.',
        'proof_overdue',
        false,
        r.project_id,
        '/workroom/' || r.project_id,
        'workroom/[id]'
      );
    END IF;
  END LOOP;
END;
$$;

SELECT cron.schedule(
  'notify_overdue_proof_daily',
  '0 1 * * *',
  $$SELECT public.notify_overdue_proof_of_work()$$
);

COMMENT ON FUNCTION public.notify_overdue_proof_of_work IS 'Cron: notifies provider when milestone is still locked and 7+ days past due or 7+ days since creation.';
