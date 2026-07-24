import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

// OAuth 2.1 consent page for the MCP server. Supabase redirects users here as
// /.lovable/oauth/consent?authorization_id=... before approving an MCP client.
export default function OAuthConsent() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const authorizationId = params.get("authorization_id") ?? "";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Missing authorization_id");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        navigate(`/auth?next=${encodeURIComponent(next)}`, { replace: true });
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const oauth = (supabase.auth as any).oauth;
      if (!oauth?.getAuthorizationDetails) {
        setError("OAuth server not available on this project.");
        return;
      }
      const { data, error } = await oauth.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) return setError(error.message);
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId, navigate]);

  async function decide(approve: boolean) {
    setBusy(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const oauth = (supabase.auth as any).oauth;
    const { data, error } = approve
      ? await oauth.approveAuthorization(authorizationId)
      : await oauth.denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      return setError(error.message);
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      return setError("No redirect returned by the authorization server.");
    }
    window.location.href = target;
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full rounded-2xl border border-border bg-card p-6 text-center">
          <h1 className="font-display text-xl font-bold text-foreground mb-2">
            Authorization error
          </h1>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </main>
    );
  }

  if (!details) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background p-6">
        <p className="text-muted-foreground text-sm">Loading authorization…</p>
      </main>
    );
  }

  const clientName = details.client?.name ?? "an app";

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md w-full rounded-2xl border border-border bg-card p-8 shadow-xl">
        <h1 className="font-display text-2xl font-bold text-foreground mb-2">
          Connect {clientName}
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          This lets <span className="font-semibold text-foreground">{clientName}</span>{" "}
          use QueenToken as you — reading your balance, transactions, and channels
          through MCP tools.
        </p>
        <div className="flex gap-3">
          <button
            disabled={busy}
            onClick={() => decide(false)}
            className="flex-1 rounded-xl border-2 border-border bg-secondary/50 px-4 py-3 text-sm font-semibold text-foreground hover:bg-secondary disabled:opacity-50"
          >
            Deny
          </button>
          <button
            disabled={busy}
            onClick={() => decide(true)}
            className="flex-1 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Working…" : "Approve"}
          </button>
        </div>
      </div>
    </main>
  );
}
