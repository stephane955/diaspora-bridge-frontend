/**
 * escrow-webhook — P00 fail-closed legacy stub.
 * Public unauthenticated mutation disabled until C11 provider-specific verification.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  return new Response(
    JSON.stringify({
      error: "legacy_webhook_disabled",
      message: "Escrow webhook is disabled until secure PSP webhook handling (C11) is deployed.",
    }),
    { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
