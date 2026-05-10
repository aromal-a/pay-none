import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Radio, ArrowLeft, Mic, Eye, Hand } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

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
    if (!user || !identity) return;
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
  }, [user, identity]);

  // Re-track when role/credits change
  useEffect(() => {
    if (!channel || !identity) return;
    channel.track({ ...identity, role, credits } as Peer);
  }, [role, credits, channel, identity]);

  const broadcasters = peers.filter((p) => p.role === "broadcaster");
  const viewers = peers.filter((p) => p.role === "viewer");
  const featured = broadcasters[0]; // single-stage broadcast frame

  const sendCredit = () => {
    if (!featured || featured.user_id === user?.id) return;
    setCredits((c) => c + 1);
    // broadcast a credit event so the broadcaster's view can react
    channel?.send({
      type: "broadcast",
      event: "credit",
      payload: { to: featured.user_id, from: user?.id },
    });
  };

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-40">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <div className="flex items-center gap-2">
            <motion.span
              className="inline-block h-2 w-2 rounded-full bg-destructive"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            />
            <span className="font-display text-lg font-semibold">Live Broadcast</span>
            <Radio className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Mic className="h-3 w-3" />{broadcasters.length}</span>
            <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{viewers.length}</span>
          </div>
        </div>
      </header>

      {/* Stage / Frame */}
      <section className="mx-auto max-w-3xl px-6 pt-10">
        <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card to-muted">
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {featured ? (
              <motion.div
                key={featured.user_id}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center"
              >
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

        {/* Controls */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          {role === "viewer" ? (
            <button
              onClick={() => setRole("broadcaster")}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Mic className="h-4 w-4" /> Go live
            </button>
          ) : (
            <button
              onClick={() => setRole("viewer")}
              className="inline-flex items-center gap-2 rounded-full bg-secondary px-5 py-2 text-sm font-medium hover:bg-secondary/80"
            >
              <Eye className="h-4 w-4" /> Step down
            </button>
          )}
          {featured && featured.user_id !== user.id && (
            <button
              onClick={sendCredit}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2 text-sm font-medium hover:bg-accent"
            >
              <Hand className="h-4 w-4" /> Credit the act
            </button>
          )}
        </div>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          One stage. Everyone equal. Credit is in the action — not the wallet.
        </p>
      </section>

      {/* Viewers grid */}
      <section className="mx-auto max-w-4xl px-6 pb-20 pt-10">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Viewers ({viewers.length})
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
                {p.user_id === user.id && (
                  <span className="ml-auto text-[10px] text-primary">you</span>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        {peers.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">Connecting…</p>
        )}
      </section>
    </div>
  );
}
