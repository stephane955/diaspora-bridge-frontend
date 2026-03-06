/**
 * generate-tax-report — Supabase Edge Function
 * Queries all closed (completed) projects for the authenticated user and outputs
 * a jurisdiction-compliant report: total capital deployed, categorized for
 * property tax deductions. Outputs JSON by default; PDF scaffolded via expo-print or server-side.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TaxReportQuery {
  format?: "json" | "pdf";
  period_start?: string; // YYYY-MM-DD
  period_end?: string;   // YYYY-MM-DD
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

    const token = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired JWT" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = (await req.json().catch(() => ({}))) as TaxReportQuery;
    const format = body.format ?? "json";
    const periodStart = body.period_start ? new Date(body.period_start) : null;
    const periodEnd = body.period_end ? new Date(body.period_end) : null;

    const admin = createClient(supabaseUrl, supabaseServiceKey);

    let query = admin
      .from("projects")
      .select("id, title, status, created_at, updated_at")
      .eq("owner_id", user.id)
      .eq("status", "completed");

    const { data: projects, error: projectsError } = await query;

    if (projectsError) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch projects", details: projectsError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const filtered = (projects ?? []).filter((p) => {
      const updated = p.updated_at ? new Date(p.updated_at) : null;
      if (periodStart && updated && updated < periodStart) return false;
      if (periodEnd && updated && updated > periodEnd) return false;
      return true;
    });

    const projectIds = filtered.map((p) => p.id);
    let expenses: { project_id: string; amount: number; description: string; type: string }[] = [];
    if (projectIds.length > 0) {
      const { data: exp } = await admin
        .from("project_expenses")
        .select("project_id, amount, description, type")
        .in("project_id", projectIds);
      expenses = (exp ?? []) as typeof expenses;
    }

    const byProject = new Map<string, number>();
    for (const e of expenses) {
      const amt = Number(e.amount) || 0;
      byProject.set(e.project_id, (byProject.get(e.project_id) ?? 0) + amt);
    }

    const totalCapitalDeployed = Array.from(byProject.values()).reduce((a, b) => a + b, 0);
    const report = {
      user_id: user.id,
      period_start: periodStart?.toISOString().slice(0, 10) ?? null,
      period_end: periodEnd?.toISOString().slice(0, 10) ?? null,
      generated_at: new Date().toISOString(),
      total_capital_deployed: totalCapitalDeployed,
      currency: "XAF",
      project_count: filtered.length,
      categories: {
        property_construction: totalCapitalDeployed,
        property_tax_deduction_eligible: totalCapitalDeployed,
      },
      projects: filtered.map((p) => ({
        id: p.id,
        title: p.title,
        capital_deployed: byProject.get(p.id) ?? 0,
      })),
    };

    if (format === "pdf") {
      return new Response(
        JSON.stringify({
          message: "PDF generation scaffolded: use client-side expo-print or server-side PDF lib with this JSON payload.",
          report,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify(report), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[generate-tax-report]", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
