import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Radio, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Peer = { sign: string; number: number; joined_at: number; user_id: string };

const SIGNS = ["✦", "✺", "✹", "✸", "✷", "✶", "✧", "✪", "✫", "✬", "✭", "✮", "✯", "✰", "❂", "✣"];

export default function Live() {
  const { user, loading } = useAuth();
  const [peers, setPeers] = useState<Peer[]>([]);

  const me = useMemo<Peer | null>(() => {
    if (!user) return null;
    return {
      sign: SIGNS[Math.floor(Math.random() * SIGNS.length)],
      number: Math.floor(1000 + Math.random() * 8999),
      joined_at: Date.now(),
      user_id: user.id,
    };
  }, [user]);

  useEffect(() => {
    if (!user || !me) return;
    const channel = supabase.channel("live-room", {
      config: { presence: { key: user.id } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<Peer>();
        const flat = Object.values(state).flat() as Peer[];
        setPeers(flat.sort((a, b) => a.joined_at - b.joined_at));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") await channel.track(me);
      });

    return () => {
      channel.unsubscribe();
    };
  }, [user, me]);

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
            <span className="font-display text-lg font-semibold">Live Room</span>
            <Radio className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-xs text-muted-foreground">{peers.length} online</div>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-6 py-10 text-center">
        <p className="text-sm text-muted-foreground">You appear here as</p>
        {me && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mt-3 inline-flex items-center gap-3 rounded-2xl border border-border bg-card px-6 py-4 shadow-sm"
          >
            <span className="text-3xl">{me.sign}</span>
            <span className="font-mono text-2xl font-bold text-foreground">#{me.number}</span>
          </motion.div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Temporary sign — everyone here is equal. No creditors, no debtors.
        </p>
      </section>

      <section className="mx-auto max-w-4xl px-6 pb-20">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Currently live
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          <AnimatePresence>
            {peers.map((p) => (
              <motion.div
                key={p.user_id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className={`flex items-center gap-3 rounded-xl border p-4 ${
                  p.user_id === user.id ? "border-primary bg-primary/5" : "border-border bg-card"
                }`}
              >
                <span className="text-2xl">{p.sign}</span>
                <span className="font-mono text-lg">#{p.number}</span>
                {p.user_id === user.id && (
                  <span className="ml-auto text-xs text-primary">you</span>
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
