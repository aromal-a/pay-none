import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Radio, Send, Check, X, Loader2, Sparkles, Paperclip, MessageSquare, ArrowLeft, Copy, Infinity as InfinityIcon, ImagePlus, Frame as FrameIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type Channel = { id: string; previewer_id: string; name: string; slug: string; description: string | null; is_open: boolean; created_at: string; active_boxes?: string[] | null; multi_window?: boolean | null; min_tokens?: number | null };
type CallRequest = { id: string; channel_id: string; viewer_id: string; previewer_id: string; story_plot: string; suggested_role: string; status: string; created_at: string };
type ACS = { id: string; request_id: string; channel_id: string; previewer_id: string; viewer_id: string; membrane_id: string | null; scratchpad: string; created_at: string; closed_at: string | null };
type Msg = { id: string; acs_id: string; author_id: string | null; kind: "text" | "ai" | "system" | "file"; body: string; file_path: string | null; created_at: string };

export const BOX_OPTIONS: { key: string; label: string; hint: string }[] = [
  { key: "board", label: "Virtual Board", hint: "Whiteboard · pen · classics" },
  { key: "movie", label: "Movie-call", hint: "Video · audio · live-sharing" },
  { key: "midi", label: "MIDI-Haptics", hint: "Grid · mic · research" },
  { key: "lyrics", label: "Lyrical collection", hint: "Lyrics · rhythm notes" },
];
export const MIN_ENTRY_TOKENS_DEFAULT = 2000;

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
                  <span className={`inline-block h-2 w-2 rounded-full ${(c.active_boxes?.length ?? 0) > 0 ? "bg-primary animate-pulse" : "bg-muted-foreground/40"}`} />
                  <span className="font-medium">{c.name}</span>
                  <span className="ml-auto text-[10px] font-mono text-muted-foreground">{(c.min_tokens ?? MIN_ENTRY_TOKENS_DEFAULT).toLocaleString()}t</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground line-clamp-2">{c.description || "—"}</div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">/{c.slug}</div>
                  {(c.active_boxes?.length ?? 0) > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {(c.active_boxes ?? []).map((k) => {
                        const m = BOX_OPTIONS.find((b) => b.key === k);
                        return m ? (
                          <span key={k} className="rounded-full border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[9px] text-primary">{m.label}</span>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>
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
  const [boxes, setBoxes] = useState<string[]>([]);
  const [multi, setMulti] = useState(false);
  const [minTokens, setMinTokens] = useState<number>(MIN_ENTRY_TOKENS_DEFAULT);

  const toggleBox = (k: string) =>
    setBoxes((b) => (b.includes(k) ? b.filter((x) => x !== k) : [...b, k]));

  const create = async () => {
    if (!user || !name.trim()) return;
    setBusy(true);
    const insertPayload: Record<string, unknown> = {
      previewer_id: user.id,
      name: name.trim(),
      slug: slugify(name),
      description: desc.trim() || null,
      active_boxes: boxes,
      multi_window: multi && boxes.length > 1,
      min_tokens: Math.max(0, Math.floor(minTokens) || MIN_ENTRY_TOKENS_DEFAULT),
    };
    const { data, error } = await supabase
      .from("live_channels")
      .insert(insertPayload as never)
      .select()
      .single();
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Channel created");
    onCreated(data as Channel);
    setName(""); setDesc(""); setBoxes([]); setMulti(false); setMinTokens(MIN_ENTRY_TOKENS_DEFAULT); setOpen(false);
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
        <Plus className="h-4 w-4" /> New channel
      </button>
    );
  }
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Channel name" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
      <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What's this channel about?" rows={2} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />

      <div>
        <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1">Boxes shared at open</div>
        <div className="flex flex-wrap gap-2">
          {BOX_OPTIONS.map((b) => (
            <button
              type="button"
              key={b.key}
              onClick={() => toggleBox(b.key)}
              className={`rounded-full border px-3 py-1 text-xs ${boxes.includes(b.key) ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground hover:bg-accent"}`}
            >
              {b.label}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground">You can toggle these live later. Pick none to keep the channel quiet at first.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-xs">
          <span className="text-muted-foreground">Minimum tokens to enter</span>
          <input type="number" min={0} value={minTokens} onChange={(e) => setMinTokens(Number(e.target.value))} className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm" />
        </label>
        <label className="flex items-end gap-2 text-xs">
          <input type="checkbox" checked={multi} onChange={(e) => setMulti(e.target.checked)} />
          <span>Multi-window (show several boxes at once · camera minimised)</span>
        </label>
      </div>

      <div className="flex gap-2">
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

function ChannelRoom({ channel: initialChannel, isOwner, onBack, onAcsOpen }:
  { channel: Channel; isOwner: boolean; onBack: () => void; onAcsOpen: (acs: ACS) => void }) {
  const { user } = useAuth();
  const [channel, setChannel] = useState<Channel>(initialChannel);
  const [showRequest, setShowRequest] = useState(false);
  const [story, setStory] = useState("");
  const [role, setRole] = useState(ROLE_PRESETS[0]);
  const [busy, setBusy] = useState(false);
  const [myRequests, setMyRequests] = useState<CallRequest[]>([]);
  const [tokenBalance, setTokenBalance] = useState<number | null>(null);

  // Live-subscribe to channel updates (active_boxes / multi_window changes from previewer)
  useEffect(() => {
    const ch = supabase
      .channel(`channel_row_${initialChannel.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "live_channels", filter: `id=eq.${initialChannel.id}` },
        (p) => setChannel(p.new as Channel))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [initialChannel.id]);

  // Load viewer token balance
  useEffect(() => {
    if (!user || isOwner) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("profiles").select("token_balance").eq("user_id", user.id).maybeSingle();
      if (!cancelled) setTokenBalance(data?.token_balance ?? 0);
    })();
    return () => { cancelled = true; };
  }, [user, isOwner]);

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

  const activeBoxes = channel.active_boxes ?? [];
  const multi = !!channel.multi_window && activeBoxes.length > 1;
  const minTokens = channel.min_tokens ?? MIN_ENTRY_TOKENS_DEFAULT;
  const insufficient = !isOwner && tokenBalance !== null && tokenBalance < minTokens;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-40">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <button onClick={onBack} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Channels
          </button>
          <div className="text-center">
            <div className="font-display text-lg font-semibold">{channel.name}</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">/{channel.slug} · entry {minTokens.toLocaleString()} tokens</div>
          </div>
          <div className="text-xs text-muted-foreground">{isOwner ? "you own this" : `viewer · ${tokenBalance ?? "—"}`}</div>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-10">
        {channel.description && (
          <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">{channel.description}</p>
        )}

        {isOwner && (
          <PreviewerBroadcastBar channel={channel} onChange={(c) => setChannel(c)} />
        )}

        {!isOwner && (
          <>
            {insufficient ? (
              <div className="mt-6 rounded-xl border border-destructive/40 bg-destructive/10 p-6 text-center">
                <div className="text-sm font-medium text-destructive">Channel locked</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  This channel needs at least {minTokens.toLocaleString()} tokens to enter. You have {tokenBalance?.toLocaleString() ?? 0}.
                </p>
              </div>
            ) : activeBoxes.length === 0 ? (
              <div className="mt-6 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                The previewer isn't sharing any box right now. Request a movie-call to open a private space.
              </div>
            ) : (
              <BoxStage boxes={activeBoxes} multi={multi} channel={channel} />
            )}

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
          </>
        )}
      </section>
    </div>
  );
}

function PreviewerBroadcastBar({ channel, onChange }: { channel: Channel; onChange: (c: Channel) => void }) {
  const [busy, setBusy] = useState(false);
  const active = channel.active_boxes ?? [];
  const multi = !!channel.multi_window;

  const update = async (patch: Partial<Channel>) => {
    setBusy(true);
    const { data, error } = await supabase
      .from("live_channels")
      .update(patch as never)
      .eq("id", channel.id)
      .select()
      .single();
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    onChange(data as Channel);
  };

  const toggle = (k: string) => {
    const next = active.includes(k) ? active.filter((x) => x !== k) : [...active, k];
    update({ active_boxes: next, multi_window: multi && next.length > 1 });
  };

  return (
    <div className="mt-6 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">Broadcast controls</div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{busy ? "saving…" : "live"}</div>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Pick which boxes the audience sees right now. Toggle multi-window to show several at once (camera minimises to save space).</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {BOX_OPTIONS.map((b) => (
          <button
            key={b.key}
            onClick={() => toggle(b.key)}
            className={`rounded-full border px-3 py-1 text-xs ${active.includes(b.key) ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground hover:bg-accent"}`}
            title={b.hint}
          >
            {b.label}
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
        <label className="flex items-center gap-2">
          <input type="checkbox" disabled={active.length < 2} checked={multi && active.length > 1} onChange={(e) => update({ multi_window: e.target.checked })} />
          <span>Multi-window {active.length < 2 && <span className="text-muted-foreground">(need 2+ boxes)</span>}</span>
        </label>
        <span className="text-muted-foreground">· entry gate: {(channel.min_tokens ?? MIN_ENTRY_TOKENS_DEFAULT).toLocaleString()} tokens</span>
      </div>
    </div>
  );
}

function BoxStage({ boxes, multi, channel }: { boxes: string[]; multi: boolean; channel: Channel }) {
  const layout = multi ? "grid gap-4 sm:grid-cols-2" : "grid gap-4";
  return (
    <div className="mt-6">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">
          {multi ? "Multi-window · arranged" : "Now showing"}
        </div>
        <div className="text-[10px] text-muted-foreground">{boxes.length} box{boxes.length === 1 ? "" : "es"} live</div>
      </div>
      <div className={layout}>
        {boxes.map((k) => <BoxCard key={k} kind={k} channel={channel} compact={multi} />)}
      </div>
    </div>
  );
}

function BoxCard({ kind, channel, compact }: { kind: string; channel: Channel; compact: boolean }) {
  const meta = BOX_OPTIONS.find((b) => b.key === kind);
  if (!meta) return null;
  return (
    <div className={`rounded-xl border border-border bg-card p-4 ${compact ? "" : "min-h-[180px]"}`}>
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">{meta.label}</div>
        <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">live</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{meta.hint}</p>
      <div className="mt-3 rounded-lg border border-dashed border-border bg-background/40 p-3 text-xs text-muted-foreground">
        {kind === "board" && "Whiteboard is being drawn live by the previewer. Request a movie-call to draw together."}
        {kind === "movie" && "Movie-call channel is open. Use Request movie-call below to enter a private call space."}
        {kind === "midi" && "MIDI-Haptics grid is running on the previewer's side. Tracks export through the call space."}
        {kind === "lyrics" && "The previewer's lyrical collection is on stage. Lines & rhythm notes drop into the call space when you bond."}
      </div>
      <div className="mt-2 text-[10px] text-muted-foreground font-mono">channel /{channel.slug}</div>
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

  const bonded = (membrane || "").trim() === acs.id;

  const copyAcsId = async () => {
    try { await navigator.clipboard.writeText(acs.id); toast.success("Call space id copied"); }
    catch { toast.error("Copy failed"); }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className={`border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-40 ${bonded ? "shadow-[0_0_30px_-5px_hsl(var(--primary)/0.6)]" : ""}`}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <button onClick={onClose} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Leave
          </button>
          <div className="flex items-center gap-2">
            {bonded ? <InfinityIcon className="h-4 w-4 text-primary animate-pulse" /> : <Sparkles className="h-4 w-4 text-primary" />}
            <span className="font-display text-lg font-semibold">Active Call Space</span>
          </div>
          <div className="text-xs text-muted-foreground">{isPreviewer ? "previewer" : "viewer"}</div>
        </div>
      </header>

      {bonded && (
        <div className="border-b border-primary/40 bg-primary/10">
          <div className="mx-auto max-w-6xl px-6 py-2 text-center text-xs font-medium text-primary">
            <InfinityIcon className="mr-1 inline h-3 w-3" /> Membranes aligned · higher-dimensional workspace established between previewer & viewer
          </div>
        </div>
      )}

      <section className="mx-auto grid max-w-6xl grid-cols-1 gap-4 px-6 py-6 md:grid-cols-2">
        {/* Scratchpad */}
        <div className={`rounded-xl border bg-card p-4 ${bonded ? "border-primary/60 shadow-[0_0_24px_-8px_hsl(var(--primary)/0.5)]" : "border-border"}`}>
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Shared scratchpad</div>
            <div className="text-[10px] text-muted-foreground">live · 2 users</div>
          </div>
          <textarea
            value={scratchpad}
            onChange={(e) => setScratchpad(e.target.value)}
            rows={16}
            placeholder="Both of you can type here. Persists for the session."
            className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 font-mono text-sm leading-relaxed"
          />

          {/* Membrane / id row — both sides see the call space id */}
          <div className="mt-3 rounded-md border border-dashed border-border bg-background/50 p-2">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
              <span>This call space id</span>
              <button onClick={copyAcsId} className="inline-flex items-center gap-1 hover:text-foreground">
                <Copy className="h-3 w-3" /> copy
              </button>
            </div>
            <div className="mt-1 break-all font-mono text-[11px]">{acs.id}</div>
            <div className="mt-2 text-[10px] uppercase tracking-widest text-muted-foreground">
              {isPreviewer ? "Membrane id (paste viewer's call space id to bond)" : "Membrane id (set by previewer)"}
            </div>
            {isPreviewer ? (
              <div className="mt-1 flex gap-2">
                <input value={membrane} onChange={(e) => setMembrane(e.target.value)} placeholder="paste membrane id" className="flex-1 rounded-md border border-input bg-background px-2 py-1 font-mono text-[11px]" />
                <button onClick={saveMembrane} className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90">Paste</button>
              </div>
            ) : (
              <div className="mt-1 break-all font-mono text-[11px] text-muted-foreground">{membrane || "—"}</div>
            )}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <input ref={fileInput} type="file" onChange={onUpload} className="hidden" />
            <button onClick={() => fileInput.current?.click()} className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-xs hover:bg-accent">
              <Paperclip className="h-3 w-3" /> Upload
            </button>
            {isPreviewer && (
              <button onClick={closeSpace} className="ml-auto rounded-full border border-border bg-background px-3 py-1 text-xs hover:bg-accent">Close space</button>
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
            {messages.filter((m) => !(m.kind === "file" && m.body.startsWith("inspiration:"))).map((m) => <MessageBubble key={m.id} m={m} acs={acs} meId={user?.id} />)}
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

      <section className="mx-auto max-w-6xl px-6 pb-10">
        <InspirationFrame acs={acs} messages={messages} canUpload={isPreviewer} bonded={bonded} />
      </section>
    </div>
  );
}

function InspirationFrame({ acs, messages, canUpload, bonded }: { acs: ACS; messages: Msg[]; canUpload: boolean; bonded: boolean }) {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [urls, setUrls] = useState<Record<string, string>>({});

  const inspirations = useMemo(
    () => messages.filter((m) => m.kind === "file" && m.body.startsWith("inspiration:") && m.file_path),
    [messages]
  );

  useEffect(() => {
    let active = true;
    (async () => {
      const next: Record<string, string> = {};
      await Promise.all(
        inspirations.map(async (m) => {
          if (!m.file_path || urls[m.id]) { if (urls[m.id]) next[m.id] = urls[m.id]; return; }
          const { data } = await supabase.storage.from("acs-files").createSignedUrl(m.file_path, 60 * 30);
          if (data?.signedUrl) next[m.id] = data.signedUrl;
        })
      );
      if (active) setUrls((prev) => ({ ...prev, ...next }));
    })();
    return () => { active = false; };
  }, [inspirations]);

  const upload = async (file: File) => {
    if (!user) return;
    setBusy(true);
    const path = `${acs.id}/inspiration-${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("acs-files").upload(path, file);
    if (error) { setBusy(false); toast.error(error.message); return; }
    const { error: e2 } = await supabase.from("live_acs_messages").insert({
      acs_id: acs.id, author_id: user.id, kind: "file",
      body: `inspiration:${caption.trim() || file.name}`, file_path: path,
    });
    setBusy(false);
    if (e2) { toast.error(e2.message); return; }
    setCaption("");
    if (inputRef.current) inputRef.current.value = "";
    toast.success("Inspiration framed");
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) { toast.error("Pick an image"); return; }
    upload(f);
  };

  const latest = inspirations[inspirations.length - 1];
  const rest = inspirations.slice(0, -1).reverse();

  return (
    <div className={`rounded-xl border bg-card p-5 ${bonded ? "border-primary/60 shadow-[0_0_24px_-8px_hsl(var(--primary)/0.5)]" : "border-border"}`}>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FrameIcon className="h-4 w-4 text-primary" />
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Inspiration frame</div>
        </div>
        <div className="text-[10px] text-muted-foreground">{canUpload ? "previewer-only upload" : "view only"}</div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_320px]">
        {/* The frame */}
        <div className="flex items-center justify-center">
          {latest && urls[latest.id] ? (
            <figure className="group relative max-w-full">
              <div className="rounded-sm bg-gradient-to-br from-amber-100 via-amber-50 to-amber-200 p-4 pb-14 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.55)] ring-1 ring-black/10 transition-transform duration-500 group-hover:-rotate-1">
                <div className="overflow-hidden rounded-[2px] bg-black ring-1 ring-black/30">
                  <img
                    src={urls[latest.id]}
                    alt={latest.body.replace(/^inspiration:/, "")}
                    className="block max-h-[420px] w-full object-cover"
                  />
                </div>
                <figcaption className="absolute bottom-3 left-0 right-0 text-center font-display text-sm italic text-stone-700">
                  {latest.body.replace(/^inspiration:/, "") || "Untitled"}
                </figcaption>
              </div>
              <div className="pointer-events-none absolute -inset-2 -z-10 rounded-sm bg-primary/20 blur-2xl opacity-60" />
            </figure>
          ) : (
            <div className="flex h-64 w-full max-w-md flex-col items-center justify-center rounded-md border-2 border-dashed border-border text-center text-muted-foreground">
              <ImagePlus className="mb-2 h-8 w-8" />
              <div className="text-sm">No inspiration yet.</div>
              <div className="text-xs">{canUpload ? "Upload an image to set the mood." : "Waiting for the previewer to share an image."}</div>
            </div>
          )}
        </div>

        {/* Upload + gallery */}
        <div className="space-y-4">
          {canUpload && (
            <div className="rounded-md border border-border bg-background p-3">
              <div className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">Hang a new picture</div>
              <input
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Caption (optional)"
                className="mb-2 w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
              />
              <input ref={inputRef} type="file" accept="image/*" onChange={onPick} className="hidden" />
              <button
                onClick={() => inputRef.current?.click()}
                disabled={busy}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImagePlus className="h-3 w-3" />}
                {busy ? "Uploading…" : "Upload from device"}
              </button>
            </div>
          )}

          {rest.length > 0 && (
            <div>
              <div className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">Previously framed</div>
              <div className="grid grid-cols-3 gap-2">
                {rest.map((m) => (
                  urls[m.id] ? (
                    <div key={m.id} className="aspect-square overflow-hidden rounded-sm bg-amber-50 p-1 shadow ring-1 ring-black/10">
                      <img src={urls[m.id]} alt={m.body} className="h-full w-full object-cover" />
                    </div>
                  ) : null
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
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
