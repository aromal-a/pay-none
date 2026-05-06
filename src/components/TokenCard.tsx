import { motion } from "framer-motion";
import { Coins, Zap, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n, interpolate } from "@/lib/i18n";
import RazorpayButton from "./RazorpayButton";

const RAZORPAY_BUTTON_ID = "pl_Sm669Tqq3Ri1wP";

interface TokenCardProps {
  tier: "bronze" | "silver" | "gold";
  tokens: number;
  price: number;
  bonus?: number;
  onBuy: () => void;
}

const tierConfig = {
  bronze: {
    icon: Coins,
    labelKey: "starter" as const,
    gradient: "from-orange-400 to-amber-600",
    border: "border-token-bronze/30",
    shadow: "shadow-[0_8px_30px_-8px_hsl(var(--token-bronze)/0.3)]",
    bg: "bg-gradient-to-br from-orange-50 to-amber-50",
  },
  silver: {
    icon: Zap,
    labelKey: "popular" as const,
    gradient: "from-slate-400 to-slate-600",
    border: "border-token-silver/30",
    shadow: "shadow-[0_8px_30px_-8px_hsl(var(--token-silver)/0.3)]",
    bg: "bg-gradient-to-br from-slate-50 to-gray-100",
    badge: true,
  },
  gold: {
    icon: Crown,
    labelKey: "premium" as const,
    gradient: "from-yellow-400 to-amber-500",
    border: "border-token-gold/30",
    shadow: "shadow-[0_12px_40px_-8px_hsl(var(--token-gold)/0.4)]",
    bg: "bg-gradient-to-br from-yellow-50 to-amber-50",
  },
};

const TokenCard = ({ tier, tokens, price, bonus, onBuy }: TokenCardProps) => {
  const config = tierConfig[tier];
  const Icon = config.icon;
  const { t } = useI18n();

  return (
    <motion.div
      whileHover={{ y: -6, scale: 1.02 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className={cn(
        "relative rounded-2xl border-2 p-6 cursor-pointer transition-all",
        config.border, config.shadow, config.bg
      )}
      onClick={onBuy}
    >
      {"badge" in config && config.badge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-semibold text-primary-foreground">
          {t.mostPopular}
        </div>
      )}

      <div className={cn("mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br", config.gradient)}>
        <Icon className="h-7 w-7 text-primary-foreground" />
      </div>

      <h3 className="text-center font-display text-lg font-bold text-foreground">
        {t[config.labelKey]}
      </h3>

      <div className="mt-3 text-center">
        <span className="font-display text-4xl font-bold text-foreground">{tokens}</span>
        <span className="ml-1 text-sm text-muted-foreground">{t.tokens}</span>
      </div>

      {bonus && (
        <p className="mt-1 text-center text-sm font-medium text-accent">
          {interpolate(t.bonusTokens, bonus)}
        </p>
      )}

      <div className="mt-4 rounded-xl bg-card/80 py-3 text-center backdrop-blur">
        <span className="font-display text-2xl font-bold text-foreground">₹{price}</span>
      </div>

      <button className="mt-4 w-full rounded-xl bg-gradient-to-r from-primary to-primary/80 py-3 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 active:scale-[0.98]">
        {t.buyNow}
      </button>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); onBuy(); }}
          className="flex items-center justify-center gap-1.5 rounded-xl border-2 border-border bg-card py-2.5 text-xs font-semibold text-foreground transition-all hover:border-blue-400 hover:bg-blue-50 active:scale-[0.98]"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 001 12c0 1.77.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Google Pay
        </button>
        <div onClick={(e) => e.stopPropagation()} className="flex items-center justify-center rounded-xl border-2 border-border bg-card py-1 transition-all hover:border-blue-400 hover:bg-blue-50">
          <RazorpayButton buttonId={RAZORPAY_BUTTON_ID} />
        </div>
      </div>
    </motion.div>
  );
};

export default TokenCard;
