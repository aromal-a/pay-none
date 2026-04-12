import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Smartphone, CheckCircle2, Loader2, IndianRupee, Shield } from "lucide-react";

interface UpiPaymentDialogProps {
  open: boolean;
  onClose: () => void;
  amount: number;
  tokens: number;
}

type Step = "enter-upi" | "processing" | "success";

const UpiPaymentDialog = ({ open, onClose, amount, tokens }: UpiPaymentDialogProps) => {
  const [step, setStep] = useState<Step>("enter-upi");
  const [upiId, setUpiId] = useState("");
  const [selectedApp, setSelectedApp] = useState<string | null>(null);

  const upiApps = [
    { id: "gpay", name: "Google Pay", color: "bg-blue-500" },
    { id: "phonepe", name: "PhonePe", color: "bg-purple-600" },
    { id: "paytm", name: "Paytm", color: "bg-sky-500" },
    { id: "bhim", name: "BHIM", color: "bg-green-600" },
  ];

  const handlePay = () => {
    if (!upiId && !selectedApp) return;
    setStep("processing");
    setTimeout(() => setStep("success"), 2500);
  };

  const handleClose = () => {
    setStep("enter-upi");
    setUpiId("");
    setSelectedApp(null);
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
        onClick={handleClose}
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
            <button onClick={handleClose} className="absolute right-4 top-4 rounded-full bg-primary-foreground/20 p-1.5 text-primary-foreground transition hover:bg-primary-foreground/30">
              <X className="h-4 w-4" />
            </button>
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
            {step === "enter-upi" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <p className="mb-4 text-sm font-medium text-muted-foreground">
                  Choose a UPI app or enter UPI ID
                </p>

                <div className="grid grid-cols-4 gap-3 mb-5">
                  {upiApps.map((app) => (
                    <button
                      key={app.id}
                      onClick={() => { setSelectedApp(app.id); setUpiId(""); }}
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

                <div className="relative mb-5">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-card px-3 text-xs text-muted-foreground">or enter UPI ID</span>
                  </div>
                </div>

                <input
                  type="text"
                  placeholder="yourname@upi"
                  value={upiId}
                  onChange={(e) => { setUpiId(e.target.value); setSelectedApp(null); }}
                  className="w-full rounded-xl border-2 border-border bg-secondary/50 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none transition-colors"
                />

                <button
                  onClick={handlePay}
                  disabled={!upiId && !selectedApp}
                  className="mt-5 w-full rounded-xl bg-upi-green py-3.5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Pay ₹{amount}
                </button>

                <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                  <Shield className="h-3.5 w-3.5" />
                  Secured by UPI • 256-bit encryption
                </div>
              </motion.div>
            )}

            {step === "processing" && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center py-8"
              >
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="mt-4 font-display text-lg font-semibold text-foreground">
                  Processing Payment
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selectedApp
                    ? `Waiting for confirmation from ${upiApps.find(a => a.id === selectedApp)?.name}...`
                    : `Sending request to ${upiId}...`}
                </p>
                <div className="mt-6 w-full max-w-[200px] rounded-full bg-secondary">
                  <motion.div
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 2.5, ease: "easeInOut" }}
                    className="h-1.5 rounded-full bg-primary"
                  />
                </div>
              </motion.div>
            )}

            {step === "success" && (
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
                  Payment Successful!
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {tokens} tokens have been added to your account
                </p>
                <p className="mt-3 rounded-lg bg-accent/10 px-4 py-2 text-sm font-medium text-accent">
                  Transaction ID: TXN{Date.now().toString().slice(-8)}
                </p>
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
