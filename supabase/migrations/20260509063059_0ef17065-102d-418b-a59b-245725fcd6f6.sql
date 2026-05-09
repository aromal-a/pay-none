
-- 1) Logs table
CREATE TABLE public.token_spend_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  transaction_id uuid,
  reason text NOT NULL,
  original_text text,
  token_units integer NOT NULL,
  string_appeal text,
  user_currency text,
  currency_issues text,
  log_hold text,
  hold_place text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_token_spend_logs_user ON public.token_spend_logs(user_id, created_at DESC);

ALTER TABLE public.token_spend_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own spend logs"
  ON public.token_spend_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all spend logs"
  ON public.token_spend_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 2) Updated spend_tokens RPC accepting original text + conversion fields
CREATE OR REPLACE FUNCTION public.spend_tokens(
  p_tokens integer,
  p_reason text,
  p_original_text text DEFAULT NULL,
  p_string_appeal text DEFAULT NULL,
  p_user_currency text DEFAULT NULL,
  p_currency_issues text DEFAULT NULL,
  p_log_hold text DEFAULT NULL,
  p_hold_place text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_balance integer;
  v_txn_id uuid;
  v_log_id uuid;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_tokens IS NULL OR p_tokens <= 0 THEN RAISE EXCEPTION 'Nothing to spend'; END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN RAISE EXCEPTION 'Reason required'; END IF;

  SELECT token_balance INTO v_balance FROM public.profiles WHERE user_id = v_user_id FOR UPDATE;
  IF v_balance IS NULL THEN RAISE EXCEPTION 'Wallet not found'; END IF;
  IF v_balance < p_tokens THEN
    RAISE EXCEPTION 'Insufficient tokens: need %, have %', p_tokens, v_balance;
  END IF;

  UPDATE public.profiles SET token_balance = token_balance - p_tokens WHERE user_id = v_user_id;

  INSERT INTO public.token_transactions (
    user_id, stripe_session_id, price_id, amount_cents,
    currency, tokens_credited, status, environment, amount_paid_inr
  ) VALUES (
    v_user_id, NULL, p_reason, 0,
    'inr', -p_tokens, 'completed', 'live', 0
  )
  RETURNING id INTO v_txn_id;

  INSERT INTO public.token_spend_logs (
    user_id, transaction_id, reason, original_text, token_units,
    string_appeal, user_currency, currency_issues, log_hold, hold_place
  ) VALUES (
    v_user_id, v_txn_id, p_reason, p_original_text, p_tokens,
    p_string_appeal, p_user_currency, p_currency_issues, p_log_hold, p_hold_place
  )
  RETURNING id INTO v_log_id;

  RETURN jsonb_build_object(
    'transaction_id', v_txn_id,
    'log_id', v_log_id,
    'spent', p_tokens,
    'remaining', v_balance - p_tokens
  );
END;
$function$;
