/**
 * process-escrow — Supabase Edge Function (Deno)
 * Safely process Escrow deposits and mark project as escrow_funded.
 * Validates JWT, calls payment provider (Stripe / MTN MoMo / Orange Money), then updates project via Admin API.
 * Never expose payment API keys in the React Native app.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type PaymentProvider = "stripe" | "momo" | "orange";

interface ProcessEscrowBody {
  project_id: string;
  amount_cfa: number;
  currency?: string;
  provider: PaymentProvider;
  /** Stripe: payment_method_id or intent id; MoMo/Orange: phone, reference */
  payment_method_id?: string;
  provider_account_id?: string;
  phone?: string;
  reference?: string;
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

    // P00: legacy escrow path disabled until Phase 3B/C06 canonical funding.
    return new Response(
      JSON.stringify({
        error: "legacy_escrow_disabled",
        message: "Escrow funding is temporarily unavailable while secure payment processing is being upgraded.",
      }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

    const body = (await req.json().catch(() => ({}))) as ProcessEscrowBody;
    const { project_id, amount_cfa, provider, payment_method_id, provider_account_id, phone, reference } = body;

    if (!project_id || !amount_cfa || amount_cfa <= 0) {
      return new Response(
        JSON.stringify({ error: "project_id and positive amount_cfa required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: project, error: projectError } = await adminClient
      .from("projects")
      .select("id, owner_id, status, insurance_premium")
      .eq("id", project_id)
      .single();

    if (projectError || !project) {
      return new Response(
        JSON.stringify({ error: "Project not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (project.owner_id !== user.id) {
      return new Response(
        JSON.stringify({ error: "Only the project owner can fund escrow" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const currency = body.currency ?? "xaf";
    let paymentSuccess = false;
    let externalId: string | null = null;

    switch (provider) {
      case "stripe": {
        const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
        if (!stripeKey) {
          console.warn("[process-escrow] STRIPE_SECRET_KEY not set");
          paymentSuccess = true;
          externalId = "mock_stripe_" + Date.now();
          break;
        }
        const Stripe = (await import("https://esm.sh/stripe@14.21.0?target=deno")).default;
        const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16", httpClient: Stripe.createFetchHttpClient() });
        const amountCents = Math.round(amount_cfa / 1);
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amountCents,
          currency: currency.toLowerCase(),
          automatic_payment_methods: { enabled: true },
          metadata: { project_id, user_id: user.id },
        });
        if (payment_method_id) {
          await stripe.paymentIntents.confirm(paymentIntent.id, { payment_method: payment_method_id });
          paymentSuccess = true;
          externalId = paymentIntent.id;
        } else {
          return new Response(
            JSON.stringify({ client_secret: paymentIntent.client_secret, payment_intent_id: paymentIntent.id }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        break;
      }
      case "momo": {
        const momoApiKey = Deno.env.get("MOMO_API_KEY");
        const momoUrl = Deno.env.get("MOMO_API_URL") ?? "https://api.mtn.com/v1/collection/payment";
        if (!momoApiKey) {
          console.warn("[process-escrow] MOMO_API_KEY not set");
          paymentSuccess = true;
          externalId = "mock_momo_" + Date.now();
          break;
        }
        const res = await fetch(momoUrl, {
          method: "POST",
          headers: { "Authorization": `Bearer ${momoApiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: amount_cfa,
            currency: "XAF",
            externalId: reference ?? project_id,
            payer: { partyIdType: "MSISDN", partyId: phone ?? "" },
            payerMessage: "Escrow deposit",
            payeeNote: "Diaspora Bridge escrow",
          }),
        });
        paymentSuccess = res.ok;
        if (res.ok) {
          const data = await res.json();
          externalId = data.transactionRef ?? data.reference ?? String(Date.now());
        }
        break;
      }
      case "orange": {
        const orangeKey = Deno.env.get("ORANGE_MONEY_API_KEY");
        if (!orangeKey) {
          console.warn("[process-escrow] ORANGE_MONEY_API_KEY not set");
          paymentSuccess = true;
          externalId = "mock_orange_" + Date.now();
          break;
        }
        const orangeUrl = Deno.env.get("ORANGE_MONEY_API_URL") ?? "https://api.orange.com/orange-money-api/v1/payment";
        const res = await fetch(orangeUrl, {
          method: "POST",
          headers: { "Authorization": `Bearer ${orangeKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: amount_cfa,
            currency: "XAF",
            order_id: reference ?? project_id,
            return_url: "diaspora-bridge://escrow-return",
            cancel_url: "diaspora-bridge://escrow-cancel",
          }),
        });
        paymentSuccess = res.ok;
        if (res.ok) {
          const data = await res.json();
          externalId = data.payment_ref ?? String(Date.now());
        }
        break;
      }
      default:
        return new Response(
          JSON.stringify({ error: "Unsupported provider. Use stripe, momo, or orange." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    if (!paymentSuccess) {
      return new Response(
        JSON.stringify({ error: "Payment failed", provider }) as string,
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const AML_THRESHOLD_CFA = Number(Deno.env.get("AML_THRESHOLD_CFA")) || 6_000_000;
    if (amount_cfa > AML_THRESHOLD_CFA) {
      const { error: complianceError } = await adminClient
        .from("projects")
        .update({
          compliance_review_pending: true,
          status: "compliance_review_pending",
        })
        .eq("id", project_id);
      if (complianceError) {
        console.error("[process-escrow] AML flag update failed:", complianceError);
      }
      return new Response(
        JSON.stringify({
          ok: true,
          project_id,
          compliance_required: true,
          message: "Deposit exceeds AML threshold; project flagged for manual admin clearance.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (project?.insurance_premium) {
      // Integer 1.5% fee — matches platform_fee_insurance_minor (truncate toward zero)
      const insuranceFee = Math.trunc((amount_cfa * 15) / 1000);
      const platformInsuranceWallet = Deno.env.get("PLATFORM_INSURANCE_WALLET_ID");
      if (platformInsuranceWallet && insuranceFee > 0) {
        await adminClient.from("transactions").insert({
          user_id: platformInsuranceWallet,
          amount: insuranceFee,
          description: `Insurance premium 1.5% for project ${project_id}`,
        }).then(() => {});
      }
    }

    const { error: updateError } = await adminClient
      .from("projects")
      .update({ status: "escrow_funded" })
      .eq("id", project_id);

    if (updateError) {
      console.error("[process-escrow] Project update failed:", updateError);
      return new Response(
        JSON.stringify({ error: "Payment succeeded but project update failed", details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        project_id,
        status: "escrow_funded",
        external_id: externalId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[process-escrow]", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
