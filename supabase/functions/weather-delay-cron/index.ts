/**
 * weather-delay-cron — Supabase Edge Function (invoke via cron or manually)
 * For each project with coordinates, calls a weather API. If severe weather is predicted,
 * inserts a system message into messages and a row into project_updates warning the client
 * of an expected timeline delay.
 * Env: OPENWEATHERMAP_API_KEY or WEATHER_API_KEY (or use any free weather API).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SEVERE_CODES = new Set([200, 201, 202, 210, 211, 212, 221, 230, 231, 232, 502, 503, 504, 511, 602, 622]);
const CRON_SECRET = Deno.env.get("CRON_SECRET");

async function fetchWeather(lat: number, lon: number): Promise<{ severe: boolean; description?: string }> {
  const key = Deno.env.get("OPENWEATHERMAP_API_KEY") ?? Deno.env.get("WEATHER_API_KEY");
  if (!key) {
    return { severe: false };
  }
  const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${key}&units=metric`;
  const res = await fetch(url);
  if (!res.ok) return { severe: false };
  const data = await res.json();
  const list = data.list ?? [];
  for (const item of list.slice(0, 4)) {
    const id = item.weather?.[0]?.id;
    if (id && SEVERE_CODES.has(id)) {
      return { severe: true, description: item.weather[0].description ?? "Severe weather" };
    }
  }
  return { severe: false };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (CRON_SECRET && req.headers.get("Authorization") !== `Bearer ${CRON_SECRET}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: projects, error } = await admin
      .from("projects")
      .select("id, owner_id, assigned_provider_id, title, latitude, longitude")
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .in("status", ["in_progress", "escrow_funded"]);

    if (error || !projects?.length) {
      return new Response(
        JSON.stringify({ ok: true, checked: 0, message: "No projects with coordinates or error" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let delaysInserted = 0;
    for (const p of projects) {
      const lat = Number(p.latitude);
      const lon = Number(p.longitude);
      if (Number.isNaN(lat) || Number.isNaN(lon)) continue;

      const { severe, description } = await fetchWeather(lat, lon);
      if (!severe) continue;

      const systemUserId = Deno.env.get("SYSTEM_USER_ID");
      const messageText = `[System] Severe weather predicted (${description ?? "check forecast"}). Expected timeline delay.`;
      await admin.from("messages").insert({
        project_id: p.id,
        sender_id: systemUserId ?? p.owner_id,
        content: messageText,
        message_type: "system",
      });

      await admin.from("project_updates").insert({
        project_id: p.id,
        title: "Weather delay warning",
        body: `Severe weather is predicted for the project area. Please expect a possible timeline delay. ${description ?? ""}`,
        created_by: systemUserId ?? p.assigned_provider_id ?? p.owner_id,
      });
      delaysInserted++;
    }

    return new Response(
      JSON.stringify({ ok: true, checked: projects.length, delays_inserted: delaysInserted }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[weather-delay-cron]", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
