import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Radio, Send, Check, X, Loader2, Sparkles, Paperclip, MessageSquare, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Channel = { id: string; previewer_id: string; name: string; slug: string; description: string | null; is_open: boolean; created_at: string };
type CallRequest = { id: string; channel_id: string; viewer_id: string; previewer_id: string; story_plot: string; suggested_role: string; status: string; created_at: string };
type ACS = { id: string; request_id: string; channel_id: string; previewer_id: string; viewer_id: string; membrane_id: string | null; scratchpad: string; created_at: string; closed_at: string | null };
type Msg = { id: string; acs_id: string; author_id: string | null; kind: "text" | "ai" | "system" | "file"; body: string; file_path: string | null; created_at: string };

const ROLE_PRESETS = [
  "creative-art-forming", "art-in-creation", "translocatory action",
  "Drag-Queen", "Re-Birth", "Re-born", "Deathly-harbinger", "Life's gateway",
];

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) ||
  Math.random().toString(36).slice(2, 8);

export default function Channels({ onLeave }: { onLeave: () => void }) {
  const { user } = useAuth();
  const [isPreviewer, setIsPreviewer] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [activeAcs, setActiveAcs] = useState<ACS | null>(null);

  // Load channels + role + reload on realtime
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const [{ data: chs }, { data: roles }] = await Promise.all([
        supabase.from("live_channels").select("*").eq("is_open", true).order("created_at", { ascending: false }),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);
      if (cancelled) return;
      setChannels((chs ?? []) as Channel[]);
      setIsPreviewer(!!roles?.some((r) => r.role === "previewer"));
    })();
    const ch = supabase
      .channel("live_channels_feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "live_channels" }, async () => {
        const { data } = await supabase.from("live_channels").select("*").eq("is_open", true).order("created_at", { ascending: false });
        setChannels((data ?? []) as Channel[]);
      })
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [user]);

  // Auto-open ACS when a request gets accepted (works for both viewer & previewer)
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`acs_listen_${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "live_active_call_spaces", filter: `previewer_id=eq.${user.id}` }, (p) => setActiveAcs(p.new as ACS))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "live_active_call_spaces", filter: `viewer_id=eq.${user.id}` }, (p) => setActiveAcs(p.new as ACS))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  if (!user) return null;

  if (activeAcs) {
    return <ActiveCallSpace acs={activeAcs} onClose={() => setActiveAcs(null)} />;
  }

  if (activeChannel) {
    return (
      <ChannelRoom
        channel={activeChannel}
        isOwner={activeChannel.previewer_id === user.id}
        onBack={() => setActiveChannel(null)}
        onAcsOpen={(acs) => setActiveAcs(acs)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-40">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <button onClick={onLeave} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Switch
          </button>
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-muted-foreground" />
            <span className="font-display text-lg font-semibold">Channels</span>
          </div>
          <div className="text-xs text-muted-foreground">{isPreviewer ? "previewer" : "viewer"}</div>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-6 py-10">
        {isPreviewer && <CreateChannel onCreated={(c) => setChannels((arr) => [c, ...arr])} />}
        <h2 className="mt-8 mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">Open channels</h2>
        {channels.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No open channels yet. {isPreviewer ? "Create one above." : "Check back soon."}
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {channels.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveChannel(c)}
                className="rounded-xl border border-border bg-card p-4 text-left hover:border-primary hover:bg-primary/5 transition"
              >
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-destructive" />
                  <span className="font-medium">{c.name}</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground line-clamp-2">{c.description || "—"}</div>
                <div className="mt-2 text-[10px] uppercase tracking-widest text-muted-foreground">/{c.slug}</div>
              </button>
            ))}
          </div>
        )}

        {isPreviewer && <PreviewerInbox onAcsOpen={(acs) => setActiveAcs(acs)} />}
      </section>
    </div>
  );
}

function CreateChannel({ onCreated }: { onCreated: (c: Channel) => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!user || !name.trim()) return;
    setBusy(true);
    const { data, error } = await supabase
      .from("live_channels")
      .insert({ previewer_id: user.id, name: name.trim(), slug: slugify(name), description: desc.trim() || null })
      .select()
      .single();
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Channel created");
    onCreated(data as Channel);
    setName(""); setDesc(""); setOpen(false);
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
        <Plus className="h-4 w-4" /> New channel
      </button>
    );
  }
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Channel name" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
      <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What's this channel about?" rows={2} className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
      <div className="mt-3 flex gap-2">
        <button onClick={create} disabled={busy || !name.trim()} className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Create
        </button>
        <button onClick={() => setOpen(false)} className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm hover:bg-accent">
          <X className="h-4 w-4" /> Cancel
        </button>
      </div>
    </div>
  );
}

function ChannelRoom({ channel, isOwner, onBack, onAcsOpen }:
  { channel: Channel; isOwner: boolean; onBack: () => void; onAcsOpen: (acs: ACS) => void }) {
  const { user } = useAuth();
  const [showRequest, setShowRequest] = useState(false);
  const [story, setStory] = useState("");
  const [role, setRole] = useState(ROLE_PRESETS[0]);
  const [busy, setBusy] = useState(false);
  const [myRequests, setMyRequests] = useState<CallRequest[]>([]);

  // Subscribe to my requests in this channel and auto-open ACS on accept
  useEffect(() => {
    if (!user || isOwner) return;
    const load = async () => {
      const { data } = await supabase
        .from("live_call_requests")
        .select("*")
        .eq("channel_id", channel.id)
        .eq("viewer_id", user.id)
        .order("created_at", { ascending: false });
      setMyRequests((data ?? []) as CallRequest[]);
    };
    load();
    const ch = supabase
      .channel(`req_viewer_${channel.id}_${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "live_call_requests", filter: `viewer_id=eq.${user.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [channel.id, user, isOwner]);

  const submitRequest = async () => {
    if (!user || !story.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("live_call_requests").insert({
      channel_id: channel.id,
      viewer_id: user.id,
      previewer_id: channel.previewer_id,
      story_plot: story.trim(),
      suggested_role: role,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Movie-call request sent");
    setStory(""); setShowRequest(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-40">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <button onClick={onBack} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Channels
          </button>
          <div className="text-center">
            <div className="font-display text-lg font-semibold">{channel.name}</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">/{channel.slug}</div>
          </div>
          <div className="text-xs text-muted-foreground">{isOwner ? "you own this" : "viewer"}</div>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-6 py-10">
        {channel.description && (
          <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">{channel.description}</p>
        )}

        {!isOwner && (
          <div className="mt-6">
            {!showRequest ? (
              <button onClick={() => setShowRequest(true)} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                <MessageSquare className="h-4 w-4" /> Request movie-call
              </button>
            ) : (
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="text-sm font-medium">Suggest a story plot</div>
                <textarea value={story} onChange={(e) => setStory(e.target.value)} rows={4} placeholder="The plot you want to see acted out..." className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                <div className="mt-3 text-xs uppercase tracking-widest text-muted-foreground">Suggested role</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ROLE_PRESETS.map((r) => (
                    <button key={r} onClick={() => setRole(r)} className={`rounded-full border px-3 py-1 text-xs ${role === r ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground hover:bg-accent"}`}>
                      {r}
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <button onClick={submitRequest} disabled={busy || !story.trim()} className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send
                  </button>
                  <button onClick={() => setShowRequest(false)} className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm hover:bg-accent">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {myRequests.length > 0 && (
              <div className="mt-6">
                <div className="text-xs uppercase tracking-widest text-muted-foreground">Your requests here</div>
                <ul className="mt-2 space-y-2">
                  {myRequests.map((r) => (
                    <li key={r.id} className="rounded-lg border border-border bg-card p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs">{r.suggested_role}</span>
                        <span className={`text-xs ${r.status === "accepted" ? "text-primary" : r.status === "rejected" ? "text-destructive" : "text-muted-foreground"}`}>{r.status}</span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-muted-foreground">{r.story_plot}</p>
                      {r.status === "accepted" && (
                        <OpenAcsForRequest requestId={r.id} onOpen={onAcsOpen} />
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {isOwner && (
          <p className="mt-6 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            You're the previewer here. Pending requests appear in your inbox below the channels list.
          </p>
        )}
      </section>
    </div>
  );
}

function OpenAcsForRequest({ requestId, onOpen }: { requestId: string; onOpen: (acs: ACS) => void }) {
  const [busy, setBusy] = useState(false);
  const open = async () => {
    setBusy(true);
    const { data } = await supabase.from("live_active_call_spaces").select("*").eq("request_id", requestId).maybeSingle();
    setBusy(false);
    if (data) onOpen(data as ACS);
    else toast.error("Call space not ready");
  };
  return (
    <button onClick={open} disabled={busy} className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />} Enter call space
    </button>
  );
}

function PreviewerInbox({ onAcsOpen }: { onAcsOpen: (acs: ACS) => void }) {
  const { user } = useAuth();
  const [items, setItems] = useState<CallRequest[]>([]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("live_call_requests")
        .select("*")
        .eq("previewer_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      setItems((data ?? []) as CallRequest[]);
    };
    load();
    const ch = supabase
      .channel(`inbox_${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "live_call_requests", filter: `previewer_id=eq.${user.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  if (items.length === 0) return null;

  const accept = async (id: string) => {
    const { data, error } = await supabase.rpc("accept_call_request", { p_request_id: id });
    if (error) { toast.error(error.message); return; }
    const acsId = (data as { acs_id: string }).acs_id;
    const { data: acs } = await supabase.from("live_active_call_spaces").select("*").eq("id", acsId).maybeSingle();
    if (acs) onAcsOpen(acs as ACS);
  };
  const reject = async (id: string) => {
    const { error } = await supabase.rpc("reject_call_request", { p_request_id: id });
    if (error) toast.error(error.message);
  };

  return (
    <div className="mt-10">
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">Pending movie-call requests</h2>
      <div className="space-y-3">
        {items.map((r) => (
          <motion.div key={r.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground">role suggested</div>
                <div className="font-mono text-sm">{r.suggested_role}</div>
                <p className="mt-2 text-sm">{r.story_plot}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button onClick={() => accept(r.id)} className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90">
                  <Check className="h-3 w-3" /> Accept
                </button>
                <button onClick={() => reject(r.id)} className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-xs hover:bg-accent">
                  <X className="h-3 w-3" /> Reject
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function ActiveCallSpace({ acs, onClose }: { acs: ACS; onClose: () => void }) {
  const { user } = useAuth();
  const isPreviewer = user?.id === acs.previewer_id;
  const [scratchpad, setScratchpad] = useState(acs.scratchpad);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [membrane, setMembrane] = useState(acs.membrane_id ?? "");
  const [busy, setBusy] = useState(false);
  const aiTimer = useRef<number | null>(null);
  const lastSavedScratch = useRef(acs.scratchpad);
  const messageCount = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);

  // Load + subscribe messages
  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data } = await supabase
        .from("live_acs_messages").select("*").eq("acs_id", acs.id).order("created_at", { ascending: true });
      if (active) setMessages((data ?? []) as Msg[]);
    };
    load();
    const ch = supabase
      .channel(`acs_${acs.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "live_acs_messages", filter: `acs_id=eq.${acs.id}` },
        (p) => setMessages((arr) => [...arr, p.new as Msg]))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "live_active_call_spaces", filter: `id=eq.${acs.id}` },
        (p) => {
          const next = p.new as ACS;
          if (next.scratchpad !== lastSavedScratch.current) {
            setScratchpad(next.scratchpad);
            lastSavedScratch.current = next.scratchpad;
          }
          if (next.membrane_id) setMembrane(next.membrane_id);
        })
      .subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, [acs.id]);

  // Debounced scratchpad save
  useEffect(() => {
    if (scratchpad === lastSavedScratch.current) return;
    const t = setTimeout(async () => {
      const { error } = await supabase.from("live_active_call_spaces").update({ scratchpad }).eq("id", acs.id);
      if (!error) lastSavedScratch.current = scratchpad;
    }, 500);
    return () => clearTimeout(t);
  }, [scratchpad, acs.id]);

  const triggerCinephile = () => {
    if (aiTimer.current) window.clearTimeout(aiTimer.current);
    aiTimer.current = window.setTimeout(() => {
      supabase.functions.invoke("cinephile", { body: { acs_id: acs.id } }).catch(() => {});
    }, 6000);
  };

  const send = async () => {
    if (!input.trim() || !user) return;
    setBusy(true);
    const body = input.trim();
    setInput("");
    const { error } = await supabase.from("live_acs_messages").insert({
      acs_id: acs.id, author_id: user.id, kind: "text", body,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    messageCount.current += 1;
    triggerCinephile();
  };

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const path = `${acs.id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("acs-files").upload(path, file);
    if (error) { toast.error(error.message); return; }
    await supabase.from("live_acs_messages").insert({
      acs_id: acs.id, author_id: user.id, kind: "file", body: file.name, file_path: path,
    });
    if (fileInput.current) fileInput.current.value = "";
  };

  const saveMembrane = async () => {
    const { error } = await supabase.from("live_active_call_spaces").update({ membrane_id: membrane.trim() || null }).eq("id", acs.id);
    if (error) toast.error(error.message); else toast.success("Membrane id pasted");
  };

  const closeSpace = async () => {
    if (!isPreviewer) return;
    await supabase.from("live_active_call_spaces").update({ closed_at: new Date().toISOString() }).eq("id", acs.id);
    onClose();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-40">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <button onClick={onClose} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Leave
          </button>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="font-display text-lg font-semibold">Active Call Space</span>
          </div>
          <div className="text-xs text-muted-foreground">{isPreviewer ? "previewer" : "viewer"}</div>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl grid-cols-1 gap-4 px-6 py-6 md:grid-cols-2">
        {/* Scratchpad */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Shared scratchpad</div>
            <div className="text-[10px] text-muted-foreground">live · 2 users</div>
          </div>
          <textarea
            value={scratchpad}
            onChange={(e) => setScratchpad(e.target.value)}
            rows={18}
            placeholder="Both of you can type here. Persists for the session."
            className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 font-mono text-sm leading-relaxed"
          />
          <div className="mt-3 flex items-center gap-2">
            <input ref={fileInput} type="file" onChange={onUpload} className="hidden" />
            <button onClick={() => fileInput.current?.click()} className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-xs hover:bg-accent">
              <Paperclip className="h-3 w-3" /> Upload
            </button>
            {isPreviewer && (
              <>
                <input value={membrane} onChange={(e) => setMembrane(e.target.value)} placeholder="paste membrane id" className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-xs" />
                <button onClick={saveMembrane} className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90">Paste</button>
                <button onClick={closeSpace} className="rounded-full border border-border bg-background px-3 py-1 text-xs hover:bg-accent">Close</button>
              </>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex flex-col rounded-xl border border-border bg-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Conversation</div>
            <div className="text-[10px] text-muted-foreground">cinephile listens in</div>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto" style={{ minHeight: 320, maxHeight: 480 }}>
            {messages.map((m) => <MessageBubble key={m.id} m={m} acs={acs} meId={user?.id} />)}
            {messages.length === 0 && (
              <p className="text-center text-xs text-muted-foreground py-10">Say hello — the cinephile is listening.</p>
            )}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); send(); }} className="mt-3 flex gap-2">
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type…" className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm" />
            <button type="submit" disabled={busy || !input.trim()} className="inline-flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              <Send className="h-4 w-4" /> Send
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}

function MessageBubble({ m, acs, meId }: { m: Msg; acs: ACS; meId?: string }) {
  const mine = m.author_id === meId;
  const isAi = m.kind === "ai";
  const who = isAi ? "Cinephile" : m.author_id === acs.previewer_id ? "Previewer" : "Viewer";

  const [fileUrl, setFileUrl] = useState<string | null>(null);
  useEffect(() => {
    if (m.kind !== "file" || !m.file_path) return;
    let active = true;
    supabase.storage.from("acs-files").createSignedUrl(m.file_path, 60 * 30).then(({ data }) => {
      if (active && data?.signedUrl) setFileUrl(data.signedUrl);
    });
    return () => { active = false; };
  }, [m]);

  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
        isAi ? "border border-primary/40 bg-primary/5 italic text-foreground"
        : mine ? "bg-primary text-primary-foreground"
        : "border border-border bg-background"
      }`}>
        <div className="text-[10px] uppercase tracking-widest opacity-70">{who}</div>
        {m.kind === "file" && fileUrl ? (
          <a href={fileUrl} target="_blank" rel="noreferrer" className="underline">{m.body}</a>
        ) : (
          <div className="whitespace-pre-wrap">{m.body}</div>
        )}
      </div>
    </div>
  );
}
