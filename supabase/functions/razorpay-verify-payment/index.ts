import { createClient } from "npm:@supabase/supabase-js@2";
import { createHmac } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TIERS: Record<string, { amount: number; tokens: number }> = {
  bronze: { amount: 1, tokens: 112 },
  silver: { amount: 15, tokens: 578 },
  gold: { amount: 24, tokens: 957 },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) throw new Error("Not authenticated");
    const token = authHeader.replace("Bearer ", "");

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) throw new Error("Not authenticated");
    const userId = claimsData.claims.sub as string;

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json();
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      throw new Error("Missing payment fields");
    }

    const keyId = Deno.env.get("RAZORPAY_KEY_ID")!;
    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET")!;

    // Verify signature
    const expected = createHmac("sha256", keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");
    if (expected !== razorpay_signature) throw new Error("Invalid signature");

    // Fetch order to get notes (server-trusted)
    const auth = btoa(`${keyId}:${keySecret}`);
    const orderRes = await fetch(`https://api.razorpay.com/v1/orders/${razorpay_order_id}`, {
      headers: { "Authorization": `Basic ${auth}` },
    });
    if (!orderRes.ok) throw new Error("Failed to fetch order");
    const order = await orderRes.json();

    const orderUserId = order.notes?.user_id;
    const tier = order.notes?.tier as string;
    const cfg = TIERS[tier];
    if (!cfg) throw new Error("Invalid tier in order");
    if (orderUserId !== userId) throw new Error("Order does not belong to user");

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Idempotent insert via unique stripe_session_id (reusing column for razorpay payment id)
    const { error: insertErr } = await admin.from("token_transactions").insert({
      user_id: userId,
      stripe_session_id: razorpay_payment_id,
      price_id: `razorpay_${tier}`,
      amount_cents: order.amount,
      currency: "inr",
      tokens_credited: cfg.tokens,
      status: "completed",
      environment: "live",
    });

    if (insertErr) {
      if (insertErr.code === "23505") {
        return new Response(JSON.stringify({ ok: true, duplicate: true, tokens: cfg.tokens }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw insertErr;
    }

    const { error: creditErr } = await admin.rpc("credit_tokens", {
      p_user_id: userId,
      p_tokens: cfg.tokens,
    });
    if (creditErr) throw creditErr;

    return new Response(JSON.stringify({ ok: true, tokens: cfg.tokens }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("razorpay-verify-payment error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
