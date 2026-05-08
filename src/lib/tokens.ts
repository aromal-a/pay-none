import { supabase } from "@/integrations/supabase/client";

// 1 character (incl. spaces) = 1 token
export const countChars = (text: string): number => (text ?? "").trim().length;
// Backwards-compatible alias used by older components
export const countWords = countChars;

export interface SpendResult {
  transaction_id: string;
  spent: number;
  remaining: number;
}

export const spendTokens = async (tokens: number, reason: string): Promise<SpendResult> => {
  const { data, error } = await supabase.rpc("spend_tokens", {
    p_tokens: tokens,
    p_reason: reason,
  });
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
