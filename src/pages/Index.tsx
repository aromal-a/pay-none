import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Coins, Wallet, User, LogIn, Search, Radio, ShieldCheck, Check } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import TokenCard from "@/components/TokenCard";
import LanguageSelector from "@/components/LanguageSelector";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { PromptDialog } from "@/components/PromptDialog";

const VocalPackages = [
  { tier: "bronze" as const, tokens: 112, price: 1 },
  { tier: "silver" as const, tokens: 578, price: 15 },
  { tier: "gold" as const, tokens: 957, price: 24 },
];

const Index = () => {
  const [balance, setBalance] = useState(0);
  const [aiOpen, setAiOpen] = useState(false);
  const [tcAccepted, setTcAccepted] = useState<boolean>(
    () => typeof window !== "undefined" && localStorage.getItem("qt_tc_accepted") === "1",
  );
  const acceptTC = () => {
    localStorage.setItem("qt_tc_accepted", "1");
    localStorage.setItem("qt_tc_accepted_at", new Date().toISOString());
    setTcAccepted(true);
  };
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const refreshBalance = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("token_balance")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) setBalance(data.token_balance);
  };

  useEffect(() => {
    if (!user) {
      setBalance(0);
      return;
    }
    refreshBalance();
  }, [user]);

  // Handle Razorpay hosted-link redirect: /?paid=<tier>&q=<quantity>
  useEffect(() => {
    const paidTier = searchParams.get("paid");
    if (!paidTier) return;
    const tierNames: Record<string, string> = {
      bronze: "OZONIZED",
      silver: "SUB_VERTICAL",
      gold: "FREAK_CODE",
    };
    const label = tierNames[paidTier] ?? paidTier.toUpperCase();
    toast.success(`Payment received — ${label} tokens are being credited to your wallet.`);
    let tries = 0;
    const iv = setInterval(async () => {
      tries += 1;
      await refreshBalance();
      if (tries >= 10) clearInterval(iv);
    }, 1500);
    const next = new URLSearchParams(searchParams);
    next.delete("paid");
    next.delete("q");
    setSearchParams(next, { replace: true });
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-40">
        <div className="mx-auto flex max-w-5xl flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-6 py-4">
          <div className="flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-start">
            <div className="rounded-lg bg-primary p-2 shrink-0">
              <Coins className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-base sm:text-xl font-bold text-foreground truncate">
              Human Vocord Box
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
            <LanguageSelector />
            {user ? (
              <>
                <div className="flex flex-col sm:flex-row items-center gap-2">
                  <button
                    onClick={() => setAiOpen(true)}
                    className="flex items-center gap-2 rounded-full bg-secondary px-3 sm:px-4 py-2 hover:bg-secondary/80 transition-colors text-sm whitespace-nowrap"
                    title="Spend tokens — chat with AI"
                  >
                    <Wallet className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">
                      {balance} {t.balance}
                    </span>
                  </button>
                  <Link
                    to="/chat"
                    title="Open prompt chat"
                    className="flex items-center gap-2 bg-secondary px-3 sm:px-4 py-2 text-sm hover:bg-secondary/80 transition-colors w-full max-w-[180px] sm:w-64 border border-dotted shadow-sm opacity-100 rounded-md"
                  >
                    <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground truncate">Share resources to pull leverages</span>
                  </Link>
                </div>
                <Link
                  to="/live"
                  title="Join the live room"
                  className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-2 text-sm hover:bg-secondary/80 whitespace-nowrap"
                >
                  <Radio className="h-4 w-4 text-destructive" />
                  <span className="font-medium text-foreground">Live</span>
                </Link>
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
          {VocalPackages.map((pkg, i) => (
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

      <section className="mx-auto max-w-3xl px-6 pb-12">
        <div className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h2 className="font-display text-lg font-semibold text-foreground">
              Terms & Conditions — Ethics Dashboard
            </h2>
          </div>
          <ul className="text-sm text-muted-foreground space-y-2 list-disc pl-5">
            <li>
              The <strong className="text-foreground">Previewer</strong> is the entity always holding
              <em> action</em>, <em>cut</em>, and <em>call</em>.
            </li>
            <li>
              The <strong className="text-foreground">Viewer</strong> is a paid choice, available only to users with a
              token balance.
            </li>
            <li>
              No viewer action is argued over count balances — only the{" "}
              <strong className="text-foreground">spending involved</strong> matters.
            </li>
            <li>
              When no spending is involved and access is not cached, the relation is a specific
              <em> self-renouncement</em> by the participant.
            </li>
            <li>
              Paired actions remain simple; entity animosity is governed by these terms and the same ethics surfaced on
              this dashboard.
            </li>
          </ul>
          <div className="mt-5 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-muted-foreground">Click to confirm you have read and agree to these terms.</p>
            {tcAccepted ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">
                <Check className="h-4 w-4" /> Accepted
              </span>
            ) : (
              <button
                onClick={acceptTC}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
              >
                <Check className="h-4 w-4" /> I Agree
              </button>
            )}
          </div>
        </div>
      </section>

      <footer className="mx-auto max-w-4xl px-6 pb-10 text-center text-xs text-muted-foreground space-y-2">
        <p>
          Text_Addendum is based on, recent coverages, coverages based on tax, tax information.codified Emit - Dont's ,
          Remit - FONTS
        </p>
        <p className="max-w-2xl mx-auto">
          Privacy©: voice notes, photos, and short films (under 1 minute) you record or upload remain user-owned and are
          stored locally in your browser by default. Nothing is shared, scraped, or published without your explicit
          action. Content is not used as a critical play, training fodder, or capture of biometric modalities. Mono /
          mono-dub / dub-audio routing, B/W camera filters, and live audio + vision responses run on-device; scraped or
          imported audio is only used for the dub you initiate. Labeling and frame inspection happen at your request.
        </p>
      </footer>

      <PromptDialog open={aiOpen} onOpenChange={setAiOpen} />
    </div>
  );
};

export default Index;
