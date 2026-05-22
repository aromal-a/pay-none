ALTER TABLE public.live_channels
  ADD COLUMN IF NOT EXISTS per_minute_rate integer NOT NULL DEFAULT 50;

CREATE OR REPLACE FUNCTION public.previewer_collect_minute(p_acs_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_acs public.live_active_call_spaces%ROWTYPE;
  v_rate integer;
  v_viewer_balance integer;
  v_charge integer;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_acs FROM public.live_active_call_spaces WHERE id = p_acs_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Call space not found'; END IF;
  IF v_acs.previewer_id <> v_caller THEN RAISE EXCEPTION 'Only the previewer can collect'; END IF;
  IF v_acs.closed_at IS NOT NULL THEN
    RETURN jsonb_build_object('charged', 0, 'reason', 'closed');
  END IF;

  SELECT COALESCE(per_minute_rate, 50) INTO v_rate FROM public.live_channels WHERE id = v_acs.channel_id;
  IF v_rate IS NULL OR v_rate <= 0 THEN
    RETURN jsonb_build_object('charged', 0, 'reason', 'zero-rate');
  END IF;

  SELECT token_balance INTO v_viewer_balance FROM public.profiles WHERE user_id = v_acs.viewer_id FOR UPDATE;
  IF v_viewer_balance IS NULL OR v_viewer_balance <= 0 THEN
    RETURN jsonb_build_object('charged', 0, 'reason', 'viewer-empty');
  END IF;

  v_charge := LEAST(v_rate, v_viewer_balance);

  UPDATE public.profiles SET token_balance = token_balance - v_charge WHERE user_id = v_acs.viewer_id;
  UPDATE public.profiles SET token_balance = token_balance + v_charge WHERE user_id = v_acs.previewer_id;

  INSERT INTO public.token_transactions
    (user_id, stripe_session_id, price_id, amount_cents, currency, tokens_credited, status, environment, amount_paid_inr)
  VALUES
    (v_acs.viewer_id,    NULL, 'live:per-minute:' || p_acs_id::text, 0, 'inr', -v_charge, 'completed', 'live', 0),
    (v_acs.previewer_id, NULL, 'live:per-minute:' || p_acs_id::text, 0, 'inr',  v_charge, 'completed', 'live', 0);

  RETURN jsonb_build_object('charged', v_charge, 'rate', v_rate, 'viewer_id', v_acs.viewer_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.previewer_collect_minute(uuid) TO authenticated;