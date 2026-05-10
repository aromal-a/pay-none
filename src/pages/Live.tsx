import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Radio, ArrowLeft, Mic, Eye, Hand, Film, Music, Terminal, HelpCircle, Pencil, AlertTriangle, Eraser, Play, Pause, Square, RotateCcw, Trash2, Save, Circle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Mode = "viewer" | "previewer";
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
  const [mode, setMode] = useState<Mode | null>(null);
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
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
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
  const [audioOk, setAudioOk] = useState<null | boolean>(null);
  const [termInput, setTermInput] = useState("");
  const [termLog, setTermLog] = useState<string[]>([
    "preview-shell v0.1 — temporary session, no assurances.",
    'try: "ping", "echo hi", "whoami", "clear"',
  ]);
  const [frame, setFrame] = useState<"white" | "black">("white");
  const [emergency, setEmergency] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  // Wipe session on screen-off / tab-hide / unmount (chat-session is temporary)
  const wipe = () => {
    setTermLog([]);
    setTermInput("");
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
            <div className="flex items-center gap-2 text-sm font-medium"><Pencil className="h-4 w-4" /> Virtual whiteboard</div>
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
          <p className="mt-1 text-[11px] text-muted-foreground">Pen · classics. Agreement = black-end. Board empties on screen-off.</p>
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
          <div className="mt-3 aspect-video w-full rounded-xl bg-gradient-to-br from-muted to-background flex items-center justify-center text-muted-foreground text-sm">
            Standby frame — no live feed in preview.
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-background p-3">
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Recommendations</div>
              <ul className="mt-2 space-y-1 text-xs">
                <li>· Frame steady, eye-line center</li>
                <li>· One light, one mic, no overlay</li>
                <li>· Speak before you reveal</li>
                <li>· Off-letter / new-Parablox: leave the script</li>
              </ul>
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
        <MicTest audioOk={audioOk} onTone={testAudio} />


        {/* Lyrics */}
        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-2 text-sm font-medium"><Music className="h-4 w-4" /> Lyrical collection</div>
          <ul className="mt-3 space-y-1 text-sm text-muted-foreground font-mono">
            {lyrics.map((l, i) => <li key={i}>· {l}</li>)}
          </ul>
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
