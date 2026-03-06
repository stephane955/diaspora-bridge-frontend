/**
 * compliance-check — Supabase Edge Function
 * AML: When an Escrow deposit exceeds the threshold (e.g. $10,000 equivalent),
 * flags the project as compliance_review_pending. Project cannot proceed until
 * an admin clears it (compliance_cleared_at set via dashboard or admin API).
 * Invoke from process-escrow after payment success when amount > threshold.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AML_THRESHOLD_CFA = Number(Deno.env.get("AML_THRESHOLD_CFA")) || 6_000_000; // ~$10k USD equiv in CFA

interface ComplianceCheckBody {
  project_id: string;
  amount_cfa: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = (await req.json().catch(() => ({}))) as ComplianceCheckBody;
    const { project_id, amount_cfa } = body;

    if (!project_id || amount_cfa == null) {
      return new Response(
        JSON.stringify({ error: "project_id and amount_cfa required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, supabaseServiceKey);

    if (amount_cfa <= AML_THRESHOLD_CFA) {
      return new Response(
        JSON.stringify({ ok: true, compliance_required: false, project_id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { error } = await admin
      .from("projects")
      .update({
        compliance_review_pending: true,
        status: "compliance_review_pending",
      })
      .eq("id", project_id);

    if (error) {
      console.error("[compliance-check] Update failed:", error);
      return new Response(
        JSON.stringify({ error: "Failed to flag project for compliance review", details: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        compliance_required: true,
        project_id,
        message: "Project flagged for manual admin clearance before proceeding.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[compliance-check]", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
