// Supabase Edge Function: send-push
// Sends Expo Push Notifications when a new row is inserted into the `notifications` table.
// Invoke via Database Webhook on notifications INSERT.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface NotificationPayload {
  type?: string;
  table?: string;
  record?: {
    user_id: string;
    title: string;
    message: string;
    link?: string;
    [key: string]: unknown;
  };
  schema?: string;
  old_record?: unknown;
}

interface ProfilesRow {
  id: string;
  expo_push_token: string | null;
  [key: string]: unknown;
}

Deno.serve(async (req: Request): Promise<Response> => {
  try {
    const payload: NotificationPayload = await req.json();

    const record = payload?.record;
    if (!record?.user_id || !record?.title || record?.message == null) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required fields: user_id, title, or message",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("expo_push_token")
      .eq("id", record.user_id)
      .maybeSingle();

    if (profileError) {
      console.error("Profiles query error:", profileError);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to fetch profile",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const row = profile as ProfilesRow | null;
    const expoPushToken = row?.expo_push_token;

    if (!expoPushToken || typeof expoPushToken !== "string") {
      return new Response(
        JSON.stringify({
          success: true,
          skipped: true,
          reason: "No expo_push_token for user",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const pushBody = {
      to: expoPushToken,
      sound: "default",
      title: record.title,
      body: record.message,
      data: { route: record.link ?? null },
    };

    const pushRes = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(pushBody),
    });

    if (!pushRes.ok) {
      const errText = await pushRes.text();
      console.error("Expo push failed:", pushRes.status, errText);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Expo push request failed",
          details: errText.slice(0, 200),
        }),
        {
          status: 502,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Push notification sent",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    console.error("send-push error:", e);
    return new Response(
      JSON.stringify({
        success: false,
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
