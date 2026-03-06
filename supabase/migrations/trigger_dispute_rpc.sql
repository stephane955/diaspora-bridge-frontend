-- trigger_dispute RPC: Lock project state during a disagreement and alert platform admins.
-- Call from frontend: supabase.rpc('trigger_dispute', { project_id: id })

-- Projects.status: pending | in_progress | completed | escrow_funded | disputed

-- Optional: platform admins (user_ids who receive dispute alerts). If missing, we notify by role.
-- CREATE TABLE IF NOT EXISTS public.platform_admins (user_id uuid PRIMARY KEY REFERENCES auth.users(id));
-- Here we use profiles.role = 'admin' to find admins; add that column if needed.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role text DEFAULT 'user';

CREATE OR REPLACE FUNCTION public.trigger_dispute(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project public.projects%ROWTYPE;
  v_admin_id uuid;
  v_count int := 0;
BEGIN
  SELECT * INTO v_project FROM public.projects WHERE id = p_project_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project not found';
  END IF;

  IF v_project.status = 'disputed' THEN
    RETURN jsonb_build_object('ok', true, 'already_disputed', true);
  END IF;

  UPDATE public.projects
  SET status = 'disputed'
  WHERE id = p_project_id;

  FOR v_admin_id IN
    SELECT id FROM public.profiles WHERE role = 'admin'
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type, is_read, project_id, link, route)
    VALUES (
      v_admin_id,
      'Project dispute opened',
      'Project "' || COALESCE(v_project.title, p_project_id::text) || '" has been marked as disputed and is locked.',
      'project_disputed',
      false,
      p_project_id,
      '/admin/disputes?project=' || p_project_id,
      'admin/disputes'
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'status', 'disputed', 'admins_notified', v_count);
END;
$$;

-- Restrict project updates when status = 'disputed' (only service role or RPC can change)
DROP POLICY IF EXISTS "projects_update" ON public.projects;
CREATE POLICY "projects_update" ON public.projects
  FOR UPDATE USING (
    (owner_id = auth.uid() OR assigned_provider_id = auth.uid())
    AND (status IS NULL OR status IS DISTINCT FROM 'disputed')
  );

COMMENT ON FUNCTION public.trigger_dispute IS 'Locks project: sets status to disputed, notifies admins (profiles.role=admin). RLS blocks further updates by client/provider until resolved.';
