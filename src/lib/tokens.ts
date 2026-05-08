import { supabase } from "@/integrations/supabase/client";

// 1 word = 1 token
export const countWords = (text: string): number => {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
};

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
