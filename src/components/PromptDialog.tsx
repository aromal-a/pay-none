import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Loader2, Coins, Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { fetchBalance, countWords, spendTokens } from "@/lib/tokens";
import { toast } from "sonner";

interface PromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ChatMsg = { role: "user" | "assistant"; content: string };

export function PromptDialog({ open, onOpenChange }: PromptDialogProps) {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [balance, setBalance] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<ChatMsg[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const words = countWords(text);
  const remaining = balance == null ? null : balance - words;
  const insufficient = remaining != null && remaining < 0;

  useEffect(() => {
    if (!open || !user) return;
    fetchBalance(user.id).then(setBalance).catch(() => setBalance(0));
  }, [open, user]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [history, busy]);

  const handleSend = async () => {
    if (!user) {
      toast.error("Please sign in");
      return;
    }
    if (words === 0 || busy) return;
    if (insufficient) {
      toast.error(`Need ${words} tokens but have ${balance}`);
      return;
    }

    const prompt = text.trim();
    setBusy(true);
    try {
      const spent = await spendTokens(words, "prompt-ai");
      setBalance(spent.remaining);

      const newHistory: ChatMsg[] = [...history, { role: "user", content: prompt }];
      setHistory(newHistory);
      setText("");

      const { data, error } = await supabase.functions.invoke("prompt-ai", {
        body: { messages: newHistory },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      setHistory((h) => [...h, { role: "assistant", content: data?.reply ?? "(no reply)" }]);
      toast.success(`-${words} tokens · ${spent.remaining} left`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Spend your tokens</DialogTitle>
          <DialogDescription>
            Ask anything. Each word costs 1 token. URLs allowed — the AI replies based on context.
          </DialogDescription>
        </DialogHeader>

        <div
          ref={scrollRef}
          className="flex-1 min-h-[240px] max-h-[50vh] overflow-y-auto rounded-md border bg-muted/30 p-3 space-y-3"
        >
          {history.length === 0 && !busy && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Start a conversation — type your idea below.
            </p>
          )}
          {history.map((m, i) => (
            <div
              key={i}
              className={
                m.role === "user"
                  ? "ml-auto max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
                  : "mr-auto max-w-[85%] rounded-lg bg-card px-3 py-2 text-sm border"
              }
            >
              {m.role === "assistant" ? (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{m.content}</p>
              )}
            </div>
          ))}
          {busy && (
            <div className="mr-auto rounded-lg bg-card px-3 py-2 border flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type your idea, question, or paste a URL…"
            rows={3}
            disabled={busy}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSend();
              }
            }}
            className={insufficient ? "border-destructive" : ""}
          />
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Coins className="h-3.5 w-3.5" />
              <span className={insufficient ? "text-destructive font-semibold" : ""}>
                {words} word{words === 1 ? "" : "s"}
              </span>
              {balance != null && (
                <span>· balance {balance}{words > 0 && ` → ${Math.max(0, balance - words)}`}</span>
              )}
            </div>
            <Button size="sm" onClick={handleSend} disabled={busy || words === 0 || insufficient}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4 mr-1" /> Send</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
