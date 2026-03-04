/**
 * PDF Generate — Supabase Edge Function (Deno)
 *
 * Takes project data (and optional contract/signatures), generates a digital contract or
 * receipt PDF, and saves it to the project_media storage bucket.
 *
 * Invoke from app after both parties sign, or from a DB webhook when project_contracts is updated.
 * Uses a simple HTML-to-PDF approach (e.g. Puppeteer in Deno Deploy or external service) or
 * a Deno-native PDF lib. This scaffold returns a placeholder; wire your preferred PDF generator.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PdfRequest {
  project_id: string;
  type: "contract" | "receipt";
  title?: string;
  html?: string;
  /** For receipt: amount, date, description */
  receipt?: { amount: string; date: string; description?: string };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as PdfRequest;
    const { project_id, type, title, html, receipt } = body;

    if (!project_id || !type) {
      return new Response(
        JSON.stringify({ error: "project_id and type required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // TODO: Generate PDF from html or from template
    // Options: 1) Use deno.land/x/pdf or similar to build PDF from HTML
    //          2) Call external service (e.g. docraptor, html-pdf-node) with html
    //          3) Use Supabase Storage + a serverless PDF API
    // For now we return a placeholder; the app can also generate client-side with expo-print.
    const filename = `${project_id}_${type}_${Date.now()}.pdf`;
    const path = `${project_id}/${filename}`;

    // If you have a PDF buffer from a generator:
    // const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    // const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    // await supabase.storage.from("project_media").upload(path, pdfBuffer, { contentType: "application/pdf" });
    // const { data } = supabase.storage.from("project_media").getPublicUrl(path);

    const publicUrl = `https://your-project.supabase.co/storage/v1/object/public/project_media/${path}`;

    return new Response(
      JSON.stringify({
        ok: true,
        path,
        publicUrl,
        message: "Wire a PDF generator (e.g. HTML to PDF) and upload to project_media bucket",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[pdf-generate]", e);
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
