import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Server-side source of truth: amount (in INR rupees) and tokens per tier
const TIERS: Record<string, { amount: number; tokens: number }> = {
  bronze: { amount: 1, tokens: 1000 },
  silver: { amount: 15, tokens: 2100 },
  gold: { amount: 24, tokens: 3199 },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) throw new Error("Not authenticated");
    const token = authHeader.replace("Bearer ", "");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) throw new Error("Not authenticated");
    const userId = claimsData.claims.sub as string;

    const { tier } = await req.json();
    const cfg = TIERS[tier];
    if (!cfg) throw new Error("Invalid tier");

    const keyId = Deno.env.get("RAZORPAY_KEY_ID")!;
    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET")!;
    const auth = btoa(`${keyId}:${keySecret}`);

    const orderRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: cfg.amount * 100, // paise
        currency: "INR",
        notes: { user_id: userId, tier, tokens: String(cfg.tokens) },
      }),
    });

    if (!orderRes.ok) {
      const errText = await orderRes.text();
      console.error("Razorpay order failed:", errText);
      throw new Error("Failed to create order");
    }

    const order = await orderRes.json();
    return new Response(
      JSON.stringify({ orderId: order.id, amount: order.amount, currency: order.currency, keyId, tier, tokens: cfg.tokens }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("razorpay-create-order error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
