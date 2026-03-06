/**
 * Transcribe Voice — Supabase Edge Function (Deno)
 * Fetches audio from message audio_url, sends to OpenAI Whisper, updates message.transcription_text.
 * Env: OPENAI_API_KEY (set in Supabase Dashboard > Edge Functions > Secrets)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { message_id } = (await req.json().catch(() => ({}))) as { message_id?: string };
    if (!message_id) {
      return new Response(JSON.stringify({ error: "message_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const { data: msg, error: fetchErr } = await supabase.from("messages").select("id, audio_url").eq("id", message_id).single();
    if (fetchErr || !msg?.audio_url) {
      await supabase.from("messages").update({ transcription_text: "[Audio not available for transcription]" }).eq("id", message_id);
      return new Response(JSON.stringify({ ok: true, transcription: null }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    let transcription = "[Connect OpenAI Whisper for transcription]";

    if (openaiKey) {
      try {
        const audioRes = await fetch(msg.audio_url);
        const audioBlob = await audioRes.blob();
        const form = new FormData();
        form.append("file", audioBlob, "audio.m4a");
        form.append("model", "whisper-1");

        const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
          method: "POST",
          headers: { Authorization: `Bearer ${openaiKey}` },
          body: form,
        });
        if (whisperRes.ok) {
          const out = await whisperRes.json();
          transcription = out.text ?? transcription;
        }
      } catch (e) {
        console.error("[transcribe-voice] Whisper error:", e);
        transcription = "[Transcription failed]";
      }
    }

    await supabase.from("messages").update({ transcription_text: transcription }).eq("id", message_id);
    return new Response(JSON.stringify({ ok: true, transcription }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[transcribe-voice]", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
