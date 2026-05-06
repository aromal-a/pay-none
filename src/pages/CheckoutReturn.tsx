import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export default function CheckoutReturn() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const { user } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    // Poll briefly for the webhook to credit
    let cancelled = false;
    const start = Date.now();
    const poll = async () => {
      while (!cancelled && Date.now() - start < 15000) {
        const { data } = await supabase.from("profiles").select("token_balance").eq("user_id", user.id).maybeSingle();
        if (data) {
          setBalance(data.token_balance);
          if (data.token_balance > 0) return;
        }
        await new Promise((r) => setTimeout(r, 1500));
      }
    };
    poll();
    return () => { cancelled = true; };
  }, [user]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-xl">
        <CheckCircle2 className="mx-auto h-16 w-16 text-accent" />
        <h1 className="mt-4 font-display text-2xl font-bold text-foreground">Payment received</h1>
        <p className="mt-2 text-sm text-muted-foreground">Thanks for your purchase. Your tokens are being credited.</p>
        {sessionId && <p className="mt-2 text-xs font-mono text-muted-foreground break-all">Session: {sessionId}</p>}
        <div className="mt-4 flex items-center justify-center gap-2 text-sm">
          {balance === null ? (
            <><Loader2 className="h-4 w-4 animate-spin text-primary" /> <span className="text-muted-foreground">Crediting...</span></>
          ) : (
            <span className="font-semibold text-foreground">Current balance: {balance} tokens</span>
          )}
        </div>
        <Link to="/" className="mt-6 inline-block w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground hover:opacity-90">
          Back to store
        </Link>
        <Link to="/account" className="mt-2 inline-block text-sm text-primary hover:underline">View purchase history</Link>
      </div>
    </div>
  );
}
