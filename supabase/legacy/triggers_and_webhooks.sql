-- Triggers and Webhooks: Wire Postgres to the push-on-insert Edge Function
-- Run after rls_and_auth and apex_enterprise_schema. Supabase will invoke the Edge Function
-- when rows are inserted into webhook_outbox (configure one Database Webhook in Dashboard).

-- ========== 1. Outbox table for webhook payloads ==========
-- Triggers write here; Supabase Database Webhook (Dashboard) fires on INSERT and POSTs to your Edge Function.
CREATE TABLE IF NOT EXISTS public.webhook_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_outbox_created ON public.webhook_outbox(created_at);

-- RLS: only service role / webhook processor should read; triggers run as definer so they can insert.
ALTER TABLE public.webhook_outbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY "webhook_outbox_service_all" ON public.webhook_outbox
  FOR ALL USING (true) WITH CHECK (true);
-- Restrict in production: use a role check or disable RLS and rely on DB auth.

COMMENT ON TABLE public.webhook_outbox IS 'Outbox for push-on-insert: triggers write here; Database Webhook on this table POSTs to Edge Function.';

-- ========== 2. Trigger function: enqueue webhook payload ==========
CREATE OR REPLACE FUNCTION public.notify_push_outbox()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.webhook_outbox (table_name, event_type, payload)
  VALUES (TG_TABLE_NAME, LOWER(TG_OP), to_jsonb(NEW));
  RETURN NEW;
END;
$$;

-- ========== 3. Trigger on messages: AFTER INSERT ==========
DROP TRIGGER IF EXISTS trg_messages_push ON public.messages;
CREATE TRIGGER trg_messages_push
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_push_outbox();

-- ========== 4. Trigger on milestones: AFTER UPDATE (status = approved/paid or disputed) ==========
CREATE OR REPLACE FUNCTION public.notify_milestone_push_outbox()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status
     AND (NEW.status IN ('paid', 'in_review') OR NEW.dispute_status = 'open') THEN
    INSERT INTO public.webhook_outbox (table_name, event_type, payload)
    VALUES (TG_TABLE_NAME, 'update', to_jsonb(NEW));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_milestones_push ON public.milestones;
CREATE TRIGGER trg_milestones_push
  AFTER UPDATE ON public.milestones
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_milestone_push_outbox();

-- ========== Dashboard setup ==========
-- In Supabase Dashboard: Database > Webhooks > Create a new hook:
--   Name: push-on-insert
--   Table: webhook_outbox
--   Events: Insert
--   Type: HTTP Request
--   URL: https://<your-project-ref>.supabase.co/functions/v1/push-on-insert
--   HTTP Headers: Authorization: Bearer <your-anon-or-service-role-key>
--
-- Your push-on-insert Edge Function should accept:
--   body.record = the inserted webhook_outbox row (table_name, event_type, payload).
--   For messages: use body.record.payload as the message row (project_id, sender_id, content).
--   For milestones: use body.record.payload as the milestone row; resolve recipient push tokens from project owner_id and assigned_provider_id.
