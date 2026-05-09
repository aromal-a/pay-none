import { supabase } from "@/integrations/supabase/client";

// 1 token = 1 word/punctuation unit. Tokens increment only when a space
// or punctuation is added — not on every letter typed.
// Example: "hello world" = 2 tokens, "hi, there!" = 4 tokens (hi , there !)
export const countChars = (text: string): number => {
  const t = (text ?? "").trim();
  if (!t) return 0;
  // Match word runs OR single punctuation marks. Each match = 1 token.
  const matches = t.match(/[A-Za-z0-9'’\-]+|[.,!?;:()"“”\/\\&%#@]/g);
  return matches ? matches.length : 0;
};
// Backwards-compatible alias used by older components
export const countWords = countChars;

export interface SpendResult {
  transaction_id: string;
  spent: number;
  remaining: number;
}

export interface SpendOptions {
  originalText?: string;
  stringAppeal?: string;
  userCurrency?: string;
  currencyIssues?: string;
  logHold?: string;
  holdPlace?: string;
}

export const spendTokens = async (
  tokens: number,
  reason: string,
  opts: SpendOptions = {},
): Promise<SpendResult> => {
  const { data, error } = await supabase.rpc("spend_tokens", {
    p_tokens: tokens,
    p_reason: reason,
    p_original_text: opts.originalText ?? null,
    p_string_appeal: opts.stringAppeal ?? null,
    p_user_currency: opts.userCurrency ?? null,
    p_currency_issues: opts.currencyIssues ?? null,
    p_log_hold: opts.logHold ?? null,
    p_hold_place: opts.holdPlace ?? null,
  } as never);
  if (error) throw error;
  return data as unknown as SpendResult;
};

export const fetchBalance = async (userId: string): Promise<number> => {
  const { data, error } = await supabase
    .from("profiles")
    .select("token_balance")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data?.token_balance ?? 0;
};
