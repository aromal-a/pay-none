import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Smartphone, CheckCircle2, Loader2, IndianRupee, Shield, AlertTriangle, Info, Clock } from "lucide-react";
import { generateTxnId, tokenBalance, transactionStore, RECEIVER_CONFIRM_DELAY, MERCHANT_INFO, type PaymentTransaction } from "@/lib/paymentState";

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

  const upiApps = [
    { id: "gpay", name: "Google Pay", color: "bg-blue-500" },
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

    // Simulate: payment sent → awaiting receiver confirmation
    setTimeout(() => {
      setTxn((prev) => prev ? { ...prev, status: "awaiting_confirmation" } : prev);
      setStep("awaiting");

      // Simulate: receiver confirms after delay
      setTimeout(() => {
        setTxn((prev) => prev ? { ...prev, status: "confirmed" } : prev);
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
                <p className="text-sm text-primary-foreground/80">Pay via UPI</p>
                <p className="font-display text-2xl font-bold text-primary-foreground">₹{amount}</p>
              </div>
            </div>
            <p className="mt-2 text-sm text-primary-foreground/70">For {tokens} tokens</p>
          </div>

          {/* Body */}
          <div className="p-6">
            {/* Minimum amount warning */}
            {step === "enter-upi" && isBelowMinimum && (
              <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/5 p-3.5">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <div>
                  <p className="text-sm font-semibold text-destructive">Minimum ₹{MIN_AMOUNT} required</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    This amount is below the minimum payable threshold. Please select a higher package.
                  </p>
                </div>
              </div>
            )}

            {step === "enter-upi" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="flex gap-2 mb-5">
                  {([
                    { key: "app" as const, label: "UPI App" },
                    { key: "phone" as const, label: "Phone Number" },
                    { key: "upi" as const, label: "UPI ID" },
                  ]).map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => {
                        setPayMode(tab.key);
                        setSelectedApp(null);
                        setUpiId("");
                        setPhoneNumber("");
                      }}
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
                  <div className="grid grid-cols-4 gap-3 mb-5">
                    {upiApps.map((app) => (
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
                )}

                {payMode === "phone" && (
                  <div className="mb-5">
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      Enter mobile number linked to UPI
                    </label>
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
                      <p className="mt-1.5 text-xs text-destructive">Enter a valid 10-digit number</p>
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
                  Continue
                </button>

                <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                  <Shield className="h-3.5 w-3.5" />
                  Secured by UPI • 256-bit encryption
                </div>
              </motion.div>
            )}

            {/* Confirmation Step */}
            {step === "confirm" && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                <p className="mb-4 text-sm font-semibold text-foreground">Review & Confirm</p>

                <div className="rounded-xl border border-border bg-secondary/30 p-4 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Paying to</span>
                    <span className="font-medium text-foreground">{payLabel}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tokens</span>
                    <span className="font-medium text-foreground">{tokens}</span>
                  </div>
                  <div className="border-t border-border pt-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="text-foreground">₹{baseAmount}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">GST (18%)</span>
                      <span className="text-foreground">₹{taxAmount}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold border-t border-border pt-2">
                      <span className="text-foreground">Total</span>
                      <span className="text-foreground">₹{amount}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-start gap-2 rounded-lg bg-primary/5 p-3">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Amount includes applicable GST. Tokens are non-refundable once credited. By proceeding, you agree to the terms of service.
                  </p>
                </div>

                <div className="mt-5 flex gap-3">
                  <button
                    onClick={() => setStep("enter-upi")}
                    className="flex-1 rounded-xl border border-border py-3 text-sm font-semibold text-foreground transition hover:bg-secondary"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleConfirmPay}
                    className="flex-1 rounded-xl bg-upi-green py-3 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 active:scale-[0.98]"
                  >
                    Pay ₹{amount}
                  </button>
                </div>
              </motion.div>
            )}

            {/* Processing - sending payment */}
            {step === "processing" && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center py-8"
              >
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="mt-4 font-display text-lg font-semibold text-foreground">
                  Sending Payment...
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Connecting to {payLabel}
                </p>
                <div className="mt-6 w-full max-w-[200px] rounded-full bg-secondary">
                  <motion.div
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 2, ease: "easeInOut" }}
                    className="h-1.5 rounded-full bg-primary"
                  />
                </div>
                <p className="mt-4 text-[11px] text-muted-foreground">Do not close this window</p>
              </motion.div>
            )}

            {/* Awaiting receiver confirmation */}
            {step === "awaiting" && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center py-8"
              >
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                >
                  <Clock className="h-12 w-12 text-yellow-500" />
                </motion.div>
                <p className="mt-4 font-display text-lg font-semibold text-foreground">
                  Awaiting Confirmation
                </p>
                <p className="mt-1 text-center text-sm text-muted-foreground">
                  Payment sent. Waiting for receiver to confirm the transaction.
                </p>
                {txn && (
                  <p className="mt-3 rounded-lg bg-secondary px-3 py-1.5 text-xs font-mono text-muted-foreground">
                    TXN: {txn.id}
                  </p>
                )}
                <div className="mt-5 flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow-400 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-yellow-500" />
                  </span>
                  <span className="text-xs text-muted-foreground">Waiting for receiver...</span>
                </div>
                <p className="mt-4 text-[11px] text-muted-foreground">Do not close this window</p>
              </motion.div>
            )}

            {/* Success - only after receiver confirmed */}
            {step === "success" && txn && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center py-8"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
                >
                  <CheckCircle2 className="h-16 w-16 text-accent" />
                </motion.div>
                <p className="mt-4 font-display text-xl font-bold text-foreground">
                  Payment Confirmed!
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Receiver has confirmed your payment
                </p>

                <div className="mt-4 w-full rounded-xl border border-border bg-secondary/30 p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Transaction ID</span>
                    <span className="font-mono text-xs text-foreground">{txn.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Amount</span>
                    <span className="font-medium text-foreground">₹{txn.amount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tokens Added</span>
                    <span className="font-medium text-accent">+{txn.tokens}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <span className="inline-flex items-center gap-1 text-accent font-medium">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Confirmed
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleClose}
                  className="mt-6 w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
                >
                  Done
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
