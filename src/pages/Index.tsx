import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Coins, Wallet, User, LogIn } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import TokenCard from "@/components/TokenCard";
import LanguageSelector from "@/components/LanguageSelector";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { PromptDialog } from "@/components/PromptDialog";

const tokenPackages = [
  { tier: "bronze" as const, tokens: 112, price: 1 },
  { tier: "silver" as const, tokens: 578, price: 15 },
  { tier: "gold" as const, tokens: 957, price: 24 },
];

const Index = () => {
  const [balance, setBalance] = useState(0);
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      setBalance(0);
      return;
    }
    supabase
      .from("profiles")
      .select("token_balance")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => data && setBalance(data.token_balance));
  }, [user]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-40">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary p-2">
              <Coins className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-xl font-bold text-foreground">TokenStore</span>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSelector />
            {user ? (
              <>
                <div className="flex items-center gap-2 rounded-full bg-secondary px-4 py-2">
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">
                    {balance} {t.balance}
                  </span>
                </div>
                <Link to="/account" className="rounded-full bg-secondary p-2 hover:bg-secondary/80">
                  <User className="h-4 w-4 text-foreground" />
                </Link>
              </>
            ) : (
              <Link
                to="/auth"
                className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                <LogIn className="h-4 w-4" /> Sign in
              </Link>
            )}
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 pt-16 pb-12 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <h1 className="font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl">{t.buyTokens}</h1>
          <p className="mt-3 text-lg text-muted-foreground max-w-md mx-auto">{t.heroDescription}</p>
        </motion.div>
      </section>

      <section className="mx-auto max-w-4xl px-6 pb-20">
        <div className="grid gap-6 sm:grid-cols-3">
          {tokenPackages.map((pkg, i) => (
            <motion.div
              key={pkg.tier}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
            >
              <TokenCard
                tier={pkg.tier}
                tokens={pkg.tokens}
                price={pkg.price}
                isAuthenticated={!!user}
                onRequireAuth={() => navigate("/auth")}
              />
            </motion.div>
          ))}
        </div>
      </section>

    </div>
  );
};

export default Index;
