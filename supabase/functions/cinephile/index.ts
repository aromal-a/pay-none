import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `You are a curious cinephile and a fun, gentle third-wheeler in a 2-person creative call between a Previewer (the performer) and a Viewer (the audience suggesting story/role ideas). Speak in third person about both of them ("the Previewer seems...", "the Viewer is hinting at..."). Be warm, very curious about the story, never bossy, never instruct. 1–2 short sentences max. If you have nothing genuinely useful or playful to add right now, return exactly an empty string. Never invent facts about the people. Never repeat the latest exchange — react to it.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Unauthorized" }, 401);

    const { acs_id } = await req.json();
    if (!acs_id || typeof acs_id !== "string") return json({ error: "acs_id required" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) return json({ error: "AI not configured" }, 500);

    // Verify caller belongs to ACS
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const uid = userData?.user?.id;
    if (!uid) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: acs } = await admin
      .from("live_active_call_spaces")
      .select("id, previewer_id, viewer_id, closed_at")
      .eq("id", acs_id)
      .maybeSingle();
    if (!acs || acs.closed_at) return json({ error: "ACS not active" }, 404);
    if (acs.previewer_id !== uid && acs.viewer_id !== uid) return json({ error: "Forbidden" }, 403);

    // Recent context
    const { data: msgs } = await admin
      .from("live_acs_messages")
      .select("kind, body, author_id, created_at")
      .eq("acs_id", acs_id)
      .order("created_at", { ascending: false })
      .limit(30);

    const ordered = (msgs ?? []).reverse();
    const transcript = ordered
      .map((m) => {
        if (m.kind === "ai") return `Cinephile: ${m.body}`;
        const who = m.author_id === acs.previewer_id ? "Previewer" : "Viewer";
        return `${who}: ${m.body}`;
      })
      .join("\n");

    if (!transcript.trim()) return json({ skipped: true });

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-5",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: `Recent exchange:\n${transcript}\n\nReply with at most 1–2 sentences, or empty string.` },
        ],
      }),
    });
    if (aiRes.status === 429) return json({ error: "Rate limited" }, 429);
    if (aiRes.status === 402) return json({ error: "Out of credits" }, 402);
    if (!aiRes.ok) return json({ error: "AI error" }, 500);

    const aiData = await aiRes.json();
    const text = (aiData.choices?.[0]?.message?.content ?? "").trim();
    if (!text) return json({ skipped: true });

    await admin.from("live_acs_messages").insert({
      acs_id,
      author_id: null,
      kind: "ai",
      body: text,
    });
    return json({ inserted: true });
  } catch (e) {
    console.error("cinephile error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
