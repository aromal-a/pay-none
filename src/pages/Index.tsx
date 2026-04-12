import { useState } from "react";
import { motion } from "framer-motion";
import { Coins, Wallet } from "lucide-react";
import TokenCard from "@/components/TokenCard";
import UpiPaymentDialog from "@/components/UpiPaymentDialog";

const tokenPackages = [
  { tier: "bronze" as const, tokens: 100, price: 99 },
  { tier: "silver" as const, tokens: 500, price: 399, bonus: 50 },
  { tier: "gold" as const, tokens: 1500, price: 999, bonus: 200 },
];

const Index = () => {
  const [selectedPackage, setSelectedPackage] = useState<typeof tokenPackages[0] | null>(null);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-40">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary p-2">
              <Coins className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-xl font-bold text-foreground">TokenStore</span>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-secondary px-4 py-2">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">0 tokens</span>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 pt-16 pb-12 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Buy Tokens
          </h1>
          <p className="mt-3 text-lg text-muted-foreground max-w-md mx-auto">
            Power up your account with tokens. Pay instantly via UPI.
          </p>
        </motion.div>
      </section>

      {/* Token Cards */}
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
                bonus={pkg.bonus}
                onBuy={() => setSelectedPackage(pkg)}
              />
            </motion.div>
          ))}
        </div>
      </section>

      {/* UPI Dialog */}
      <UpiPaymentDialog
        open={!!selectedPackage}
        onClose={() => setSelectedPackage(null)}
        amount={selectedPackage?.price ?? 0}
        tokens={selectedPackage ? selectedPackage.tokens + (selectedPackage.bonus ?? 0) : 0}
      />
    </div>
  );
};

export default Index;
