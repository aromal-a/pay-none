import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Coins, Zap, Crown, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n, interpolate } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PromptDialog } from "@/components/PromptDialog";

/* Tier-Terminologies: expressive tier naming lives here */
/* Tier: bronze = Ozonized, silver = Sub_vertical, gold = Freak_code */

declare global {
  interface Window {
    Razorpay: any;
  }
}

const RZP_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";

const loadRazorpay = () =>
  new Promise<boolean>((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = RZP_SCRIPT;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });


interface TokenCardProps {
  tier: string;
  tokens: number;
  price: number;
  bonus?: number;
  isAuthenticated: boolean;
  onRequireAuth: () => void;
}

const tierConfig: Record<
  string,
  {
    icon: typeof Coins;
    labelKey: "Ozonized" | "Sub_vertical" | "Freak_code";
    gradient: string;
    border: string;
    shadow: string;
    bg: string;
    badge?: boolean;
  }
> = {
  /* Ozonized */
  bronze: {
    icon: Coins,
    labelKey: "Ozonized",
    gradient: "from-orange-400 to-amber-600",
    border: "border-token-bronze/30",
    shadow: "shadow-[0_8px_30px_-8px_hsl(var(--token-bronze)/0.3)]",
    bg: "bg-gradient-to-br from-orange-50 to-amber-50",
  },
  /* Sub_vertical */
  silver: {
    icon: Zap,
    labelKey: "Sub_vertical",
    gradient: "from-slate-400 to-slate-600",
    border: "border-token-silver/30",
    shadow: "shadow-[0_8px_30px_-8px_hsl(var(--token-silver)/0.3)]",
    bg: "bg-gradient-to-br from-slate-50 to-gray-100",
    badge: true,
  },
  /* Freak_code */
  gold: {
    icon: Crown,
    labelKey: "Freak_code",
    gradient: "from-yellow-400 to-amber-500",
    border: "border-token-gold/30",
    shadow: "shadow-[0_12px_40px_-8px_hsl(var(--token-gold)/0.4)]",
    bg: "bg-gradient-to-br from-yellow-50 to-amber-50",
  },
};

const defaultConfig = {
  icon: Coins,
  labelKey: "Ozonized" as const,
  gradient: "from-gray-400 to-gray-600 bg-[#596548]",
  border: "border-border",
  shadow: "shadow-none",
  bg: "bg-muted",
};

const TokenCard = ({ tier, tokens, price, bonus, isAuthenticated, onRequireAuth }: TokenCardProps) => {
  const config = tierConfig[tier] ?? defaultConfig;
  const Icon = config.icon;
  const { t } = useI18n();
  const [quantity, setQuantity] = useState(1);
  const [paying, setPaying] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);

  useEffect(() => {
    loadRazorpay();
  }, []);

  const totalTokens = tokens * quantity;
  const totalPrice = price * quantity;

  const handlePay = async () => {
    if (!isAuthenticated) {
      onRequireAuth();
      return;
    }
    setPaying(true);
    try {
      const ok = await loadRazorpay();
      if (!ok) throw new Error("Failed to load Razorpay");

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error("Please sign in");

      const { data, error } = await supabase.functions.invoke("razorpay-create-order", {
        body: { tier, quantity },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (error || !data?.orderId) throw new Error(error?.message || "Order failed");

      const rzp = new window.Razorpay({
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        order_id: data.orderId,
        name: "QueenToken",
        description: `${data.tokens} tokens (${quantity} × ${tier})`,
        theme: { color: "#6366f1" },
        handler: async (resp: any) => {
          try {
            const { data: verify, error: vErr } = await supabase.functions.invoke("razorpay-verify-payment", {
              body: resp,
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (vErr || !verify?.ok) throw new Error(vErr?.message || "Verification failed");
            toast.success(`${verify.tokens} tokens added to your wallet!`);
            setQuantity(1);
            setPromptOpen(true);
          } catch (err: any) {
            toast.error(err.message || "Payment verification failed");
          } finally {
            setPaying(false);
          }
        },
        modal: { ondismiss: () => setPaying(false) },
      });
      rzp.open();
    } catch (err: any) {
      toast.error(err.message || "Payment failed");
      setPaying(false);
    }
  };


  return (
    <motion.div
      whileHover={{ y: -6, scale: 1.02 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className={cn("relative rounded-2xl border-2 p-6 transition-all", config.border, config.shadow, config.bg)}
    >
      {"badge" in config && config.badge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-semibold text-primary-foreground">
          {t.mostPopular}
        </div>
      )}

      <div
        className={cn(
          "mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br",
          config.gradient,
        )}
      >
        <Icon className="h-7 w-7 text-primary-foreground" />
      </div>

      <h3 className="text-center font-display text-lg font-bold text-foreground">{config.labelKey}</h3>

      <div className="mt-3 text-center">
        <span className="font-display text-4xl font-bold text-foreground">{totalTokens}</span>
        <span className="ml-1 text-sm text-muted-foreground">{t.tokens}</span>
      </div>

      {bonus && <p className="mt-1 text-center text-sm font-medium text-accent">{interpolate(t.bonusTokens, bonus)}</p>}

      <div className="mt-4 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
          disabled={quantity <= 1}
          aria-label="Decrease quantity"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-foreground transition hover:bg-secondary disabled:opacity-40"
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="min-w-[2ch] text-center font-display text-lg font-semibold text-foreground">{quantity}</span>
        <button
          type="button"
          onClick={() => setQuantity((q) => Math.min(99, q + 1))}
          aria-label="Increase quantity"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-foreground transition hover:bg-secondary"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 rounded-xl bg-card/80 py-3 text-center backdrop-blur">
        <span className="font-display text-2xl font-bold text-foreground">₹{totalPrice}</span>
        {quantity > 1 && (
          <span className="ml-2 text-xs text-muted-foreground">({quantity} × ₹{price})</span>
        )}
      </div>

      <div className="mt-4">
        <button
          type="button"
          onClick={handlePay}
          disabled={paying}
          className="block w-full rounded-xl bg-primary px-4 py-3 text-center font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {paying ? "Loading…" : isAuthenticated ? t.buyNow : "Sign in to buy"}
        </button>
      </div>
      <PromptDialog open={promptOpen} onOpenChange={setPromptOpen} />
    </motion.div>
  );
};

export default TokenCard;
