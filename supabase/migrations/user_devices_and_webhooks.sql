-- user_devices: store Expo Push Tokens per device for Database Webhooks -> send-push
-- Run before configuring Database Webhooks on messages and milestones.

CREATE TABLE IF NOT EXISTS public.user_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expo_push_token text NOT NULL,
  device_id text,
  locale text DEFAULT 'en',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON public.user_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_user_devices_expo_push_token ON public.user_devices(expo_push_token) WHERE expo_push_token IS NOT NULL;

ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_devices_select_own" ON public.user_devices FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "user_devices_insert_own" ON public.user_devices FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "user_devices_update_own" ON public.user_devices FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "user_devices_delete_own" ON public.user_devices FOR DELETE USING (user_id = auth.uid());

COMMENT ON TABLE public.user_devices IS 'Expo push tokens per device; used by send-push Edge Function for notifications when app is closed.';

-- Database Webhooks (configure in Supabase Dashboard):
-- 1) Table: webhook_outbox, Event: Insert, URL: https://<project-ref>.supabase.co/functions/v1/send-push
--    -> send-push receives record.table_name (messages/milestones) and record.payload, notifies recipient via user_devices or profiles.
-- 2) Table: notifications, Event: Insert, URL: https://<project-ref>.supabase.co/functions/v1/send-push
--    -> send-push receives record.user_id, record.title, record.message and sends to that user.

-- Ensure profiles has push_token for backward compatibility (already in apex_enterprise_schema)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS push_token text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS expo_push_token text;
