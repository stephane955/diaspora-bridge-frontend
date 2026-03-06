/**
 * Translate Message — Supabase Edge Function (Deno)
 * Translates message.transcription_text to target_lang (e.g. en, fr, de) and updates message.
 * Env: OPENAI_API_KEY (optional; for OpenAI translate). Falls back to placeholder if not set.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const langNames: Record<string, string> = { en: "English", fr: "French", es: "Spanish", de: "German", it: "Italian" };

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { message_id, target_lang } = (await req.json().catch(() => ({}))) as { message_id?: string; target_lang?: string };
    if (!message_id || !target_lang) {
      return new Response(JSON.stringify({ error: "message_id and target_lang required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const { data: msg, error: fetchErr } = await supabase.from("messages").select("id, transcription_text").eq("id", message_id).single();
    if (fetchErr || !msg) {
      return new Response(JSON.stringify({ error: "Message not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const source = msg.transcription_text || "";
    let translation = source;

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (openaiKey && source && !source.startsWith("[")) {
      try {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
          body: JSON.stringify({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: `Translate the following to ${langNames[target_lang] || target_lang}. Reply with only the translation, no explanation.\n\n${source}` }],
            max_tokens: 500,
          }),
        });
        if (res.ok) {
          const out = await res.json();
          translation = out.choices?.[0]?.message?.content?.trim() || source;
        }
      } catch (e) {
        console.error("[translate-message] OpenAI error:", e);
      }
    }

    await supabase.from("messages").update({ translation_text: translation, translation_lang: target_lang }).eq("id", message_id);
    return new Response(JSON.stringify({ ok: true, translation_lang: target_lang }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[translate-message]", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
