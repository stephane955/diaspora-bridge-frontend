/**
 * send-push — Supabase Edge Function
 * Sends Expo Push Notifications. Invoke via Database Webhooks on:
 * - notifications INSERT (record: user_id, title, message, link)
 * - webhook_outbox INSERT (record: table_name, event_type, payload) for messages & milestones
 * Resolves recipient Expo token from user_devices (then profiles.push_token / expo_push_token).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type WebhookRecord =
  | { user_id: string; title: string; message: string; link?: string }
  | { table_name: string; event_type: string; payload: Record<string, unknown> };

async function getExpoTokenForUser(supabase: ReturnType<typeof createClient>, userId: string): Promise<string | null> {
  const { data: device } = await supabase
    .from("user_devices")
    .select("expo_push_token")
    .eq("user_id", userId)
    .not("expo_push_token", "is", null)
    .limit(1)
    .maybeSingle();
  if (device?.expo_push_token) return device.expo_push_token as string;

  const { data: profile } = await supabase
    .from("profiles")
    .select("push_token, expo_push_token")
    .eq("id", userId)
    .maybeSingle();
  const row = profile as { push_token?: string; expo_push_token?: string } | null;
  return (row?.expo_push_token ?? row?.push_token) ?? null;
}

async function sendExpoPush(to: string, title: string, body: string, data: Record<string, unknown> = {}) {
  const res = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ to, sound: "default", title, body, data }),
  });
  return res;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = (await req.json().catch(() => ({}))) as {
      type?: string;
      record?: WebhookRecord;
    };
    const record = payload?.record as WebhookRecord | undefined;
    if (!record) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing record" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const messages: { to: string; title: string; body: string; data: Record<string, unknown> }[] = [];

    if ("user_id" in record && record.user_id && "title" in record && "message" in record) {
      const token = await getExpoTokenForUser(supabase, record.user_id);
      if (token) {
        messages.push({
          to: token,
          title: record.title,
          body: record.message,
          data: { route: record.link ?? null, project_id: (record as { project_id?: string }).project_id ?? null },
        });
      }
    } else if ("table_name" in record && "payload" in record) {
      const { table_name, payload: p } = record;
      if (table_name === "messages" && p?.project_id) {
        const { data: project } = await supabase
          .from("projects")
          .select("owner_id, assigned_provider_id")
          .eq("id", p.project_id)
          .single();
        const senderId = p.sender_id as string | undefined;
        const recipientId = project?.owner_id === senderId ? project?.assigned_provider_id : project?.owner_id;
        const content = (p.content as string)?.slice(0, 80) ?? "New message";
        if (recipientId) {
          const token = await getExpoTokenForUser(supabase, recipientId);
          if (token) {
            messages.push({
              to: token,
              title: "New message",
              body: content,
              data: { project_id: p.project_id, chat_id: p.project_id },
            });
          }
        }
      } else if (table_name === "milestones" && p?.project_id) {
        const status = p.status as string;
        if (status === "in_review") {
          const { data: project } = await supabase
            .from("projects")
            .select("owner_id")
            .eq("id", p.project_id)
            .single();
          const ownerId = project?.owner_id;
          if (ownerId) {
            const token = await getExpoTokenForUser(supabase, ownerId);
            if (token) {
              messages.push({
                to: token,
                title: "Proof of work submitted",
                body: "Provider submitted proof for a milestone. Approve or review.",
                data: { project_id: p.project_id, openApproval: "1" },
              });
            }
          }
        }
      }
    }

    for (const msg of messages) {
      const pushRes = await sendExpoPush(msg.to, msg.title, msg.body, msg.data);
      if (!pushRes.ok) {
        console.error("Expo push failed:", pushRes.status, await pushRes.text());
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent: messages.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("send-push error:", e);
    return new Response(
      JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
