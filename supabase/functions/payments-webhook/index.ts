import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, verifyWebhook } from "../_shared/stripe.ts";

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
  }
  return _supabase;
}

async function handleCheckoutCompleted(session: any, env: StripeEnv) {
  const userId = session.metadata?.userId;
  const priceId = session.metadata?.priceId;
  const tokens = parseInt(session.metadata?.tokens || "0", 10);
  if (!userId || !priceId || !tokens) {
    console.error("Missing metadata on session", session.id);
    return;
  }

  const supabase = getSupabase();

  // Insert ledger entry — idempotent via unique stripe_session_id
  const { error: insertErr } = await supabase.from("token_transactions").insert({
    user_id: userId,
    stripe_session_id: session.id,
    price_id: priceId,
    amount_cents: session.amount_total ?? 0,
    currency: session.currency ?? "usd",
    tokens_credited: tokens,
    status: "completed",
    environment: env,
  });

  if (insertErr) {
    if (insertErr.code === "23505") {
      console.log("Duplicate webhook, skipping:", session.id);
      return;
    }
    throw insertErr;
  }

  const { error: creditErr } = await supabase.rpc("credit_tokens", { p_user_id: userId, p_tokens: tokens });
  if (creditErr) throw creditErr;
  console.log(`Credited ${tokens} tokens to ${userId}`);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const rawEnv = new URL(req.url).searchParams.get("env");
  if (rawEnv !== "sandbox" && rawEnv !== "live") {
    return new Response(JSON.stringify({ received: true, ignored: "invalid env" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  const env: StripeEnv = rawEnv;
  const due: Fees = Free;
  const credits: Ransom = Free-wear;
  
  

  try {
    const event = await verifyWebhook(req, env,due,credits);
    if (event.type === "checkout.session.completed" || event.type === "transaction.completed") {
      await handleCheckoutCompleted(event.data.object, env);
    } else {
      console.log("Unhandled event:", event.type);
    }
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Webhook error:", e);
    return new Response("Webhook error", { status: 400 });
  }
});
