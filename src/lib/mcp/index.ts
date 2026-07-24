import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getTokenBalance from "./tools/get-token-balance";
import listRecentTransactions from "./tools/list-recent-transactions";
import listMyChannels from "./tools/list-my-channels";

// OAuth issuer must be the direct Supabase host, built from the project ref
// so it stays import-safe at both build-time extraction and Deno cold start.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "queentoken-mcp",
  title: "QueenToken MCP",
  version: "0.1.0",
  instructions:
    "Tools for the QueenToken vocal-token app. Use `get_token_balance` to read the signed-in user's balance, `list_recent_transactions` to review their purchase/spend history, and `list_my_channels` to inspect live channels they own.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getTokenBalance, listRecentTransactions, listMyChannels],
});
