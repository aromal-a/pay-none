import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Radio, ArrowLeft, Mic, Eye, Hand, Film, Music, Terminal, HelpCircle, Pencil, AlertTriangle, Eraser, Pause, Square, RotateCcw, Trash2, Save, Circle, Plus, X, Sparkles, Send, Loader2, Link2, Copy, RefreshCw, MessageSquare } from "lucide-react";
import Channels from "@/components/live/Channels";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Mode = "viewer" | "previewer" | "channels";
type Role = "broadcaster" | "viewer";
type Peer = {
  sign: string;
  number: number;
  joined_at: number;
  user_id: string;
  role: Role;
  credits: number;
};

const SIGNS = ["✦", "✺", "✹", "✸", "✷", "✶", "✧", "✪", "✫", "✬", "✭", "✮", "✯", "✰", "❂", "✣"];

export default function Live() {
  const { user, loading } = useAuth();
  const [mode, setModeRaw] = useState<Mode | null>(null);

  // Switching from Viewer → Previewer wipes viewer-side traces (anonymity).
  // Previewer → Viewer keeps records (allows previewers to spy on viewer surface).
  const setMode = async (next: Mode | null) => {
    if (mode === "viewer" && next === "previewer") {
      try {
        const { data, error } = await supabase.rpc("wipe_viewer_traces");
        if (error) throw error;
        const d = (data as { messages_wiped?: number; requests_wiped?: number } | null) ?? {};
        if (navigator.vibrate) navigator.vibrate(40);
        toast.success("Viewer traces wiped", {
          description: `${d.requests_wiped ?? 0} requests · ${d.messages_wiped ?? 0} messages discarded`,
        });
      } catch (e) {
        toast.error("Wipe failed", { description: e instanceof Error ? e.message : "try again" });
        return;
      }
    }
    setModeRaw(next);
  };
  const [peers, setPeers] = useState<Peer[]>([]);
  const [role, setRole] = useState<Role>("viewer");
  const [credits, setCredits] = useState(0);
  const [channel, setChannel] = useState<ReturnType<typeof supabase.channel> | null>(null);

  const identity = useMemo(() => {
    if (!user) return null;
    return {
      sign: SIGNS[Math.floor(Math.random() * SIGNS.length)],
      number: Math.floor(1000 + Math.random() * 8999),
      joined_at: Date.now(),
      user_id: user.id,
    };
  }, [user]);

  useEffect(() => {
    if (!user || !identity || mode !== "viewer") return;
    const ch = supabase.channel("live-room", {
      config: { presence: { key: user.id } },
    });

    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState<Peer>();
      const flat = Object.values(state).flat() as Peer[];
      setPeers(flat.sort((a, b) => a.joined_at - b.joined_at));
    }).subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await ch.track({ ...identity, role: "viewer", credits: 0 } as Peer);
      }
    });

    setChannel(ch);
    return () => {
      ch.unsubscribe();
      setChannel(null);
    };
  }, [user, identity, mode]);

  useEffect(() => {
    if (!channel || !identity) return;
    channel.track({ ...identity, role, credits } as Peer);
  }, [role, credits, channel, identity]);

  const broadcasters = peers.filter((p) => p.role === "broadcaster");
  const viewers = peers.filter((p) => p.role === "viewer");
  const featured = broadcasters[0];

  const sendCredit = () => {
    if (!featured || featured.user_id === user?.id) return;
    setCredits((c) => c + 1);
    channel?.send({
      type: "broadcast",
      event: "credit",
      payload: { to: featured.user_id, from: user?.id },
    });
  };

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  // Mode picker
  if (!mode) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 shadow-lg"
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Radio className="h-4 w-4" /> Live entry
          </div>
          <h1 className="mt-2 font-display text-2xl font-semibold">How are you joining?</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick your seat. Terms are temporary — no assurance is given on ride-interfaces.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <button
              onClick={() => setMode("viewer")}
              className="group rounded-xl border border-border bg-background p-5 text-left hover:border-primary hover:bg-primary/5 transition"
            >
              <Eye className="h-5 w-5 text-primary" />
              <div className="mt-3 font-medium">Viewer</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Join the audio + audience session in progress.
              </div>
            </button>
            <button
              onClick={() => setMode("previewer")}
              className="group rounded-xl border border-border bg-background p-5 text-left hover:border-primary hover:bg-primary/5 transition"
            >
              <Film className="h-5 w-5 text-primary" />
              <div className="mt-3 font-medium">Previewer</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Movie-call, audio test, lyrics, terminal test, Q&amp;A and FAQ.
              </div>
            </button>
            <button
              onClick={() => setMode("channels")}
              className="group rounded-xl border border-border bg-background p-5 text-left hover:border-primary hover:bg-primary/5 transition"
            >
              <MessageSquare className="h-5 w-5 text-primary" />
              <div className="mt-3 font-medium">Channels</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Browse previewer channels, request a movie-call, open a call space with cinephile AI.
              </div>
            </button>
          </div>
          <Link to="/" className="mt-6 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> Back home
          </Link>
        </motion.div>
      </div>
    );
  }

  if (mode === "previewer") {
    return <Previewer onLeave={() => setMode(null)} />;
  }

  if (mode === "channels") {
    return <Channels onLeave={() => setMode(null)} />;
  }

  // Viewer / audience session
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-40">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <button onClick={() => setMode(null)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Switch
          </button>
          <div className="flex items-center gap-2">
            <motion.span
              className="inline-block h-2 w-2 rounded-full bg-destructive"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            />
            <span className="font-display text-lg font-semibold">Audience Session</span>
            <Radio className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Mic className="h-3 w-3" />{broadcasters.length}</span>
            <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{viewers.length}</span>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-6 pt-10">
        <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card to-muted">
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {featured ? (
              <motion.div key={featured.user_id} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center">
                <div className="text-7xl">{featured.sign}</div>
                <div className="mt-3 font-mono text-2xl font-bold">#{featured.number}</div>
                <div className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">on stage</div>
              </motion.div>
            ) : (
              <div className="text-center text-muted-foreground">
                <Radio className="mx-auto mb-3 h-8 w-8 opacity-50" />
                <p className="text-sm">No one is broadcasting. Tap below to go live.</p>
              </div>
            )}
          </div>
          {featured && (
            <div className="absolute bottom-3 right-3 rounded-full bg-background/80 px-3 py-1 text-xs backdrop-blur">
              {featured.credits} credits
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          {role === "viewer" ? (
            <button onClick={() => setRole("broadcaster")} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              <Mic className="h-4 w-4" /> Go live
            </button>
          ) : (
            <button onClick={() => setRole("viewer")} className="inline-flex items-center gap-2 rounded-full bg-secondary px-5 py-2 text-sm font-medium hover:bg-secondary/80">
              <Eye className="h-4 w-4" /> Step down
            </button>
          )}
          {featured && featured.user_id !== user.id && (
            <button onClick={sendCredit} className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2 text-sm font-medium hover:bg-accent">
              <Hand className="h-4 w-4" /> Credit the act
            </button>
          )}
        </div>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          One stage. Everyone equal. Credit is in the action — not the wallet.
        </p>
      </section>

      <section className="mx-auto max-w-4xl px-6 pb-20 pt-10">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Audience ({viewers.length})
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          <AnimatePresence>
            {viewers.map((p) => (
              <motion.div
                key={p.user_id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className={`flex items-center gap-3 rounded-xl border p-3 ${
                  p.user_id === user.id ? "border-primary bg-primary/5" : "border-border bg-card"
                }`}
              >
                <span className="text-xl">{p.sign}</span>
                <span className="font-mono text-sm">#{p.number}</span>
                {p.user_id === user.id && <span className="ml-auto text-[10px] text-primary">you</span>}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </section>
    </div>
  );
}

function Previewer({ onLeave }: { onLeave: () => void }) {
  const { user } = useAuth();
  const [audioOk, setAudioOk] = useState<null | boolean>(null);
  const [termInput, setTermInput] = useState("");
  const [termLog, setTermLog] = useState<string[]>([
    "preview-shell v0.1 — temporary session, no assurances.",
    'try: "ping", "echo hi", "whoami", "clear"',
  ]);
  const [frame, setFrame] = useState<"white" | "black">("white");
  const [emergency, setEmergency] = useState(false);
  type LyricRow = { id: string; name: string; title: string | null; body: string };
  const [customLyrics, setCustomLyrics] = useState<LyricRow[]>([]);
  const [showLyricForm, setShowLyricForm] = useState(false);
  const [lyricName, setLyricName] = useState("");
  const [lyricTitle, setLyricTitle] = useState("");
  const [lyricBody, setLyricBody] = useState("");

  // Recommendations — built-ins + previewer's own (persisted)
  const builtinRecs = [
    "Frame steady, eye-line center",
    "One light, one mic, no overlay",
    "Speak before you reveal",
    "Off-letter / new-Parablox: leave the script",
  ];
  type RecRow = { id: string; label: string };
  const [customRecs, setCustomRecs] = useState<RecRow[]>([]);
  const [recDraft, setRecDraft] = useState("");

  // Saved brand payloads (persisted)
  type BrandRow = { id: string; brand_name: string | null; brand_appeal: string | null; brand_self: string | null; api_link: string | null; api_seed: number | null; created_at: string };
  const [savedPayloads, setSavedPayloads] = useState<BrandRow[]>([]);

  // Brainstorm /chat — same backend (prompt-ai), token-aware, RAG/collection tags
  type BrainMsg = { role: "user" | "assistant"; content: string };
  const [brainMsgs, setBrainMsgs] = useState<BrainMsg[]>([]);
  const [brainInput, setBrainInput] = useState("");
  const [brainBusy, setBrainBusy] = useState(false);
  const [brainTags] = useState(["pml", "ppl", "l-si", "CI-clang", "CD-Outlet", "rag:collection"]);

  // 500-word session hold: when the brain input crosses ~500 words the form
  // is held, FAQ/inbox dim, and only a tokenized retrieval (wallet spend)
  // can release it. Light haptic on lock + release.
  const HOLD_THRESHOLD = 500;
  const HOLD_RELEASE_COST = 25;
  const brainWords = brainInput.trim() ? brainInput.trim().split(/\s+/).length : 0;
  const [sessionHeld, setSessionHeld] = useState(false);
  const [releasing, setReleasing] = useState(false);
  useEffect(() => {
    if (brainWords >= HOLD_THRESHOLD && !sessionHeld) {
      setSessionHeld(true);
      if (navigator.vibrate) navigator.vibrate([30, 20, 60]);
      toast("Session hold engaged", { description: `≥ ${HOLD_THRESHOLD} words · spend ${HOLD_RELEASE_COST} tokens to release` });
    }
  }, [brainWords, sessionHeld]);
  const releaseHold = async () => {
    if (releasing) return;
    setReleasing(true);
    try {
      const { error } = await supabase.rpc("spend_tokens", {
        p_tokens: HOLD_RELEASE_COST,
        p_reason: "previewer:session-hold-release",
      });
      if (error) throw error;
      if (navigator.vibrate) navigator.vibrate(20);
      setSessionHeld(false);
      toast.success("Hold released", { description: `${HOLD_RELEASE_COST} tokens spent` });
    } catch (e) {
      toast.error("Release failed", { description: e instanceof Error ? e.message : "insufficient tokens?" });
    } finally {
      setReleasing(false);
    }
  };

  // Viewer-activity spy: pending requests from viewers across this previewer's channels.
  type ViewerPing = { id: string; story_plot: string; suggested_role: string; created_at: string };
  const [viewerPings, setViewerPings] = useState<ViewerPing[]>([]);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("live_call_requests")
        .select("id,story_plot,suggested_role,created_at")
        .eq("previewer_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(8);
      if (!cancelled && data) setViewerPings(data as ViewerPing[]);
    };
    load();
    const ch = supabase
      .channel("previewer-spy")
      .on("postgres_changes", { event: "*", schema: "public", table: "live_call_requests", filter: `previewer_id=eq.${user.id}` }, load)
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [user]);

  // API formatter — brand({name, name_appeal, self-services}) → preview-side generator link
  const irand = (lo: number, hi: number) => Math.floor(Math.random() * (hi - lo + 1)) + lo;
  const [brandName, setBrandName] = useState("");
  const [brandAppeal, setBrandAppeal] = useState("");
  const [brandSelf, setBrandSelf] = useState("");
  const [apiSeed, setApiSeed] = useState(() => irand(666, 9999));
  const apiSlug = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "untitled";
  const apiLink = `preview://brand/${apiSlug(brandName)}/${apiSlug(brandAppeal)}/${apiSlug(brandSelf)}?match=live-db,vm-spaces,sessions-active&pct=${apiSeed}`;
  const apiPayload = {
    brand: { name: brandName, name_appeal: brandAppeal, "self-services": brandSelf },
    "generator-link": apiLink,
    match: ["live-Db", "Vm-spaces", "Sessions-active"],
    "%": apiSeed,
    purpose: ["brand-recruitments", "bank-account-details", "model-set-policies"],
    regex: { call: "/GI|Generative/i" },
    "accept.call": "policy-provisional",
    "scroll()": "public",
    selection: "alternatives",
    consent: "previewer-manual-paste-only",
    routing: "Viewership-membrane :: admin/security-spaces",
  };
  const copyApi = async () => {
    try { await navigator.clipboard.writeText(JSON.stringify(apiPayload, null, 2)); toast.success("API payload copied"); }
    catch { toast.error("Copy failed"); }
  };

  // Viewership membrane — previewer must paste the call to activate the vm-space
  const [membranePaste, setMembranePaste] = useState("");
  const [membraneActive, setMembraneActive] = useState(false);
  const activateMembrane = () => {
    const ok = membranePaste.trim().includes(apiSlug(brandName) || "untitled") || membranePaste.includes(String(apiSeed));
    if (!ok) { toast.error("Paste does not match an active call space"); return; }
    setMembraneActive(true);
    toast.success("Viewership membrane: call accepted (policy-provisional)");
  };

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  // Wipe in-flight session UI on screen-off (persisted data is reloaded from DB on next mount)
  const wipe = () => {
    setTermLog([]);
    setTermInput("");
    setBrainInput("");
    const c = canvasRef.current;
    if (c) c.getContext("2d")?.clearRect(0, 0, c.width, c.height);
  };
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === "hidden") wipe(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      wipe();
    };
  }, []);

  // Load previewer's persisted gardens (brain, lyrics, recommendations, brand payloads)
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const [b, l, r, p] = await Promise.all([
        supabase.from("previewer_brain_messages").select("role,content").order("created_at", { ascending: true }),
        supabase.from("previewer_lyrics").select("id,name,title,body").order("created_at", { ascending: false }),
        supabase.from("previewer_recommendations").select("id,label").order("created_at", { ascending: false }),
        supabase.from("previewer_brand_payloads").select("id,brand_name,brand_appeal,brand_self,api_link,api_seed,created_at").order("created_at", { ascending: false }).limit(20),
      ]);
      if (cancelled) return;
      if (b.data) setBrainMsgs(b.data.map((d) => ({ role: d.role as "user" | "assistant", content: d.content })));
      if (l.data) setCustomLyrics(l.data as LyricRow[]);
      if (r.data) setCustomRecs(r.data as RecRow[]);
      if (p.data) setSavedPayloads(p.data as BrandRow[]);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const testAudio = async () => {
    try {
      const Ctx = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
      const ctx = new Ctx();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      g.gain.value = 0.05;
      o.frequency.value = 440;
      o.connect(g).connect(ctx.destination);
      o.start();
      setTimeout(() => { o.stop(); ctx.close(); }, 350);
      setAudioOk(true);
    } catch {
      setAudioOk(false);
    }
  };

  const runTerm = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = termInput.trim();
    if (!cmd) return;
    let out = "";
    if (cmd === "clear") { setTermLog([]); setTermInput(""); return; }
    else if (cmd === "ping") out = "pong (≈12ms, no SLA)";
    else if (cmd.startsWith("echo ")) out = cmd.slice(5);
    else if (cmd === "whoami") out = "previewer — temporary registration";
    else out = `command not found: ${cmd}`;
    setTermLog((l) => [...l, `$ ${cmd}`, out]);
    setTermInput("");
  };

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawing.current = true;
    last.current = pos(e);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const moveDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !last.current) return;
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    const p = pos(e);
    ctx.strokeStyle = frame === "white" ? "#000" : "#fff";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  };
  const endDraw = () => { drawing.current = false; last.current = null; };
  const clearBoard = () => {
    const c = canvasRef.current; if (!c) return;
    c.getContext("2d")?.clearRect(0, 0, c.width, c.height);
  };

  const triggerEmergency = () => {
    setEmergency(true);
    toast.error("Emergency alert raised — viewership owner notified.", {
      description: "Ownership change requires ≥ 4,000,000,000,000 strategic credits.",
    });
    setTimeout(() => setEmergency(false), 4000);
  };

  const sendBrain = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = brainInput.trim();
    if (!text || brainBusy) return;
    const next: BrainMsg[] = [...brainMsgs, { role: "user", content: text }];
    setBrainMsgs(next);
    setBrainInput("");
    setBrainBusy(true);
    // persist user msg (fire and forget)
    if (user) supabase.from("previewer_brain_messages").insert({ user_id: user.id, role: "user", content: text }).then(() => {});
    try {
      const { data, error } = await supabase.functions.invoke("prompt-ai", {
        body: {
          messages: [
            {
              role: "system",
              content:
                "You are a brainstorming partner inside a temporary previewer session. Tone: musical-awareness, static-code & code-dynamics, tethered self-info. Tag ideas with [pml] [ppl] [l-si] [CI-clang] [CD-Outlet] when relevant. Treat retrieval as RAG:collection. Be concise.",
            },
            ...next.map((m) => ({ role: m.role, content: m.content })),
          ],
        },
      });
      if (error) throw error;
      const reply = (data as { reply?: string; error?: string })?.reply ?? "";
      if (!reply) throw new Error((data as { error?: string })?.error || "no reply");
      setBrainMsgs((m) => [...m, { role: "assistant", content: reply }]);
      if (user) supabase.from("previewer_brain_messages").insert({ user_id: user.id, role: "assistant", content: reply }).then(() => {});
    } catch (err) {
      toast.error("Brainstorm unavailable", {
        description: err instanceof Error ? err.message : "try again shortly",
      });
      setBrainMsgs((m) => m.slice(0, -1));
      setBrainInput(text);
    } finally {
      setBrainBusy(false);
    }
  };

  const lyrics = [
    "Frame-pour, letter-references, IOP",
    "Onset, drive — auto.bahn, creamy layer-call",
    "New-grand, new-miss, new-miss-drive",
    "Crowd-source the chorus; the chorus is you",
  ];

  const faq = [
    { q: "Is my preview saved?", a: "No. Terms are temporary — sessions don't persist." },
    { q: "Can I be billed here?", a: "No. Previewer mode is observational; no rides, no charges." },
    { q: "Will I appear in the audience?", a: "Not while previewing. Switch to viewer to join." },
  ];

  const leave = () => { wipe(); onLeave(); };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-40">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <button onClick={leave} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Switch
          </button>
          <div className="flex items-center gap-2">
            <Film className="h-4 w-4" />
            <span className="font-display text-lg font-semibold">Previewer</span>
          </div>
          <button
            onClick={triggerEmergency}
            className="inline-flex items-center gap-1 rounded-full border border-destructive/40 px-3 py-1 text-xs text-destructive hover:bg-destructive/10"
          >
            <AlertTriangle className="h-3 w-3" /> Emergency
          </button>
        </div>
        {emergency && (
          <div className="bg-destructive/10 text-destructive text-center text-xs py-1">
            Alert dispatched — owner-only viewership. Contact requires strategic threshold.
          </div>
        )}
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10 space-y-8">
        {/* Whiteboard — new_open(.pen, classics) */}
        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium"><Pencil className="h-4 w-4" /> Virtual Board</div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFrame(frame === "white" ? "black" : "white")}
                className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
              >
                Frame: {frame}
              </button>
              <button onClick={clearBoard} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent">
                <Eraser className="h-3 w-3" /> Clear
              </button>
            </div>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Pen · classics. Agreement = Black-Bird, Features = migrations. Rebase. = Function(). &nbsp; Board empties on screen-off.</p>
          <div className={`mt-3 rounded-xl border border-border overflow-hidden ${frame === "white" ? "bg-white" : "bg-black"}`}>
            <canvas
              ref={canvasRef}
              width={900}
              height={420}
              onPointerDown={startDraw}
              onPointerMove={moveDraw}
              onPointerUp={endDraw}
              onPointerLeave={endDraw}
              className="block w-full touch-none cursor-crosshair"
              style={{ height: 320 }}
            />
          </div>
        </section>

        {/* Movie-call + recommendations */}
        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-2 text-sm font-medium"><Film className="h-4 w-4" /> Movie-call</div>
          <MovieCall userId={user?.id ?? null} />


          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-background p-3">
              <div className="flex items-center justify-between">
                <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Recommendations</div>
              </div>
              <ul className="mt-2 space-y-1 text-xs">
                {builtinRecs.map((l, i) => <li key={i}>· {l}</li>)}
                {customRecs.map((r) => (
                  <li key={r.id} className="flex items-center gap-2 group">
                    <span className="flex-1">· {r.label}</span>
                    <button
                      onClick={async () => {
                        await supabase.from("previewer_recommendations").delete().eq("id", r.id);
                        setCustomRecs((a) => a.filter((x) => x.id !== r.id));
                      }}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                      aria-label="Remove"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const text = recDraft.trim();
                  if (!text || !user) return;
                  const { data, error } = await supabase
                    .from("previewer_recommendations")
                    .insert({ user_id: user.id, label: text })
                    .select("id,label")
                    .single();
                  if (error) { toast.error("Couldn't save"); return; }
                  setCustomRecs((a) => [data as RecRow, ...a]);
                  setRecDraft("");
                }}
                className="mt-2 flex gap-1"
              >
                <input
                  value={recDraft}
                  onChange={(e) => setRecDraft(e.target.value)}
                  placeholder="add your own…"
                  className="flex-1 rounded-md border border-border bg-card px-2 py-1 text-[11px] focus:outline-none focus:border-primary"
                />
                <button className="rounded-md border border-border bg-card px-2 py-1 text-[11px] hover:bg-accent" aria-label="Add recommendation">
                  <Plus className="h-3 w-3" />
                </button>
              </form>
            </div>
            <div className="rounded-lg border border-border bg-background p-3">
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Specifications · directions</div>
              <dl className="mt-2 grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-xs font-mono">
                <dt className="text-muted-foreground">map</dt><dd>console</dd>
                <dt className="text-muted-foreground">reason</dt><dd>anonymity</dd>
                <dt className="text-muted-foreground">privacy</dt><dd className="text-destructive">insecure()</dd>
                <dt className="text-muted-foreground">letter</dt><dd>off · new-Parablox</dd>
                <dt className="text-muted-foreground">aspect</dt><dd>16:9 · 1080p</dd>
                <dt className="text-muted-foreground">latency</dt><dd>best-effort</dd>
              </dl>
            </div>
          </div>

          <div className="mt-3 rounded-md border border-dashed border-border bg-background/40 p-2 font-mono text-[11px] text-muted-foreground">
            console &gt; map.load("preview"); privacy.set("insecure"); reason="anonymity"; letter.off(); parablox.new();
          </div>
        </section>

        {/* Audio integration test — mic recorder */}
        <MicTest audioOk={audioOk} onTone={testAudio} userId={user?.id ?? null} />


        {/* Lyrics */}
        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium"><Music className="h-4 w-4" /> Lyrical collection</div>
            <button
              onClick={() => setShowLyricForm((v) => !v)}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
              aria-label="Add lyrics or rhythm annotation"
            >
              {showLyricForm ? <><X className="h-3 w-3" /> Close</> : <><Plus className="h-3 w-3" /> Add</>}
            </button>
          </div>
          <ul className="mt-3 space-y-1 text-sm text-muted-foreground font-mono">
            {lyrics.map((l, i) => <li key={i}>· {l}</li>)}
          </ul>

          {customLyrics.length > 0 && (
            <ul className="mt-4 space-y-3">
              {customLyrics.map((c) => (
                <li key={c.id} className="rounded-lg border border-border bg-background p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium">{c.title}</div>
                      <div className="text-[11px] text-muted-foreground">{c.name}</div>
                    </div>
                    <button
                      onClick={async () => {
                        await supabase.from("previewer_lyrics").delete().eq("id", c.id);
                        setCustomLyrics((arr) => arr.filter((x) => x.id !== c.id));
                      }}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Remove"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <pre className="mt-2 whitespace-pre-wrap font-mono text-xs text-foreground/90">{c.body}</pre>
                </li>
              ))}
            </ul>
          )}

          {showLyricForm && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!lyricBody.trim() || !user) return;
                const name = lyricName.trim() || `take-${customLyrics.length + 1}`;
                const title = lyricTitle.trim() || "Untitled rhythm";
                const { data, error } = await supabase
                  .from("previewer_lyrics")
                  .insert({ user_id: user.id, name, title, body: lyricBody, kind: "lyric" })
                  .select("id,name,title,body")
                  .single();
                if (error) { toast.error("Couldn't save lyric"); return; }
                setCustomLyrics((arr) => [data as LyricRow, ...arr]);
                setLyricName(""); setLyricTitle(""); setLyricBody("");
                setShowLyricForm(false);
              }}
              className="mt-4 space-y-2 rounded-lg border border-dashed border-border bg-background/40 p-3"
            >
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  value={lyricName}
                  onChange={(e) => setLyricName(e.target.value)}
                  placeholder="file name"
                  className="rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:border-primary"
                />
                <input
                  value={lyricTitle}
                  onChange={(e) => setLyricTitle(e.target.value)}
                  placeholder="title"
                  className="rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:border-primary"
                />
              </div>
              <textarea
                value={lyricBody}
                onChange={(e) => setLyricBody(e.target.value)}
                placeholder="lyrics or rhythm annotation…"
                rows={5}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 font-mono text-xs focus:outline-none focus:border-primary"
              />
              <div className="flex justify-end">
                <button className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90">
                  <Save className="h-3 w-3" /> Save
                </button>
              </div>
            </form>
          )}
        </section>

        {/* Terminal */}
        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-2 text-sm font-medium"><Terminal className="h-4 w-4" /> Terminal test</div>
          <div className="mt-3 rounded-lg bg-background border border-border p-3 font-mono text-xs h-48 overflow-auto">
            {termLog.map((line, i) => <div key={i} className="whitespace-pre-wrap">{line}</div>)}
          </div>
          <form onSubmit={runTerm} className="mt-2 flex gap-2">
            <span className="font-mono text-sm text-muted-foreground self-center">$</span>
            <input
              value={termInput}
              onChange={(e) => setTermInput(e.target.value)}
              className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 font-mono text-sm focus:outline-none focus:border-primary"
              placeholder="type a command…"
            />
            <button className="rounded-md bg-secondary px-3 py-1.5 text-sm hover:bg-secondary/80">run</button>
          </form>
        </section>

        {/* Brainstorm /chat — same backend, AI ideation, RAG:collection */}
        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="h-4 w-4" /> /chat · brainstorm
            </div>
            <div className="flex flex-wrap gap-1">
              {brainTags.map((t) => (
                <span key={t} className="rounded-md border border-border bg-background/40 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                  {t}
                </span>
              ))}
            </div>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Same back-end as DM tokens · retrieval-rag : collection · touch pml/ppl/l-si · CI-clang · CD-Outlet. Session-only, wiped on screen-off.
          </p>
          <div className="mt-3 rounded-lg bg-background border border-border p-3 h-56 overflow-auto space-y-2 text-sm">
            {brainMsgs.length === 0 ? (
              <div className="text-xs text-muted-foreground font-mono">
                idea? type below — informational musics awareness, static-code, code-dynamics, tethered-self.
              </div>
            ) : (
              brainMsgs.map((m, i) => (
                <div key={i} className={m.role === "user" ? "text-foreground" : "text-muted-foreground"}>
                  <span className="font-mono text-[10px] mr-2 opacity-60">{m.role === "user" ? "self>" : "ai>"}</span>
                  <span className="whitespace-pre-wrap">{m.content}</span>
                </div>
              ))
            )}
            {brainBusy && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> thinking…
              </div>
            )}
          </div>
          <form onSubmit={sendBrain} className="mt-2 flex gap-2">
            <input
              value={brainInput}
              onChange={(e) => setBrainInput(e.target.value)}
              disabled={brainBusy}
              className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:border-primary disabled:opacity-50"
              placeholder="brainstorm an idea…"
            />
            <button
              disabled={brainBusy || !brainInput.trim()}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              <Send className="h-3 w-3" /> send
            </button>
          </form>
        </section>

        {/* API formatter — preview-side generator link */}
        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Link2 className="h-4 w-4" /> API · #formatter · brand()
            </div>
            <div className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground">
              <span className="rounded-md border border-border bg-background/40 px-1.5 py-0.5">match: live-Db</span>
              <span className="rounded-md border border-border bg-background/40 px-1.5 py-0.5">Vm-spaces</span>
              <span className="rounded-md border border-border bg-background/40 px-1.5 py-0.5">Sessions-active</span>
            </div>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Payload scope: brand-recruitments · bank-account details · model-set policies · regex.call = <code className="font-mono">/GI|Generative/i</code> · accept.call = <code className="font-mono">policy-provisional</code> · scroll() = public · selection = alternatives. % = irand(666, 9999), session-only.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <input value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="name"
              className="rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:border-primary" />
            <input value={brandAppeal} onChange={(e) => setBrandAppeal(e.target.value)} placeholder="name_appeal"
              className="rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:border-primary" />
            <input value={brandSelf} onChange={(e) => setBrandSelf(e.target.value)} placeholder="self-services"
              className="rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:border-primary" />
          </div>
          <div className="mt-3 rounded-lg bg-background border border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <code className="text-xs font-mono break-all text-foreground">{apiLink}</code>
              <span className="shrink-0 rounded-md border border-border bg-background/40 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">% {apiSeed}</span>
            </div>
            <pre className="mt-2 text-[11px] font-mono text-muted-foreground overflow-auto">{JSON.stringify(apiPayload, null, 2)}</pre>
          </div>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => setApiSeed(irand(666, 9999))}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:bg-accent">
              <RefreshCw className="h-3 w-3" /> regenerate %
            </button>
            <button type="button" onClick={copyApi}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:opacity-90">
              <Copy className="h-3 w-3" /> copy payload
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!user) return;
                const { data, error } = await supabase
                  .from("previewer_brand_payloads")
                  .insert({
                    user_id: user.id,
                    brand_name: brandName || null,
                    brand_appeal: brandAppeal || null,
                    brand_self: brandSelf || null,
                    api_link: apiLink,
                    api_seed: apiSeed,
                    payload: apiPayload,
                  })
                  .select("id,brand_name,brand_appeal,brand_self,api_link,api_seed,created_at")
                  .single();
                if (error) { toast.error("Save failed"); return; }
                setSavedPayloads((a) => [data as BrandRow, ...a]);
                toast.success("Brand payload saved");
              }}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:bg-accent">
              <Save className="h-3 w-3" /> save payload
            </button>
          </div>

          {savedPayloads.length > 0 && (
            <div className="mt-3 rounded-lg border border-border bg-background/40 p-3">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Saved frame-letters</div>
              <ul className="mt-2 space-y-1 text-[11px] font-mono">
                {savedPayloads.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 group">
                    <button
                      onClick={() => {
                        setBrandName(p.brand_name || "");
                        setBrandAppeal(p.brand_appeal || "");
                        setBrandSelf(p.brand_self || "");
                        if (p.api_seed) setApiSeed(p.api_seed);
                      }}
                      className="flex-1 text-left truncate text-foreground/90 hover:text-primary"
                    >
                      · {p.brand_name || "untitled"} <span className="text-muted-foreground">% {p.api_seed}</span>
                    </button>
                    <button
                      onClick={async () => {
                        await supabase.from("previewer_brand_payloads").delete().eq("id", p.id);
                        setSavedPayloads((a) => a.filter((x) => x.id !== p.id));
                      }}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                      aria-label="Remove"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Viewership membrane — manual paste gate */}
          <div className="mt-4 rounded-lg border border-border bg-background/40 p-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium">Viewership membrane · active call space</div>
              <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-mono ${membraneActive ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"}`}>
                {membraneActive ? "ACCEPTED" : "idle"}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Previewer-consented vm-space. Activates only when you manually paste the call below — no auto-routing.
            </p>
            <div className="mt-2 flex gap-2">
              <input value={membranePaste} onChange={(e) => setMembranePaste(e.target.value)} placeholder="paste generator-link or % seed"
                className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-primary" />
              <button type="button" onClick={activateMembrane}
                className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:opacity-90">
                accept call
              </button>
            </div>
          </div>

          {/* Admin / safeguards notice */}
          <div className="mt-3 rounded-lg border border-border bg-background/40 p-3 text-[11px] text-muted-foreground space-y-1">
            <div className="flex items-center gap-1 text-foreground"><AlertTriangle className="h-3 w-3" /> Admin-representative section · restricted</div>
            <div>Back-end admin/security spaces handle abuse-detection, cyber-fail/faulted-scale checks, deep-morphology probes (pixel-manipulation, IP records).</div>
            <div>No screen-recording (previewer privacy-protection policy). Clients are coded; codes claim only on on-screen action sequences. Local pixel-frequency deltas feed traffic/input telemetry.</div>
            <div>Logged-in users pass active model-representation + character-complexity encoding to refactor each session. This pane is not exposed to end users.</div>
          </div>
        </section>


        {/* FAQ / Q&A */}
        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-2 text-sm font-medium"><HelpCircle className="h-4 w-4" /> Q&amp;A · FAQ</div>
          <ul className="mt-3 space-y-3">
            {faq.map((f, i) => (
              <li key={i}>
                <div className="text-sm font-medium">{f.q}</div>
                <div className="text-xs text-muted-foreground">{f.a}</div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[11px] text-muted-foreground">
            Disclaimer: Terms and registration are always temporary. No assurance is given on ride-interfaces.
            Ownership-change requests require ≥ 4,000,000,000,000 strategic credits.
          </p>
        </section>
      </main>
    </div>
  );
}

type Recording = { id?: string; blob?: Blob; url: string; durationMs: number; mime: string; name?: string; title?: string; storage_path?: string };

function MicTest({ audioOk, onTone, userId }: { audioOk: null | boolean; onTone: () => void; userId: string | null }) {
  const [supported, setSupported] = useState<boolean>(true);
  const [permError, setPermError] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "recording" | "paused" | "stopped">("idle");
  const [elapsed, setElapsed] = useState(0); // ms
  const [recording, setRecording] = useState<Recording | null>(null);
  const [playing, setPlaying] = useState(false);
  const [showSave, setShowSave] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveTitle, setSaveTitle] = useState("");
  const [saved, setSaved] = useState<Recording[]>([]);
  const [savingTake, setSavingTake] = useState(false);

  // Load persisted recordings for this previewer
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("previewer_recordings")
        .select("id,name,title,storage_path,duration_seconds,mime_type")
        .order("created_at", { ascending: false });
      if (cancelled || !data) return;
      const rows = await Promise.all(
        data.map(async (r) => {
          const { data: signed } = await supabase.storage
            .from("previewer-audio")
            .createSignedUrl(r.storage_path, 60 * 60);
          return {
            id: r.id,
            url: signed?.signedUrl || "",
            durationMs: (r.duration_seconds || 0) * 1000,
            mime: r.mime_type || "audio/webm",
            name: r.name,
            title: r.title || r.name,
            storage_path: r.storage_path,
          } as Recording;
        })
      );
      setSaved(rows);
    })();
    return () => { cancelled = true; };
  }, [userId]);


  const mediaRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedAt = useRef<number>(0);
  const tickRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && !!navigator.mediaDevices && typeof MediaRecorder !== "undefined");
    return () => {
      stopTick();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (recording) URL.revokeObjectURL(recording.url);
      playCtxRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startTick = () => {
    stopTick();
    tickRef.current = window.setInterval(() => {
      setElapsed(Date.now() - startedAt.current);
    }, 100);
  };
  const stopTick = () => {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
  };

  const installDriver = async () => {
    setPermError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        const url = URL.createObjectURL(blob);
        setRecording({ blob, url, durationMs: Date.now() - startedAt.current, mime: blob.type });
        setState("stopped");
        stopTick();
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };
      mediaRef.current = mr;
      startedAt.current = Date.now();
      setElapsed(0);
      if (recording) { URL.revokeObjectURL(recording.url); setRecording(null); }
      mr.start(100);
      setState("recording");
      startTick();
      onTone();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "permission denied";
      setPermError(msg);
      toast.error("Mic driver kit failed", { description: msg });
    }
  };

  const pause = () => {
    const mr = mediaRef.current; if (!mr) return;
    if (state === "recording") { mr.pause(); stopTick(); setState("paused"); }
    else if (state === "paused") {
      // resume — adjust startedAt to preserve elapsed
      startedAt.current = Date.now() - elapsed;
      mr.resume(); startTick(); setState("recording");
    }
  };

  const stop = () => {
    const mr = mediaRef.current; if (!mr || mr.state === "inactive") return;
    mr.stop();
  };

  const replay = async () => {
    if (!recording) return;
    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
      return;
    }
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = playCtxRef.current ?? new Ctx();
      playCtxRef.current = ctx;
      const audio = new Audio(recording.url);
      audioRef.current = audio;
      const src = ctx.createMediaElementSource(audio);
      // dry
      const dry = ctx.createGain(); dry.gain.value = 0.85;
      // reverb via convolver with synthetic impulse
      const convolver = ctx.createConvolver();
      const sr = ctx.sampleRate;
      const len = Math.floor(sr * 1.8);
      const impulse = ctx.createBuffer(2, len, sr);
      for (let ch = 0; ch < 2; ch++) {
        const data = impulse.getChannelData(ch);
        for (let i = 0; i < len; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5);
        }
      }
      convolver.buffer = impulse;
      const wet = ctx.createGain(); wet.gain.value = 0.55;
      src.connect(dry).connect(ctx.destination);
      src.connect(convolver).connect(wet).connect(ctx.destination);
      audio.onended = () => setPlaying(false);
      await audio.play();
      setPlaying(true);
    } catch (err) {
      toast.error("Replay failed", { description: err instanceof Error ? err.message : "unknown" });
    }
  };

  const discard = () => {
    if (recording) URL.revokeObjectURL(recording.url);
    setRecording(null);
    setState("idle");
    setElapsed(0);
    setPlaying(false);
    audioRef.current?.pause();
  };

  const askKeep = () => {
    setSaveName(`take-${saved.length + 1}`);
    setSaveTitle("");
    setShowSave(true);
  };

  const confirmSave = async () => {
    if (!recording || !recording.blob) return;
    const name = saveName.trim() || `take-${saved.length + 1}`;
    const title = saveTitle.trim() || name;
    if (!userId) {
      // fallback: keep locally
      setSaved((s) => [...s, { ...recording, name, title }]);
      toast.success(`Saved "${title}" (local only)`);
      setShowSave(false); setRecording(null); setState("idle"); setElapsed(0);
      return;
    }
    setSavingTake(true);
    try {
      const ext = (recording.mime.split("/")[1] || "webm").split(";")[0];
      const path = `${userId}/${Date.now()}-${name.replace(/[^a-z0-9-_]/gi, "_")}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("previewer-audio")
        .upload(path, recording.blob, { contentType: recording.mime, upsert: false });
      if (upErr) throw upErr;
      const { data: row, error: insErr } = await supabase
        .from("previewer_recordings")
        .insert({
          user_id: userId,
          name,
          title,
          storage_path: path,
          duration_seconds: Math.round(recording.durationMs / 1000),
          mime_type: recording.mime,
        })
        .select("id")
        .single();
      if (insErr) throw insErr;
      const { data: signed } = await supabase.storage.from("previewer-audio").createSignedUrl(path, 60 * 60);
      setSaved((s) => [{ ...recording, id: row?.id, name, title, storage_path: path, url: signed?.signedUrl || recording.url }, ...s]);
      toast.success(`Saved "${title}"`, { description: `${name} · ${(recording.blob.size / 1024).toFixed(1)} KB` });
      setShowSave(false); setRecording(null); setState("idle"); setElapsed(0);
    } catch (err) {
      toast.error("Save failed", { description: err instanceof Error ? err.message : "unknown" });
    } finally {
      setSavingTake(false);
    }
  };

  const fmt = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const r = s % 60;
    const cs = Math.floor((ms % 1000) / 100);
    return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}.${cs}`;
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium"><Mic className="h-4 w-4" /> Audio integration test</div>
        <div className="flex items-center gap-2 text-[11px]">
          {audioOk === true && <span className="text-green-500">tone ok</span>}
          {audioOk === false && <span className="text-destructive">tone blocked</span>}
          <span className="text-muted-foreground">· mic-driver-kit v0.1</span>
        </div>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Run-test installs the mic driver kit, asks permission, and records. Pause / stop / replay with reverb, then discard or keep.
      </p>

      {!supported && (
        <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
          MediaRecorder unsupported in this browser.
        </div>
      )}
      {permError && (
        <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
          {permError}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {state === "idle" && (
          <button
            onClick={installDriver}
            disabled={!supported}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Mic className="h-4 w-4" /> Run test
          </button>
        )}

        {(state === "recording" || state === "paused") && (
          <>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 font-mono text-sm">
              <motion.span
                className={`h-2.5 w-2.5 rounded-full ${state === "recording" ? "bg-destructive" : "bg-muted-foreground"}`}
                animate={state === "recording" ? { opacity: [1, 0.2, 1], scale: [1, 1.25, 1] } : { opacity: 0.6 }}
                transition={{ duration: 1, repeat: Infinity }}
              />
              <span>{fmt(elapsed)}</span>
            </div>
            <button onClick={pause} className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-sm hover:bg-accent">
              {state === "recording" ? <><Pause className="h-4 w-4" /> Pause</> : <><Circle className="h-4 w-4" /> Resume</>}
            </button>
            <button onClick={stop} className="inline-flex items-center gap-1 rounded-full bg-destructive px-3 py-1.5 text-sm text-destructive-foreground hover:bg-destructive/90">
              <Square className="h-4 w-4" /> Stop
            </button>
          </>
        )}

        {state === "stopped" && recording && (
          <>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 font-mono text-sm">
              <span className="text-muted-foreground">len</span>
              <span>{fmt(recording.durationMs)}</span>
            </div>
            <button onClick={replay} className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90">
              {playing ? <><Pause className="h-4 w-4" /> Pause</> : <><RotateCcw className="h-4 w-4" /> Replay + reverb</>}
            </button>
            <button onClick={askKeep} className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-sm hover:bg-accent">
              <Save className="h-4 w-4" /> Keep
            </button>
            <button onClick={discard} className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-sm hover:bg-accent">
              <Trash2 className="h-4 w-4" /> Discard
            </button>
          </>
        )}
      </div>

      {showSave && recording && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 rounded-xl border border-border bg-background p-4"
        >
          <div className="text-sm font-medium">Name this take</div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            File name and a title — both stored locally to this preview session only.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className="text-xs">
              <span className="text-muted-foreground">File name</span>
              <input
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="take-1"
                className="mt-1 w-full rounded-md border border-border bg-card px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
              />
            </label>
            <label className="text-xs">
              <span className="text-muted-foreground">Title</span>
              <input
                value={saveTitle}
                onChange={(e) => setSaveTitle(e.target.value)}
                placeholder="A title for this audio"
                className="mt-1 w-full rounded-md border border-border bg-card px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
              />
            </label>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button onClick={() => setShowSave(false)} className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent">Cancel</button>
            <button onClick={confirmSave} disabled={savingTake} className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-1">{savingTake ? <><Loader2 className="h-3 w-3 animate-spin" /> Saving</> : "Save"}</button>
          </div>
        </motion.div>
      )}

      {saved.length > 0 && (
        <div className="mt-5">
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Saved takes (this session)</div>
          <ul className="mt-2 space-y-2">
            {saved.map((s, i) => (
              <li key={i} className="flex items-center gap-3 rounded-lg border border-border bg-background p-2">
                <Mic className="h-3 w-3 text-primary" />
                <div className="flex-1 min-w-0">
                  <div className="truncate text-sm font-medium">{s.title}</div>
                  <div className="truncate text-[11px] text-muted-foreground font-mono">{s.name} · {fmt(s.durationMs)}{s.blob ? ` · ${(s.blob.size / 1024).toFixed(1)} KB` : ""}</div>
                </div>
                <audio src={s.url} controls className="h-8" />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function MovieCall({ userId }: { userId: string | null }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const [camOn, setCamOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [spkOn, setSpkOn] = useState(true);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shieldRaised, setShieldRaised] = useState(true);

  const stopAll = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const refreshStream = async (cam: boolean, mic: boolean) => {
    stopAll();
    if (!cam && !mic) return;
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: cam, audio: mic });
      streamRef.current = s;
      if (videoRef.current && cam) {
        videoRef.current.srcObject = s;
        videoRef.current.muted = true;
        await videoRef.current.play().catch(() => {});
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Device blocked");
      setCamOn(false); setMicOn(false);
    }
  };

  useEffect(() => () => { stopAll(); recRef.current?.stop(); }, []);

  const toggleCam = async () => { const v = !camOn; setCamOn(v); await refreshStream(v, micOn); };
  const toggleMic = async () => { const v = !micOn; setMicOn(v); await refreshStream(camOn, v); };

  const startRec = () => {
    if (!streamRef.current) { toast.error("Turn on camera or mic first"); return; }
    chunksRef.current = [];
    const mr = new MediaRecorder(streamRef.current, { mimeType: "video/webm" });
    mr.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
    mr.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      const dur = Math.round((Date.now() - startedAtRef.current) / 1000);
      if (!userId) { toast.error("Sign in to save"); return; }
      setBusy(true);
      try {
        const path = `${userId}/movie-${Date.now()}.webm`;
        const up = await supabase.storage.from("previewer-audio").upload(path, blob, { contentType: "video/webm" });
        if (up.error) throw up.error;
        const ins = await supabase.from("previewer_recordings").insert({
          user_id: userId,
          name: `movie-${new Date().toLocaleString()}`,
          title: "Movie-call clip",
          storage_path: path,
          duration_seconds: dur,
          mime_type: "video/webm",
        });
        if (ins.error) throw ins.error;
        toast.success("Clip saved to your gallery");
      } catch (e: any) {
        toast.error(e?.message ?? "Save failed");
      } finally { setBusy(false); }
    };
    recRef.current = mr;
    startedAtRef.current = Date.now();
    mr.start();
    setRecording(true);
  };
  const stopRec = () => { recRef.current?.stop(); setRecording(false); };

  return (
    <div className="mt-3 space-y-3">
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-gradient-to-br from-muted to-background">
        {camOn ? (
          <video ref={videoRef} className="h-full w-full object-cover" playsInline />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
            Standby frame — Camera-On. Audience never sees this feed.
          </div>
        )}
        {recording && (
          <div className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-destructive/90 px-2 py-0.5 text-[10px] font-semibold text-destructive-foreground">
            <Circle className="h-2 w-2 fill-current" /> REC
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={toggleCam} className={`inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs ${camOn ? "bg-primary text-primary-foreground" : "bg-background hover:bg-accent"}`}>
          <Eye className="h-3 w-3" /> Camera {camOn ? "on" : "Camera-On"}
        </button>
        <button onClick={toggleMic} className={`inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs ${micOn ? "bg-primary text-primary-foreground" : "bg-background hover:bg-accent"}`}>
          <Mic className="h-3 w-3" /> Mic {micOn ? "on" : "off"}
        </button>
        <button onClick={() => setSpkOn((v) => !v)} className={`inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs ${spkOn ? "bg-primary text-primary-foreground" : "bg-background hover:bg-accent"}`}>
          <Radio className="h-3 w-3" /> Speaker {spkOn ? "on" : "muted"}
        </button>
        {!recording ? (
          <button onClick={startRec} disabled={busy} className="inline-flex items-center gap-1 rounded-md border border-destructive bg-destructive/10 px-2 py-1 text-xs text-destructive hover:bg-destructive/20 disabled:opacity-50">
            <Circle className="h-3 w-3 fill-current" /> Record
          </button>
        ) : (
          <button onClick={stopRec} className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs hover:bg-accent">
            <Square className="h-3 w-3" /> Stop & save
          </button>
        )}
        {busy && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        <span className="ml-auto inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground">
          <AlertTriangle className="h-3 w-3" /> session-isolated · no audience link
        </span>
      </div>

      <div className="rounded-lg border border-border bg-background/60 p-3 text-[11px] leading-relaxed text-muted-foreground">
        <div className="flex items-center justify-between">
          <div className="font-medium text-foreground">Previewer protection policy</div>
          <button onClick={() => setShieldRaised((v) => !v)} className="rounded-md border border-border px-2 py-0.5 text-[10px] hover:bg-accent">
            shield: {shieldRaised ? "raised" : "lowered"}
          </button>
        </div>
        <ul className="mt-2 space-y-1">
          <li>· Sessions &amp; session-directive guard every Previewer. Audience are consumers of traffic only — zero handshake, zero wireframe.</li>
          <li>· Pour-text from Viewers tagged <span className="font-mono">rage · R-sector · keyboard-ratio · disrespect</span> trips the pull-back strap.</li>
          <li>· Identity vectors (she/he/they/them/binary/non-binary/non-sensual/sensual/romantic/gay/trans) are protected vectors — never audience-facing, never queryable.</li>
          <li>· Lock-on folders open only via greed-derivative payloads, gated by <span className="font-mono">reason · intent · tact</span>.</li>
          <li>· Camera/Mic/Speaker streams stay local; clips persist only in your private gallery (RLS-scoped).</li>
        </ul>
        <pre className="mt-2 whitespace-pre-wrap font-mono text-[10px] text-foreground/80">
{`policy = protect(previewer) {
  audience.connection = null
  on(rage|R-sector|ratio|disrespect) -> pull_back.strap()
  payload.differentiate({ reason, intent, tact })
  shield.${shieldRaised ? "raised" : "lowered"}
}`}
        </pre>
      </div>
    </div>
  );
}
