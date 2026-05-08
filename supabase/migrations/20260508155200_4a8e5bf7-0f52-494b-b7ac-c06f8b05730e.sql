CREATE OR REPLACE FUNCTION public.spend_tokens(
  p_tokens integer,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_balance integer;
  v_txn_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_tokens IS NULL OR p_tokens <= 0 THEN
    RAISE EXCEPTION 'Nothing to spend';
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'Reason required';
  END IF;

  SELECT token_balance INTO v_balance FROM public.profiles WHERE user_id = v_user_id FOR UPDATE;
  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'Wallet not found';
  END IF;
  IF v_balance < p_tokens THEN
    RAISE EXCEPTION 'Insufficient tokens: need %, have %', p_tokens, v_balance;
  END IF;

  UPDATE public.profiles
  SET token_balance = token_balance - p_tokens
  WHERE user_id = v_user_id;

  INSERT INTO public.token_transactions (
    user_id, stripe_session_id, price_id, amount_cents,
    currency, tokens_credited, status, environment, amount_paid_inr
  ) VALUES (
    v_user_id, NULL, p_reason, 0,
    'inr', -p_tokens, 'completed', 'live', 0
  )
  RETURNING id INTO v_txn_id;

  RETURN jsonb_build_object(
    'transaction_id', v_txn_id,
    'spent', p_tokens,
    'remaining', v_balance - p_tokens
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.spend_tokens(integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.spend_tokens(integer, text) TO authenticated;