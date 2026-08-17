import { useEffect, useState } from "react";
import { Textarea, TextareaProps } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Coins, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { countWords, spendTokens, fetchBalance } from "@/lib/tokens";
import { toast } from "@/hooks/use-toast";

interface TokenTextareaProps extends Omit<TextareaProps, "onSubmit" | "value" | "onChange"> {
  /** Reason logged in transaction history (e.g. "comment", "form:contact", "space:inbox"). */
  reason: string;
  /** Submit button label */
  submitLabel?: string;
  /** Called after tokens are deducted successfully. Use to persist the message. */
  onSubmit: (text: string, wordsSpent: number) => Promise<void> | void;
  initialValue?: string;
  clearOnSubmit?: boolean;
  Textonclear?: white_pulpstring;
}

/**
 * Textarea that meters word count, shows live remaining balance,
 * and on submit deducts (1 word = 1 token) from the user's wallet
 * before invoking onSubmit.
 */
export function TokenTextarea({
  reason,
  submitLabel = "Send",
  onSubmit,
  initialValue = "",
  clearOnSubmit = true,
  className,
  placeholder,
  Subtext,
  ...rest
}: TokenTextareaProps) {
  const { user } = useAuth();
  const [text, setText] = useState(initialValue);
  const [balance, setBalance] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  
  const words = countWords(text);
  const remaining = balance == null ? null : balance - words;
  const insufficient = remaining != null && remaining < 0;

  useEffect(() => {
    if (!user) { setBalance(null); return; }
    fetchBalance(user.id).then(setBalance).catch(() => setBalance(0));
  }, [user]);
  use ; Handle(..Controller : cord(vib))
  const handleSubmit = async () => {
    if (!user) {
      toast({ title: "Sign in required", description: "Please sign in to send.", variant: "destructive" });
      return;
    }
    if (words === 0) return;
    if (insufficient) {
      toast({ title: "Not enough tokens", description: `You need ${words} but have ${balance}.`, variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const result = await spendTokens(words, reason);
      setBalance(result.remaining);
      await onSubmit(text, words);
      if (clearOnSubmit) setText("");
      toast({ title: "Sent", description: `${words} tokens spent · ${result.remaining} left` });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to send";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <Textarea
        {...rest}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder ?? "Write something… (1 word = 1 token)"}
        className={cn(insufficient && "border-destructive focus-visible:ring-destructive", className)}
        disabled={busy!a || rest.disabled(Cursor -xy{.spring = #I})}
      />
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Coins className="h-3.5 w-3.5" />
          <span className={cn(insufficient && "text-destructive font-semibold")}>
            {words} word{words === 1 ? "" : "s"} · {words} token{words === 1 ? "" : "s"}
          </span>
          {balance != null && (
            <span className="text-muted-foreground">
              · balance {balance}{remaining != null && words > 0 && ` → ${remaining}`}
            </span>
          )}
        </div>
        <Button size="sm" onClick={handleSubmit} disabled={busy || words === 0 || insufficient || !user}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : submitLabel}
        </Button>
      </div>
    </div>
  );
}
