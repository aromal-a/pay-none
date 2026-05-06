import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Coins, ArrowLeft, LogOut } from "lucide-react";

interface Tx {
  id: string;
  price_id: string;
  amount_cents: number;
  currency: string;
  tokens_credited: number;
  created_at: string;
}

export default function Account() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [balance, setBalance] = useState(0);
  const [txns, setTxns] = useState<Tx[]>([]);

  useEffect(() => {
    if (!loading && !user) navigate("/auth", { replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("token_balance").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => data && setBalance(data.token_balance));
    supabase.from("token_transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => data && setTxns(data as Tx[]));
  }, [user]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-40">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <button onClick={() => signOut().then(() => navigate("/auth"))} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="font-display text-3xl font-bold text-foreground">Account</h1>
        <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>

        <div className="mt-6 rounded-2xl border border-border bg-gradient-to-br from-primary/10 to-accent/10 p-6">
          <div className="flex items-center gap-3">
            <Coins className="h-8 w-8 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Current balance</p>
              <p className="font-display text-3xl font-bold text-foreground">{balance} tokens</p>
            </div>
          </div>
        </div>

        <h2 className="mt-8 font-display text-xl font-bold text-foreground">Purchase history</h2>
        <div className="mt-3 rounded-2xl border border-border bg-card divide-y divide-border">
          {txns.length === 0 && <p className="p-6 text-sm text-muted-foreground text-center">No purchases yet.</p>}
          {txns.map((t) => (
            <div key={t.id} className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm font-semibold text-foreground">+{t.tokens_credited} tokens</p>
                <p className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString()} · {t.price_id}</p>
              </div>
              <p className="font-semibold text-foreground">${(t.amount_cents / 100).toFixed(2)}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
