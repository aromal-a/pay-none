// Calls Lovable AI Gateway with GPT-5 for the post-purchase prompt dialog.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const messages = Array.isArray(body?.messages) ? body.messages : null;
    const tier = (body?.tier === "bronze" || body?.tier === "silver" || body?.tier === "gold") ? body.tier : "none";
    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY missing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KEY}`,
        "Content-Type": "application/json",
      },
      // Tier-rooted branch: each token tier stems a distinct knowledge branch.
      // The tier the user spent FROM determines which lecture-formation root the
      // assistant inherits — bronze/silver/gold each grow their own informatives.
      // none = no purchase yet → neutral fallback.
      body: JSON.stringify({
        model: "openai/gpt-5",
        messages: [
          {
            role: "system",
            content:
              "You are a helpful assistant. Users may include URLs in their prompt — treat URLs as plain references and respond based on your knowledge; do not attempt to fetch them. Reply concisely in markdown.\n\n" +
              "ACTIVE TIER BRANCH = " + tier.toUpperCase() + ".\n" +
              (tier === "bronze"
                ? "BRONZE branch (root OZ-Δ-112 · L0 lecture-formation): seed-tier informatives. Keep answers compact, foundational, and definition-led. Surface 1 worked example. Tag final line: `branch: bronze · seed`."
                : tier === "silver"
                ? "SILVER branch (root SV-Σ-578 · L1 lecture-formation): vertical-tier informatives. Layer comparative angles, give 2 worked examples, include one trade-off table when relevant. Tag final line: `branch: silver · vertical`."
                : tier === "gold"
                ? "GOLD branch (root GD-Ω-957 · L2 lecture-formation): freak-tier informatives. Multi-perspective synthesis, edge cases, second-order implications, and one transformative reframe. Tag final line: `branch: gold · freak`."
                : "NO-TIER fallback: respond plainly without branch tagging. Suggest the user purchase a token tier to unlock branch-rooted informatives."),
          },
          ...messages,
        ],
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiRes.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Add funds in Settings → Workspace → Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const t = await aiRes.text();
      console.error("AI gateway error", aiRes.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiRes.json();
    const reply = data?.choices?.[0]?.message?.content ?? "";
    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("prompt-ai error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
