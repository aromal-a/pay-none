import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Smartphone, CheckCircle2, Loader2, IndianRupee, Shield, AlertTriangle, Info, Clock } from "lucide-react";
import { generateTxnId, tokenBalance, transactionStore, RECEIVER_CONFIRM_DELAY, MERCHANT_INFO, type PaymentTransaction } from "@/lib/paymentState";
import { useI18n, interpolate } from "@/lib/i18n";

interface UpiPaymentDialogProps {
  open: boolean;
  onClose: () => void;
  amount: number;
  tokens: number;
}

type Step = "enter-upi" | "confirm" | "processing" | "awaiting" | "success";

const MIN_AMOUNT = 200;
const GST_RATE = 0.18;

const UpiPaymentDialog = ({ open, onClose, amount, tokens }: UpiPaymentDialogProps) => {
  const [step, setStep] = useState<Step>("enter-upi");
  const [upiId, setUpiId] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [payMode, setPayMode] = useState<"app" | "upi" | "phone">("app");
  const [selectedApp, setSelectedApp] = useState<string | null>(null);
  const [txn, setTxn] = useState<PaymentTransaction | null>(null);
  const { t } = useI18n();

  const upiApps = [
    { id: "gpay", name: "Google Pay", color: "bg-blue-500", featured: true },
    { id: "phonepe", name: "PhonePe", color: "bg-purple-600" },
    { id: "paytm", name: "Paytm", color: "bg-sky-500" },
    { id: "bhim", name: "BHIM", color: "bg-green-600" },
  ];

  const isBelowMinimum = amount < MIN_AMOUNT;
  const baseAmount = Math.round(amount / (1 + GST_RATE));
  const taxAmount = amount - baseAmount;
  const isPayReady = !isBelowMinimum && (selectedApp || upiId || phoneNumber.length >= 10);

  const payLabel = selectedApp
    ? upiApps.find((a) => a.id === selectedApp)?.name ?? selectedApp
    : phoneNumber
    ? `+91 ${phoneNumber}`
    : upiId;

  const handleProceedToConfirm = () => {
    if (!isPayReady) return;
    setStep("confirm");
  };

  const handleConfirmPay = () => {
    const transaction: PaymentTransaction = {
      id: generateTxnId(),
      amount,
      tokens,
      status: "pending",
      payMethod: payMode,
      payTo: payLabel || "",
      timestamp: Date.now(),
      gst: taxAmount,
      subtotal: baseAmount,
    };
    setTxn(transaction);
    setStep("processing");

    setTimeout(() => {
      setTxn((prev) => prev ? { ...prev, status: "awaiting_confirmation" } : prev);
      setStep("awaiting");

      setTimeout(() => {
        const confirmedTxn: PaymentTransaction = { ...transaction, status: "confirmed" };
        setTxn(confirmedTxn);
        transactionStore.add(confirmedTxn);
        tokenBalance.add(tokens);
        setStep("success");
      }, RECEIVER_CONFIRM_DELAY);
    }, 2000);
  };

  const handleClose = () => {
    setStep("enter-upi");
    setUpiId("");
    setPhoneNumber("");
    setPayMode("app");
    setSelectedApp(null);
    setTxn(null);
    onClose();
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4"
        onClick={step === "processing" || step === "awaiting" ? undefined : handleClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="w-full max-w-md rounded-3xl bg-card shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="relative bg-gradient-to-r from-upi-blue to-primary p-5">
            {step !== "processing" && step !== "awaiting" && (
              <button onClick={handleClose} className="absolute right-4 top-4 rounded-full bg-primary-foreground/20 p-1.5 text-primary-foreground transition hover:bg-primary-foreground/30">
                <X className="h-4 w-4" />
              </button>
            )}
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary-foreground/20 p-2.5">
                <IndianRupee className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <p className="text-sm text-primary-foreground/80">{t.payViaUpi}</p>
                <p className="font-display text-2xl font-bold text-primary-foreground">₹{amount}</p>
              </div>
            </div>
            <p className="mt-2 text-sm text-primary-foreground/70">{interpolate(t.forTokens, tokens)}</p>
          </div>

          {/* Body */}
          <div className="p-6">
            {step === "enter-upi" && isBelowMinimum && (
              <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/5 p-3.5">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <div>
                  <p className="text-sm font-semibold text-destructive">{interpolate(t.minAmountRequired, MIN_AMOUNT)}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{t.minAmountDesc}</p>
                </div>
              </div>
            )}

            {step === "enter-upi" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="flex gap-2 mb-5">
                  {([
                    { key: "app" as const, label: t.upiApp },
                    { key: "phone" as const, label: t.phoneNumber },
                    { key: "upi" as const, label: t.upiId },
                  ]).map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => { setPayMode(tab.key); setSelectedApp(null); setUpiId(""); setPhoneNumber(""); }}
                      className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${
                        payMode === tab.key
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {payMode === "app" && (
                  <div className="space-y-3 mb-5">
                    {/* Featured Google Pay button */}
                    <button
                      onClick={() => setSelectedApp("gpay")}
                      className={`w-full flex items-center gap-3 rounded-xl border-2 p-4 transition-all ${
                        selectedApp === "gpay"
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30 scale-[1.01]"
                          : "border-border hover:border-blue-300"
                      }`}
                    >
                      <svg viewBox="0 0 24 24" className="h-8 w-8 shrink-0" fill="none">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 001 12c0 1.77.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                      <div className="text-left">
                        <span className="text-sm font-bold text-foreground">Google Pay</span>
                        <p className="text-[11px] text-muted-foreground">Quick & secure checkout</p>
                      </div>
                      {selectedApp === "gpay" && (
                        <CheckCircle2 className="ml-auto h-5 w-5 text-blue-500" />
                      )}
                    </button>

                    {/* Other UPI apps */}
                    <div className="grid grid-cols-3 gap-3">
                      {upiApps.filter(a => a.id !== "gpay").map((app) => (
                        <button
                          key={app.id}
                          onClick={() => setSelectedApp(app.id)}
                          className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 transition-all ${
                            selectedApp === app.id
                              ? "border-primary bg-primary/5 scale-105"
                              : "border-border hover:border-primary/30"
                          }`}
                        >
                          <div className={`h-10 w-10 rounded-full ${app.color} flex items-center justify-center`}>
                            <Smartphone className="h-5 w-5 text-primary-foreground" />
                          </div>
                          <span className="text-[11px] font-medium text-foreground">{app.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {payMode === "phone" && (
                  <div className="mb-5">
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t.enterMobile}</label>
                    <div className="flex items-center gap-2 rounded-xl border-2 border-border bg-secondary/50 px-4 py-3 focus-within:border-primary transition-colors">
                      <span className="text-sm font-medium text-muted-foreground">+91</span>
                      <input
                        type="tel"
                        inputMode="numeric"
                        maxLength={10}
                        placeholder="9876543210"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
                        className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                      />
                    </div>
                    {phoneNumber.length > 0 && phoneNumber.length < 10 && (
                      <p className="mt-1.5 text-xs text-destructive">{t.enterValidNumber}</p>
                    )}
                  </div>
                )}

                {payMode === "upi" && (
                  <input
                    type="text"
                    placeholder="yourname@upi"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    className="mb-5 w-full rounded-xl border-2 border-border bg-secondary/50 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none transition-colors"
                  />
                )}

                <button
                  onClick={handleProceedToConfirm}
                  disabled={!isPayReady}
                  className="w-full rounded-xl bg-upi-green py-3.5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {t.continue_}
                </button>

                <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                  <Shield className="h-3.5 w-3.5" />
                  {t.securedByUpi}
                </div>
              </motion.div>
            )}

            {step === "confirm" && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                <p className="mb-4 text-sm font-semibold text-foreground">{t.reviewConfirm}</p>
                <div className="rounded-xl border border-border bg-secondary/30 p-4 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t.merchant}</span>
                    <span className="font-medium text-foreground">{MERCHANT_INFO.merchantName}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t.payingVia}</span>
                    <span className="font-medium text-foreground">{payLabel}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t.tokens}</span>
                    <span className="font-medium text-foreground">{tokens}</span>
                  </div>
                  <div className="border-t border-border pt-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t.subtotal}</span>
                      <span className="text-foreground">₹{baseAmount}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t.gstLabel}</span>
                      <span className="text-foreground">₹{taxAmount}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold border-t border-border pt-2">
                      <span className="text-foreground">{t.total}</span>
                      <span className="text-foreground">₹{amount}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-start gap-2 rounded-lg bg-primary/5 p-3">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{t.gstNote}</p>
                </div>

                <div className="mt-5 flex gap-3">
                  <button onClick={() => setStep("enter-upi")} className="flex-1 rounded-xl border border-border py-3 text-sm font-semibold text-foreground transition hover:bg-secondary">
                    {t.back}
                  </button>
                  <button onClick={handleConfirmPay} className="flex-1 rounded-xl bg-upi-green py-3 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 active:scale-[0.98]">
                    {interpolate(t.pay, amount)}
                  </button>
                </div>
              </motion.div>
            )}

            {step === "processing" && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center py-8">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="mt-4 font-display text-lg font-semibold text-foreground">{t.sendingPayment}</p>
                <p className="mt-1 text-sm text-muted-foreground">{interpolate(t.connectingTo, payLabel || "")}</p>
                <div className="mt-6 w-full max-w-[200px] rounded-full bg-secondary">
                  <motion.div initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: 2, ease: "easeInOut" }} className="h-1.5 rounded-full bg-primary" />
                </div>
                <p className="mt-4 text-[11px] text-muted-foreground">{t.doNotClose}</p>
              </motion.div>
            )}

            {step === "awaiting" && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center py-8">
                <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}>
                  <Clock className="h-12 w-12 text-yellow-500" />
                </motion.div>
                <p className="mt-4 font-display text-lg font-semibold text-foreground">{t.awaitingConfirmation}</p>
                <p className="mt-1 text-center text-sm text-muted-foreground">{t.paymentSentWaiting}</p>
                {txn && (
                  <p className="mt-3 rounded-lg bg-secondary px-3 py-1.5 text-xs font-mono text-muted-foreground">TXN: {txn.id}</p>
                )}
                <div className="mt-5 flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow-400 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-yellow-500" />
                  </span>
                  <span className="text-xs text-muted-foreground">{t.waitingForReceiver}</span>
                </div>
                <p className="mt-4 text-[11px] text-muted-foreground">{t.doNotClose}</p>
              </motion.div>
            )}

            {step === "success" && txn && (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center py-8">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, delay: 0.1 }}>
                  <CheckCircle2 className="h-16 w-16 text-accent" />
                </motion.div>
                <p className="mt-4 font-display text-xl font-bold text-foreground">{t.paymentConfirmed}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t.receiverConfirmed}</p>

                <div className="mt-4 w-full rounded-xl border border-border bg-secondary/30 p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t.transactionId}</span>
                    <span className="font-mono text-xs text-foreground">{txn.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t.amount}</span>
                    <span className="font-medium text-foreground">₹{txn.amount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t.tokensAdded}</span>
                    <span className="font-medium text-accent">+{txn.tokens}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t.status}</span>
                    <span className="inline-flex items-center gap-1 text-accent font-medium">
                      <CheckCircle2 className="h-3.5 w-3.5" /> {t.confirmed}
                    </span>
                  </div>
                </div>

                <button onClick={handleClose} className="mt-6 w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90">
                  {t.done}
                </button>
              </motion.div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default UpiPaymentDialog;
