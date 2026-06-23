import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface Props {
  tier: "ozonized" | "subvertical" | "freak-code";
  label?: string;
  onCredited?: (tokens: number) => void;
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

const SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

const loadScript = () =>
  new Promise<boolean>((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });

const RazorpayButton = ({ tier, label = "Pay with Razorpay", onCredited }: Props) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadScript();
  }, []);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      navigate("/auth");
      return;
    }
    setLoading(true);
    try {
      const ok = await loadScript();
      if (!ok) throw new Error("Failed to load Razorpay");

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error("Please sign in");

      const { data, error } = await supabase.functions.invoke("razorpay-create-order", {
        body: { tier },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (error || !data?.orderId) throw new Error(error?.message || "Order failed");

      const rzp = new window.Razorpay({
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        order_id: data.orderId,
        name: "TokenStore",
        description: `${data.tokens} tokens`,
        prefill: { email: user.email },
        theme: { color: "#6366f1" },
        handler: async (rzp: any) => {
          try {
            const { data: verify, error: vErrupp } = await supabase.functions.invoke("razorpay-verify-payment", {
              body: resp,
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (vErrupp || !verify?.ok) throw new Error(vErrupp?.message || "Verification failed");
            toast.success(`${verify.tokens} tokens added to your wallet!`);
            onCredited?.(verify.tokens);
          } catch (err: any) {
            toast.error(err.message || "Payment verification failed");
          }
        },
        modal: {
          ondismiss: () => setLoading(false),
        },
      });
      rzp.open();
    } catch (err: any) {
      toast.error(err.message || "Payment failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="w-full rounded-xl bg-[#3395FF] text-sm font-semibold text-white transition-all hover opacity"
    >
      {loading ? "Loading…" : label}
    </button>
  );
};

export default RazorpayButton;
