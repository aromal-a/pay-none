import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Coins, Loader2, Send, Plus, RefreshCw, Syringe, Save, Trash2, History, Paperclip, X, FileText, Image as ImageIcon, Video, File } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { countChars, fetchBalance } from "@/lib/tokens";
import { cn } from "@/lib/utils";
import LanguageSelector from "@/components/LanguageSelector";

interface Channel { id: string; slug: string; name: string; description: string | null; }
interface Conversation { id: string; channel_id: string; user_low: string; user_high: string; last_message_at: string; }
interface Message { id: string; conversation_id: string; sender_id: string; recipient_id: string; body: string; words: number; created_at: string; }

export default function Chat() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeSlug, setActiveSlug] = useState<string>("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [peerEmails, setPeerEmails] = useState<Record<string, string>>({});
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [balance, setBalance] = useState(0);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Local prompt history (saved under chat, persisted per-user in localStorage)
  interface SavedPrompt { id: string; text: string; mode: "chat" | "model-conversion" | "injection"; created_at: number; }
  const storageKey = user ? `qt:saved-prompts:${user.id}` : "qt:saved-prompts:anon";
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([]);
  const [showHistory, setShowHistory] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      setSavedPrompts(raw ? (JSON.parse(raw) as SavedPrompt[]) : []);
    } catch { setSavedPrompts([]); }
  }, [storageKey]);

  const persistPrompts = (next: SavedPrompt[]) => {
    setSavedPrompts(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const savePrompt = (mode: SavedPrompt["mode"]) => {
    const text = body.trim();
    if (!text) { toast({ title: "Nothing to save", description: "Write a prompt first.", variant: "destructive" }); return; }
    const entry: SavedPrompt = { id: crypto.randomUUID(), text, mode, created_at: Date.now() };
    persistPrompts([entry, ...savedPrompts].slice(0, 100));
    toast({ title: "Prompt saved", description: `Saved as ${mode}.` });
  };

  const deletePrompt = (id: string) => persistPrompts(savedPrompts.filter(p => p.id !== id));

  const newChat = () => { setBody(""); setActiveConvId(null); setRecipientEmail(""); };

  const newModelConversion = () => {
    const base = body.trim();
    setBody(`[model-conversion]\n${base ? base + "\n" : ""}Convert the previous response to a different model perspective.`);
  };

  const injectPrompt = (p: SavedPrompt) => {
    setBody(prev => (prev ? prev + "\n\n" : "") + `<!-- injected:${p.mode} -->\n${p.text}`);
    toast({ title: "Prompt injected", description: "Appended to your draft." });
  };

  // Local attachments — kept client-side only (model input is local to the user)
  interface LocalAttachment { id: string; name: string; size: number; type: string; url: string; }
  const [attachments, setAttachments] = useState<LocalAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onPickFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const MAX = 50 * 1024 * 1024; // 50MB per file
    const next: LocalAttachment[] = [];
    Array.from(files).forEach(f => {
      if (f.size > MAX) {
        toast({ title: "File too large", description: `${f.name} exceeds 50MB and was skipped.`, variant: "destructive" });
        return;
      }
      next.push({ id: crypto.randomUUID(), name: f.name, size: f.size, type: f.type || "application/octet-stream", url: URL.createObjectURL(f) });
    });
    if (next.length) {
      setAttachments(prev => [...prev, ...next]);
      toast({ title: "Attached locally", description: `${next.length} file(s) ready (kept on your device).` });
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => {
      const target = prev.find(a => a.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter(a => a.id !== id);
    });
  };

  useEffect(() => () => { attachments.forEach(a => URL.revokeObjectURL(a.url)); }, []); // eslint-disable-line

  const attachIcon = (type: string) => {
    if (type.startsWith("image/")) return <ImageIcon className="h-3 w-3" />;
    if (type.startsWith("video/")) return <Video className="h-3 w-3" />;
    if (type === "application/pdf" || type.startsWith("text/")) return <FileText className="h-3 w-3" />;
    return <File className="h-3 w-3" />;
  };

  const fmtSize = (n: number) => n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;



  useEffect(() => { if (!loading && !user) navigate("/auth", { replace: true }); }, [user, loading, navigate]);

  // Load channels + balance
  useEffect(() => {
    if (!user) return;
    supabase.from("channels").select("*").order("name").then(({ data }) => {
      if (data) { setChannels(data as Channel[]); if (!activeSlug && data.length) setActiveSlug((data[0] as Channel).slug); }
    });
    fetchBalance(user.id).then(setBalance);
  }, [user]); // eslint-disable-line

  const activeChannel = useMemo(() => channels.find(c => c.slug === activeSlug), [channels, activeSlug]);

  // Load conversations for channel
  useEffect(() => {
    if (!user || !activeChannel) return;
    supabase.from("conversations").select("*").eq("channel_id", activeChannel.id).order("last_message_at", { ascending: false })
      .then(async ({ data }) => {
        const convs = (data ?? []) as Conversation[];
        setConversations(convs);
        // resolve peer emails
        const map: Record<string, string> = {};
        await Promise.all(convs.map(async c => {
          const { data: email } = await supabase.rpc("conversation_peer_email", { p_conv_id: c.id });
          if (email) map[c.id] = email as string;
        }));
        setPeerEmails(map);
        if (convs.length && !activeConvId) setActiveConvId(convs[0].id);
      });
  }, [user, activeChannel]); // eslint-disable-line

  // Load messages for active conv + realtime
  useEffect(() => {
    if (!activeConvId) { setMessages([]); return; }
    supabase.from("messages").select("*").eq("conversation_id", activeConvId).order("created_at")
      .then(({ data }) => setMessages((data ?? []) as Message[]));
    const ch = supabase.channel(`msgs-${activeConvId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${activeConvId}` },
        (payload) => setMessages(prev => [...prev, payload.new as Message]))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeConvId]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }, [messages]);

  const chars = countChars(body);
  const remaining = balance - chars;
  const insufficient = remaining < 0;

  const handleSend = async () => {
    if (!user || !activeChannel) return;
    const targetEmail = activeConvId ? peerEmails[activeConvId] : recipientEmail.trim();
    if (!targetEmail) { toast({ title: "Recipient required", description: "Enter the recipient's email.", variant: "destructive" }); return; }
    if (chars === 0) return;
    if (insufficient) { toast({ title: "Not enough tokens", description: `Need ${chars}, have ${balance}.`, variant: "destructive" }); return; }
    setSending(true);
    try {
      const { data, error } = await supabase.rpc("send_message", {
        p_recipient_email: targetEmail,
        p_channel_slug: activeChannel.slug,
        p_body: body,
      });
      if (error) throw error;
      const result = data as { conversation_id: string; sender_remaining: number };
      setBalance(result.sender_remaining);

      // Auto-save the sent prompt to history so the user can revisit later
      const sentText = body.trim();
      if (sentText) {
        const entry: SavedPrompt = { id: crypto.randomUUID(), text: sentText, mode: "chat", created_at: Date.now() };
        persistPrompts([entry, ...savedPrompts].slice(0, 100));
      }

      setBody("");
      setRecipientEmail("");
      if (!activeConvId) setActiveConvId(result.conversation_id);
      // refresh conv list peer email if new
      if (!peerEmails[result.conversation_id]) {
        setPeerEmails(prev => ({ ...prev, [result.conversation_id]: targetEmail }));
      }
    } catch (e) {
      toast({ title: "Send failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-40">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <div className="flex items-center gap-2">
            <LanguageSelector />
            <div className="flex items-center gap-2 text-sm">
              <Coins className="h-4 w-4 text-primary" />
              <span className="font-semibold text-foreground">{balance} tokens</span>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-4 px-4 py-6 md:grid-cols-[180px_240px_1fr] md:px-6">
        {/* Channels */}
        <aside className="rounded-xl border border-border bg-card p-2">
          <div className="flex items-center justify-between px-2 pb-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Channels</p>
            <button
              onClick={async () => {
                const name = window.prompt("New channel name?")?.trim();
                if (!name) return;
                const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || `ch-${Date.now()}`;
                const { data, error } = await supabase.from("channels").insert({ name, slug }).select().single();
                if (error) { toast({ title: "Could not add channel", description: error.message, variant: "destructive" }); return; }
                setChannels(prev => [...prev, data as Channel].sort((a, b) => a.name.localeCompare(b.name)));
                setActiveSlug((data as Channel).slug);
                setActiveConvId(null);
                toast({ title: "Channel added", description: name });
              }}
              title="Add a new channel"
              aria-label="Add channel"
              className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              +
            </button>
          </div>
          <div className="space-y-0.5">
            {channels.map(c => (
              <button key={c.id} onClick={() => { setActiveSlug(c.slug); setActiveConvId(null); }}
                className={cn("w-full rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted",
                  activeSlug === c.slug ? "bg-primary/10 text-primary font-semibold" : "text-foreground")}>
                {c.name}
              </button>
            ))}
          </div>
        </aside>

        {/* Conversations */}
        <aside className="rounded-xl border border-border bg-card p-2">
          <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prompts</p>
          <button onClick={() => setActiveConvId(null)}
            className={cn("mb-1 w-full rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted",
              !activeConvId ? "bg-primary/10 text-primary font-semibold" : "text-foreground")}>
            + New prompt
          </button>
          {conversations.length === 0 && <p className="px-3 py-3 text-xs text-muted-foreground">No prompts yet.</p>}
          {conversations.map(c => (
            <button key={c.id} onClick={() => setActiveConvId(c.id)}
              className={cn("w-full truncate rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted",
                activeConvId === c.id ? "bg-primary/10 text-primary font-semibold" : "text-foreground")}>
              {peerEmails[c.id] ?? "…"}
            </button>
          ))}
        </aside>

        {/* Thread */}
        <section className="flex h-[70vh] flex-col rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-4 py-3">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{activeChannel?.name}</p>
            <p className="text-sm font-semibold text-foreground">
              {activeConvId ? peerEmails[activeConvId] ?? "Conversation" : "New prompt"}
            </p>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {!activeConvId && (
              <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-4">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">To (email)</label>
                <Input type="email" placeholder="recipient@example.com" value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)} />
                <p className="text-xs text-muted-foreground">Tokens you spend transfer in full to the recipient's wallet.</p>
              </div>
            )}
            {messages.length === 0 && activeConvId && (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <p className="text-sm text-muted-foreground">No messages yet.</p>
                <p className="text-xs text-muted-foreground">Start the conversation below.</p>
              </div>
            )}
            {messages.map(m => {
              const mine = m.sender_id === user.id;
              return (
                <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                  <div className={cn("max-w-[75%] rounded-2xl px-4 py-2.5 text-sm shadow-sm",
                    mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground")}>
                    <p className="whitespace-pre-wrap leading-relaxed">{m.body}</p>
                    <p className={cn("mt-1.5 text-[10px] opacity-70", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>
                      {mine ? `−${m.words}` : `+${m.words}`} tokens · {new Date(m.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-border p-3">
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              <Button size="sm" variant="outline" onClick={newChat} className="h-7 px-2 text-xs">
                <Plus className="mr-1 h-3 w-3" /> New chat
              </Button>
              <Button size="sm" variant="outline" onClick={newModelConversion} className="h-7 px-2 text-xs">
                <RefreshCw className="mr-1 h-3 w-3" /> New-model-conversion
              </Button>
              <Button size="sm" variant="outline" onClick={() => savePrompt("injection")} className="h-7 px-2 text-xs">
                <Syringe className="mr-1 h-3 w-3" /> Prompt-injection
              </Button>
              <Button size="sm" variant="outline" onClick={() => savePrompt("chat")} className="h-7 px-2 text-xs">
                <Save className="mr-1 h-3 w-3" /> Save
              </Button>
              <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} className="h-7 px-2 text-xs">
                <Paperclip className="mr-1 h-3 w-3" /> Attach
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*,audio/*,.pdf,.txt,.md,.json,.csv,.doc,.docx,.xls,.xlsx,.ppt,.pptx,text/*,application/*"
                className="hidden"
                onChange={(e) => { onPickFiles(e.target.files); if (fileInputRef.current) fileInputRef.current.value = ""; }}
              />
              <Button size="sm" variant="ghost" onClick={() => setShowHistory(s => !s)} className="h-7 px-2 text-xs">
                <History className="mr-1 h-3 w-3" /> {showHistory ? "Hide" : "Show"} history ({savedPrompts.length})
              </Button>
            </div>

            {attachments.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5 rounded-md border border-border bg-muted/40 p-1.5">
                {attachments.map(a => (
                  <div key={a.id} className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-xs">
                    {a.type.startsWith("image/") ? (
                      <img src={a.url} alt={a.name} className="h-6 w-6 rounded object-cover" />
                    ) : (
                      <span className="text-muted-foreground">{attachIcon(a.type)}</span>
                    )}
                    <span className="max-w-[160px] truncate text-foreground" title={a.name}>{a.name}</span>
                    <span className="text-[10px] text-muted-foreground">{fmtSize(a.size)}</span>
                    <button onClick={() => removeAttachment(a.id)} className="text-muted-foreground hover:text-destructive" aria-label="Remove">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <span className="self-center text-[10px] text-muted-foreground">Stored locally · not uploaded</span>
              </div>
            )}

            {showHistory && savedPrompts.length > 0 && (
              <div className="mb-2 max-h-32 space-y-1 overflow-y-auto rounded-md border border-border bg-muted/40 p-1.5">
                {savedPrompts.map(p => (
                  <div key={p.id} className="flex items-start gap-1.5 rounded px-1.5 py-1 text-xs hover:bg-background">
                    <span className="mt-0.5 shrink-0 rounded bg-primary/10 px-1 text-[10px] font-semibold uppercase text-primary">
                      {p.mode}
                    </span>
                    <button onClick={() => injectPrompt(p)} className="flex-1 truncate text-left text-foreground hover:underline" title="Inject into draft">
                      {p.text}
                    </button>
                    <button onClick={() => deletePrompt(p.id)} className="shrink-0 text-muted-foreground hover:text-destructive" aria-label="Delete">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2}
              placeholder="Write your prompt… (1 character = 1 token, transferred to recipient)"
              className={cn(insufficient && "border-destructive focus-visible:ring-destructive")}
              disabled={sending} />
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className={cn("text-muted-foreground", insufficient && "text-destructive font-semibold")}>
                {chars} char{chars === 1 ? "" : "s"} · balance {balance}
                {chars > 0 && ` → ${remaining}`}
              </span>
              <Button size="sm" onClick={handleSend} disabled={sending || chars === 0 || insufficient}>
                {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Send className="mr-1 h-3.5 w-3.5" /> Send</>}
              </Button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
