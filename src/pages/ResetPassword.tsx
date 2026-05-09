import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Coins } from "lucide-react";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  // Supabase puts the recovery tokens in the URL hash (#access_token=…&type=recovery).
  // The client picks them up automatically — we just need to wait for a session.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN" || session) setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    // Fallback: if recovery hash is present, treat as ready so inputs are enabled
    if (typeof window !== "undefined" && window.location.hash.includes("type=recovery")) {
      setReady(true);
    }
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return toast.error("Password must be at least 6 characters");
    if (password !== confirm) return toast.error("Passwords don't match");

    // Ensure we have a session before attempting update
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      return toast.error("Reset link expired or invalid. Please request a new password reset email.");
    }

    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated. You're signed in.");
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-xl">
        <Link to="/" className="flex items-center gap-2 mb-6">
          <div className="rounded-lg bg-primary p-2"><Coins className="h-5 w-5 text-primary-foreground" /></div>
          <span className="font-display text-xl font-bold text-foreground">TokenStore</span>
        </Link>
        <h1 className="font-display text-2xl font-bold text-foreground mb-2">Set a new password</h1>
        <p className="text-sm text-muted-foreground mb-6">
          {ready
            ? "Enter your new password below."
            : "Open this page from the link in your password reset email."}
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password" required minLength={6} placeholder="New password"
            value={password} onChange={(e) => setPassword(e.target.value)} disabled={!ready || busy}
            className="w-full rounded-xl border-2 border-border bg-secondary/50 px-4 py-3 text-sm text-foreground focus:border-primary focus:outline-none disabled:opacity-50"
          />
          <input
            type="password" required minLength={6} placeholder="Confirm password"
            value={confirm} onChange={(e) => setConfirm(e.target.value)} disabled={!ready || busy}
            className="w-full rounded-xl border-2 border-border bg-secondary/50 px-4 py-3 text-sm text-foreground focus:border-primary focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit" disabled={!ready || busy}
            className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Updating…" : "Update password"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm">
          <Link to="/auth" className="text-primary hover:underline">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
