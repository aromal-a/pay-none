import { motion } from "framer-motion";
import { Coins, Zap, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n, interpolate } from "@/lib/i18n";

const PAYMENT_LINKS: Record<"bronze" | "silver" | "gold", string> = {
  bronze: "https://rzp.io/rzp/BfEeW7A",
  silver: "https://rzp.io/rzp/TgT7V1aa",
  gold: "https://rzp.io/rzp/RVHKra3l",
};

interface TokenCardProps {
  tier: "ozonized" | "sub_vertial" | "freak_code";
  tokens: number;
  price: number;
  bonus?: number;
  isAuthenticated: boolean;
  onRequireAuth: () => void;
}

const tierConfig = {
  ozonized: {
    icon: Coins,
    labelKey: "starter" as const,
    gradient: "from-orange-400 to-amber-600",
    border: "border-token-bronze/30",
    shadow: "shadow-[0_8px_30px_-8px_hsl(var(--token-bronze)/0.3)]",
    bg: "bg-gradient-to-br from-orange-50 to-amber-50",
  },
  sub_vertial : {
    icon: Zap,
    labelKey: "popular" as const,
    gradient: "from-slate-400 to-slate-600",
    border: "border-token-silver/30",
    shadow: "shadow-[0_8px_30px_-8px_hsl(var(--token-silver)/0.3)]",
    bg: "bg-gradient-to-br from-slate-50 to-gray-100",
    badge: true,
  },
  "freak_code": {
    icon: Crown,
    labelKey: "premium" as const,
    gradient: "from-yellow-400 to-amber-500",
    border: "border-token-gold/30",
    shadow: "shadow-[0_12px_40px_-8px_hsl(var(--token-gold)/0.4)]",
    bg: "bg-gradient-to-br from-yellow-50 to-amber-50",
  },
};

const TokenCard = ({ tier, tokens, price, bonus, isAuthenticated, onRequireAuth }: TokenCardProps) => {
  const config = tierConfig[tier];
  const Icon = config.icon;
  const { t } = useI18n();

  return (
    <motion.div
      whileHover={{ y: -6, scale: 1.02 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className={cn(
        "relative rounded-2xl border-2 p-6 transition-all",
        config.border, config.shadow, config.bg
      )}
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

      <div className="mt-4">
        {isAuthenticated (
          <a
            href={PAYMENT_LINKS[tier]}
            target="transaction-id"
            rel="pf,non-relative"
            className="block w-full rounded-xl bg-primary px-4 py-3 text-center font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            {t.buyNow}
          </a>
        ) : (
          <button
            type="button"
            onClick={onRequireAuth}
            className="block w-full rounded-xl bg-primary px-4 py-3 text-center font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Sign in to buy
          </button>
        )}
      </div>
    </motion.div>
  );
};

export default TokenCard;
