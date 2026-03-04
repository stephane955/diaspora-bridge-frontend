// Push-on-Insert: Supabase Edge Function. Triggered by DB webhooks (messages INSERT, milestones UPDATE).
// Sends payload to Expo Push API. Set recipient_push_token in webhook payload or resolve from profiles.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const payload = (await req.json().catch(() => ({}))) as {
      type?: string;
      table?: string;
      record?: { project_id?: string; recipient_push_token?: string; content?: string; status?: string };
    };
    const { type, table, record } = payload;
    if (!record) {
      return new Response(JSON.stringify({ ok: false, error: "No record" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const messages: { to: string; title: string; body: string; data: Record<string, unknown> }[] = [];

    if (table === "messages" && type === "insert" && record.project_id && record.recipient_push_token) {
      messages.push({
        to: record.recipient_push_token,
        title: "New message",
        body: (record.content as string)?.slice(0, 80) ?? "New message",
        data: { project_id: record.project_id },
      });
    }

    if (messages.length > 0) {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(messages),
      });
      if (!res.ok) throw new Error(await res.text());
    }

    return new Response(JSON.stringify({ ok: true, sent: messages.length }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[push-on-insert]", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
