-- Storage buckets: kyc_documents (private), project_media (restricted), avatars (public)
-- Run in Supabase SQL Editor. Create buckets via dashboard or API if not exists.

-- Create buckets (run in SQL Editor; or create via Dashboard: Storage > New bucket)
-- kyc_documents: private. project_media: private. avatars: public.
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('kyc_documents', 'kyc_documents', false),
  ('project_media', 'project_media', false),
  ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- RLS for storage.objects (policies are per bucket via bucket_id)

-- kyc_documents: private — only the user (path prefix = auth.uid()) and admins
DROP POLICY IF EXISTS "kyc_select_own" ON storage.objects;
CREATE POLICY "kyc_select_own" ON storage.objects FOR SELECT
  TO authenticated USING (bucket_id = 'kyc_documents' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "kyc_insert_own" ON storage.objects;
CREATE POLICY "kyc_insert_own" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'kyc_documents' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "kyc_update_own" ON storage.objects;
CREATE POLICY "kyc_update_own" ON storage.objects FOR UPDATE
  TO authenticated USING (bucket_id = 'kyc_documents' AND (storage.foldername(name))[1] = auth.uid()::text);

-- project_media: path = project_id/filename — only client or provider of that project
DROP POLICY IF EXISTS "project_media_select" ON storage.objects;
CREATE POLICY "project_media_select" ON storage.objects FOR SELECT
  TO authenticated USING (
    bucket_id = 'project_media'
    AND public.user_can_access_project(((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "project_media_insert" ON storage.objects;
CREATE POLICY "project_media_insert" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (
    bucket_id = 'project_media'
    AND public.user_can_access_project(((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "project_media_update" ON storage.objects;
CREATE POLICY "project_media_update" ON storage.objects FOR UPDATE
  TO authenticated USING (
    bucket_id = 'project_media'
    AND public.user_can_access_project(((storage.foldername(name))[1])::uuid)
  );

-- avatars: public read; authenticated upload/update to own folder (path = user_id/filename)
DROP POLICY IF EXISTS "avatars_select" ON storage.objects;
CREATE POLICY "avatars_select" ON storage.objects FOR SELECT
  TO public USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_insert" ON storage.objects;
CREATE POLICY "avatars_insert" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatars_update" ON storage.objects;
CREATE POLICY "avatars_update" ON storage.objects FOR UPDATE
  TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
