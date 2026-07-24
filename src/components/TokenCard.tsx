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

/*
 * Tier-exclusive easter-eggs (access specifiers).
 * Each card hides ONE specifier visible only on its own tier — used downstream
 * by Transformative-AI to grade user-spend, lecture-formation tier, and
 * server-knowledge distribution lane for next-gen format/template validation.
 */
const tierEasterEgg: Record<string, { code: string; lane: string; lecture: string; hint: string }> = {
  bronze: {
    code: "OZ-Δ-112",
    lane: "fact.lane/seed",
    lecture: "L0 · seed-formation",
    hint: "tap the coin 3×",
  },
  silver: {
    code: "SV-Σ-578",
    lane: "fact.lane/vertical",
    lecture: "L1 · vertical-distribution",
    hint: "tap the bolt 3×",
  },
  gold: {
    code: "GD-Ω-957",
    lane: "fact.lane/freak",
    lecture: "L2 · freak-code lecture",
    hint: "tap the crown 3×",
  },
};

// Hosted Razorpay Payment Links per tier.
// The webhook (razorpay-webhook edge function) credits tokens after payment_link.paid.
const PAYMENT_LINKS: Record<string, string> = {
  bronze: "https://rzp.io/rzp/fARC70to",   // OZONIZED
  silver: "https://rzp.io/rzp/GQHvuFq6",   // SUB_VERTICAL
  gold:   "https://rzp.io/rzp/vr6MGW8",    // FREAK_CODE
};


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
  const [eggTaps, setEggTaps] = useState(0);
  const [eggOpen, setEggOpen] = useState(false);
  const egg = tierEasterEgg[tier];

  const totalTokens = tokens * quantity;
  const totalPrice = price * quantity;

  const handlePay = async () => {
    if (!isAuthenticated) {
      onRequireAuth();
      return;
    }
    const base = PAYMENT_LINKS[tier];
    if (!base) {
      toast.error("Payment link not configured for this tier");
      return;
    }
    setPaying(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const email = sessionData?.session?.user?.email ?? "";
      const userId = sessionData?.session?.user?.id ?? "";

      // Redirect target after payment: back to /?paid=<tier>&q=<quantity>
      const callback = `${window.location.origin}/?paid=${encodeURIComponent(tier)}&q=${quantity}`;

      // Prefill + notes travel with the hosted link so the webhook can identify the buyer.
      const params = new URLSearchParams();
      if (email) params.set("prefill[email]", email);
      params.set("notes[user_id]", userId);
      params.set("notes[tier]", tier);
      params.set("notes[quantity]", String(quantity));
      params.set("notes[unit_price]", String(price));
      params.set("callback_url", callback);
      params.set("callback_method", "get");

      const url = `${base}?${params.toString()}`;
      window.location.href = url;
    } catch (err: any) {
      toast.error(err.message || "Could not open payment page");
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
        onClick={() => {
          const next = eggTaps + 1;
          setEggTaps(next);
          if (next >= 3) {
            setEggOpen(true);
            setEggTaps(0);
          }
        }}
        className={cn(
          "mx-auto mb-4 flex h-14 w-14 cursor-pointer items-center justify-center rounded-xl bg-gradient-to-br select-none",
          config.gradient,
        )}
        title={egg?.hint}
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
      {egg && eggOpen && (
        <div className="mt-4 rounded-xl border border-dashed border-primary/40 bg-card/70 p-3 text-left text-xs backdrop-blur">
          <div className="font-display text-sm font-bold text-foreground">access · {egg.code}</div>
          <div className="mt-1 text-muted-foreground">lane = {egg.lane}</div>
          <div className="text-muted-foreground">lecture = {egg.lecture}</div>
          <div className="mt-2 text-[10px] text-muted-foreground/70">
            tier-private · invisible to other packages · feeds Transformative-AI fact-coded validation
          </div>
          <button
            type="button"
            onClick={() => setEggOpen(false)}
            className="mt-2 text-[10px] underline text-muted-foreground hover:text-foreground"
          >
            hide
          </button>
        </div>
      )}
      <PromptDialog open={promptOpen} onOpenChange={setPromptOpen} />
    </motion.div>
  );
};

export default TokenCard;
