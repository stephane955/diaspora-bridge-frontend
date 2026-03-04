-- Row Level Security (RLS) & role-based access
-- Run in Supabase SQL Editor. Ensures clients see only their projects, providers only assigned projects, observers view-only.

-- Helper: user can access project as owner, provider, or observer
CREATE OR REPLACE FUNCTION public.user_can_access_project(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = p_project_id
      AND (p.owner_id = auth.uid() OR p.assigned_provider_id = auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM public.project_observers o
    WHERE o.project_id = p_project_id AND o.user_id = auth.uid()
  );
$$;

-- Projects: owner (client), assigned provider, or observer can read; only owner can insert; owner/provider can update
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "projects_select" ON projects;
CREATE POLICY "projects_select" ON projects
  FOR SELECT USING (
    owner_id = auth.uid()
    OR assigned_provider_id = auth.uid()
    OR id IN (SELECT project_observers.project_id FROM project_observers WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "projects_insert" ON projects;
CREATE POLICY "projects_insert" ON projects
  FOR INSERT WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "projects_update" ON projects;
CREATE POLICY "projects_update" ON projects
  FOR UPDATE USING (
    owner_id = auth.uid() OR assigned_provider_id = auth.uid()
  );

DROP POLICY IF EXISTS "projects_delete" ON projects;
CREATE POLICY "projects_delete" ON projects
  FOR DELETE USING (owner_id = auth.uid());

-- Messages: only participants of the project can read/insert
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_select" ON messages;
CREATE POLICY "messages_select" ON messages
  FOR SELECT USING (public.user_can_access_project(project_id));

DROP POLICY IF EXISTS "messages_insert" ON messages;
CREATE POLICY "messages_insert" ON messages
  FOR INSERT WITH CHECK (public.user_can_access_project(project_id) AND sender_id = auth.uid());

DROP POLICY IF EXISTS "messages_update" ON messages;
CREATE POLICY "messages_update" ON messages
  FOR UPDATE USING (public.user_can_access_project(project_id));

-- Milestones: same as project access
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "milestones_select" ON milestones;
DROP POLICY IF EXISTS "milestones_insert" ON milestones;
DROP POLICY IF EXISTS "milestones_update" ON milestones;
CREATE POLICY "milestones_select" ON milestones FOR SELECT USING (public.user_can_access_project(project_id));
CREATE POLICY "milestones_insert" ON milestones FOR INSERT WITH CHECK (public.user_can_access_project(project_id));
CREATE POLICY "milestones_update" ON milestones FOR UPDATE USING (public.user_can_access_project(project_id));

-- project_expenses
ALTER TABLE project_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_expenses_select" ON project_expenses;
CREATE POLICY "project_expenses_select" ON project_expenses FOR SELECT USING (public.user_can_access_project(project_id));
DROP POLICY IF EXISTS "project_expenses_insert" ON project_expenses;
CREATE POLICY "project_expenses_insert" ON project_expenses FOR INSERT WITH CHECK (public.user_can_access_project(project_id));
DROP POLICY IF EXISTS "project_expenses_update" ON project_expenses;
CREATE POLICY "project_expenses_update" ON project_expenses FOR UPDATE USING (public.user_can_access_project(project_id));

-- project_updates
ALTER TABLE project_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_updates_select" ON project_updates;
CREATE POLICY "project_updates_select" ON project_updates FOR SELECT USING (public.user_can_access_project(project_id));
DROP POLICY IF EXISTS "project_updates_insert" ON project_updates;
CREATE POLICY "project_updates_insert" ON project_updates FOR INSERT WITH CHECK (public.user_can_access_project(project_id));

-- project_applications: provider sees own applications; client (owner) sees applications for their projects
ALTER TABLE project_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_applications_select" ON project_applications;
CREATE POLICY "project_applications_select" ON project_applications FOR SELECT USING (
  provider_id = auth.uid()
  OR project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid())
);
DROP POLICY IF EXISTS "project_applications_insert" ON project_applications;
CREATE POLICY "project_applications_insert" ON project_applications FOR INSERT WITH CHECK (provider_id = auth.uid());
DROP POLICY IF EXISTS "project_applications_update" ON project_applications;
CREATE POLICY "project_applications_update" ON project_applications FOR UPDATE USING (
  provider_id = auth.uid() OR project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid())
);

-- notifications: own only
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select" ON notifications;
CREATE POLICY "notifications_select" ON notifications FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "notifications_update" ON notifications;
CREATE POLICY "notifications_update" ON notifications FOR UPDATE USING (user_id = auth.uid());

-- profiles: read all (for display names/avatars), update own
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "profiles_update" ON profiles;
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (id = auth.uid());

-- reviews: read by project access; insert by project owner
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reviews_select" ON reviews;
CREATE POLICY "reviews_select" ON reviews FOR SELECT USING (public.user_can_access_project(project_id));
DROP POLICY IF EXISTS "reviews_insert" ON reviews;
CREATE POLICY "reviews_insert" ON reviews FOR INSERT WITH CHECK (
  project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid())
);

-- project_observers: already in apex schema; ensure RLS
DROP POLICY IF EXISTS "Observers readable by project owner and observers" ON project_observers;
DROP POLICY IF EXISTS "Project owner can insert observers" ON project_observers;
CREATE POLICY "observers_select" ON project_observers FOR SELECT USING (
  user_id = auth.uid() OR project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid())
);
CREATE POLICY "observers_insert" ON project_observers FOR INSERT WITH CHECK (
  project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid())
);
CREATE POLICY "observers_update" ON project_observers FOR UPDATE USING (
  user_id = auth.uid() OR project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid())
);
