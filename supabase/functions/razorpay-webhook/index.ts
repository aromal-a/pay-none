import { createClient } from "npm:@supabase/supabase-js@2";
import { createHmac } from "node:crypto";

// Public webhook — no auth header from Razorpay. Signature is the auth.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-razorpay-signature",
};

// Tier config — MUST match src/pages/Index.tsx VocalPackages
// (bronze=OZONIZED, silver=SUB_VERTICAL, gold=FREAK_CODE)
const TIERS: Record<string, { amount: number; tokens: number; name: string }> = {
  bronze: { amount: 1,  tokens: 112, name: "OZONIZED" },
  silver: { amount: 15, tokens: 578, name: "SUB_VERTICAL" },
  gold:   { amount: 24, tokens: 957, name: "FREAK_CODE" },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  try {
    const secret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");
    if (!secret) throw new Error("Webhook secret not configured");

    const signature = req.headers.get("x-razorpay-signature") || "";
    const rawBody = await req.text();

    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    if (expected !== signature) {
      console.error("Invalid webhook signature");
      return new Response(JSON.stringify({ ok: false, error: "invalid signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const event = JSON.parse(rawBody);
    const type: string = event.event || "";

    // Only credit on paid payment link, or captured payment tied to notes.
    const isPaymentLinkPaid = type === "payment_link.paid";
    const isPaymentCaptured = type === "payment.captured";
    if (!isPaymentLinkPaid && !isPaymentCaptured) {
      return new Response(JSON.stringify({ ok: true, ignored: type }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract entities
    const payment = event.payload?.payment?.entity;
    const link = event.payload?.payment_link?.entity;

    const notes = (link?.notes ?? payment?.notes ?? {}) as Record<string, string>;
    const email =
      link?.customer?.email ||
      payment?.email ||
      notes.email ||
      "";

    const tier = (notes.tier || "").toLowerCase();
    const cfg = TIERS[tier];
    if (!cfg) {
      console.log("Unknown or missing tier in notes; ignoring", { tier, event: type });
      return new Response(JSON.stringify({ ok: true, ignored: "unknown tier" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // amount_paid is in paise. Derive quantity from amount_paid if available,
    // otherwise fall back to notes.quantity.
    const amountPaise: number = link?.amount_paid ?? payment?.amount ?? 0;
    const notesQty = Math.max(1, parseInt(notes.quantity ?? "1", 10) || 1);
    const derivedQty = amountPaise > 0 ? Math.max(1, Math.round(amountPaise / 100 / cfg.amount)) : notesQty;
    const quantity = Math.min(99, derivedQty);
    const tokensCredited = cfg.tokens * quantity;

    // Idempotency key: prefer payment id; fall back to payment_link id + event id.
    const paymentId: string =
      payment?.id ||
      link?.id ||
      `pl_${link?.id ?? "unknown"}_${event.id ?? Date.now()}`;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Resolve user by notes.user_id (preferred) or email lookup.
    let userId: string | null = notes.user_id || null;
    if (!userId && email) {
      const { data: prof } = await admin
        .from("profiles")
        .select("user_id")
        .ilike("email", email)
        .maybeSingle();
      userId = prof?.user_id ?? null;
    }
    if (!userId) {
      console.error("Could not resolve user for payment", { email, notes });
      // Return 200 so Razorpay stops retrying — we've logged for manual triage.
      return new Response(JSON.stringify({ ok: true, ignored: "user not found", email }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Idempotent insert into token_transactions via unique stripe_session_id.
    const { error: insertErr } = await admin.from("token_transactions").insert({
      user_id: userId,
      stripe_session_id: paymentId,
      price_id: `razorpay_link_${tier}_x${quantity}`,
      amount_cents: amountPaise,
      currency: "inr",
      tokens_credited: tokensCredited,
      status: "completed",
      environment: "live",
    });

    if (insertErr) {
      if (insertErr.code === "23505") {
        // Already credited.
        return new Response(JSON.stringify({ ok: true, duplicate: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw insertErr;
    }

    const { error: creditErr } = await admin.rpc("credit_tokens", {
      p_user_id: userId,
      p_tokens: tokensCredited,
    });
    if (creditErr) throw creditErr;

    console.log("Credited", { userId, tier: cfg.name, quantity, tokensCredited, paymentId });

    return new Response(JSON.stringify({ ok: true, tokens: tokensCredited, tier: cfg.name }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("razorpay-webhook error:", e);
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
