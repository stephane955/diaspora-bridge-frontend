/**
 * Escrow Webhook — Supabase Edge Function (Deno)
 *
 * Handles secure API calls to your payment provider when a milestone is approved:
 * - Stripe: create transfer/payout to connected account
 * - MTN MoMo / Orange Money: call mobile money API to disburse
 *
 * Trigger: call from your app after release_milestone RPC, or invoke via DB webhook.
 * Env: STRIPE_SECRET_KEY, MOMO_API_KEY, etc. (set in Supabase Dashboard > Edge Functions > Secrets)
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { project_id, provider_id, amount_cfa, reference, provider_type } = body as {
      project_id?: string;
      provider_id?: string;
      amount_cfa?: number;
      reference?: string;
      provider_type?: "stripe" | "momo" | "orange";
    };

    if (!amount_cfa || amount_cfa <= 0) {
      return new Response(
        JSON.stringify({ error: "Invalid amount" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // TODO: Integrate with your payment provider
    // Example Stripe: const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "");
    // await stripe.transfers.create({ amount: amount_cfa, currency: "xaf", destination: provider_stripe_account });
    // Example MTN MoMo: POST to MoMo API with api key from Deno.env.get("MOMO_API_KEY")

    const provider = provider_type ?? "stripe";
    console.log(`[escrow-webhook] Would disburse ${amount_cfa} CFA to provider ${provider_id} (${provider}) ref ${reference}`);

    return new Response(
      JSON.stringify({
        ok: true,
        message: "Disbursement queued (wire payment provider in this function)",
        reference,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[escrow-webhook]", e);
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
