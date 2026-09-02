-- Task 3: Spatial Media — 360° panoramic image support for project_media.
-- Storage bucket project_media: use object metadata key "is_panoramic_360" (boolean) on upload.
-- This migration adds a table to query 360° media by project (optional; metadata can be read from storage API).

CREATE TABLE IF NOT EXISTS public.project_media_meta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  is_panoramic_360 boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(project_id, storage_path)
);

CREATE INDEX IF NOT EXISTS idx_project_media_meta_project ON public.project_media_meta(project_id);
CREATE INDEX IF NOT EXISTS idx_project_media_meta_panoramic ON public.project_media_meta(project_id) WHERE is_panoramic_360 = true;

ALTER TABLE public.project_media_meta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_media_meta_select" ON public.project_media_meta FOR SELECT USING (public.user_can_access_project(project_id));
CREATE POLICY "project_media_meta_insert" ON public.project_media_meta FOR INSERT WITH CHECK (public.user_can_access_project(project_id));
CREATE POLICY "project_media_meta_update" ON public.project_media_meta FOR UPDATE USING (public.user_can_access_project(project_id));

COMMENT ON TABLE public.project_media_meta IS 'Metadata for project_media storage objects; is_panoramic_360 prepares UI for interactive spatial site views.';
COMMENT ON COLUMN public.project_media_meta.storage_path IS 'Path within project_media bucket (e.g. project_id/filename.jpg).';
