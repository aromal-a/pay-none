import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import LanguageSelector from "@/components/LanguageSelector";
import { toast } from "sonner";

const TIERS: Record<string, { tokens: number; amount: number; label: string }> = {
  bronze: { tokens: 112, amount: 1, label: "Ozonized — ₹1 → 112 tokens" },
  silver: { tokens: 578, amount: 15, label: "Sub_vertical — ₹15 → 578 tokens" },
  gold: { tokens: 957, amount: 24, label: "Freak_code — ₹24 → 957 tokens" },
};

export default function LaneAbleCredit() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [isLaneAble, setIsLaneAble] = useState<boolean | null>(null);

  const [email, setEmail] = useState("");
  const [paymentId, setPaymentId] = useState("");
  const [tier, setTier] = useState<keyof typeof TIERS>("bronze");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate("/auth", { replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "lane_able")
      .maybeSingle()
      .then(({ data }) => setIsLaneAble(!!data));
  }, [user]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !paymentId.trim()) {
      toast.error("Email and Razorpay payment ID are required");
      return;
    }
    setSubmitting(true);
    const { tokens, amount } = TIERS[tier];
    const { data, error } = await supabase.rpc("admin_credit_tokens", {
      p_user_email: email.trim(),
      p_tokens: tokens,
      p_amount_inr: amount,
      p_razorpay_payment_id: paymentId.trim(),
      p_tier: tier,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Credited ${tokens} tokens to ${email}`);
    setEmail("");
    setPaymentId("");
    console.log("admin_credit_tokens result:", data);
  };

  if (!user || isLaneAble === null) return null;

  if (!isLaneAble) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md text-center">
          <h1 className="font-display text-2xl font-bold text-foreground">Not authorized</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You need the LAN-abled role to access this page.
          </p>
          <Link to="/" className="mt-4 inline-block text-sm text-primary hover:underline">
            ← Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-40">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <div className="flex items-center gap-2">
            <LanguageSelector />
            <span className="flex items-center gap-1.5 text-xs font-semibold text-primary">
              <ShieldCheck className="h-4 w-4" /> LAN-abled
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="font-display text-3xl font-bold text-foreground">Credit tokens</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          After confirming a payment in your Razorpay dashboard, fill this form to credit the
          customer's wallet and write a purchase history row.
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-5 rounded-2xl border border-border bg-card p-6">
          <div>
            <label className="block text-sm font-semibold text-foreground">Customer email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="customer@example.com"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Must match the email they used to sign up.
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-foreground">Razorpay payment ID</label>
            <input
              type="text"
              value={paymentId}
              onChange={(e) => setPaymentId(e.target.value)}
              required
              placeholder="pay_XXXXXXXXXXXXXX"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Used to prevent crediting the same payment twice.
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-foreground">Tier</label>
            <select
              value={tier}
              onChange={(e) => setTier(e.target.value as keyof typeof TIERS)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {Object.entries(TIERS).map(([key, t]) => (
                <option key={key} value={key}>{t.label}</option>
              ))}
            </select>
          </div>

          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            <p className="text-muted-foreground">Will credit:</p>
            <p className="font-semibold text-foreground">
              +{TIERS[tier].tokens} tokens · ₹{TIERS[tier].amount}
            </p>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Crediting…" : "Credit tokens"}
          </button>
        </form>
      </main>
    </div>
  );
}
