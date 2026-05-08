CREATE OR REPLACE FUNCTION public.send_message(
  p_recipient_email text,
  p_channel_slug text,
  p_body text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender uuid := auth.uid();
  v_recipient uuid;
  v_channel_id uuid;
  v_chars integer;
  v_low uuid;
  v_high uuid;
  v_conv_id uuid;
  v_msg_id uuid;
  v_sender_balance integer;
  v_clean text;
BEGIN
  IF v_sender IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  v_clean := coalesce(trim(p_body), '');
  v_chars := char_length(v_clean);
  IF v_chars <= 0 THEN RAISE EXCEPTION 'Message is empty'; END IF;

  SELECT id INTO v_channel_id FROM public.channels WHERE slug = p_channel_slug;
  IF v_channel_id IS NULL THEN RAISE EXCEPTION 'Channel not found'; END IF;

  SELECT user_id INTO v_recipient FROM public.profiles WHERE lower(email) = lower(p_recipient_email) LIMIT 1;
  IF v_recipient IS NULL THEN RAISE EXCEPTION 'Recipient not found'; END IF;
  IF v_recipient = v_sender THEN RAISE EXCEPTION 'Cannot message yourself'; END IF;

  SELECT token_balance INTO v_sender_balance FROM public.profiles WHERE user_id = v_sender FOR UPDATE;
  IF v_sender_balance IS NULL THEN RAISE EXCEPTION 'Wallet not found'; END IF;
  IF v_sender_balance < v_chars THEN
    RAISE EXCEPTION 'Insufficient tokens: need %, have %', v_chars, v_sender_balance;
  END IF;

  UPDATE public.profiles SET token_balance = token_balance - v_chars WHERE user_id = v_sender;
  UPDATE public.profiles SET token_balance = token_balance + v_chars WHERE user_id = v_recipient;

  IF v_sender < v_recipient THEN v_low := v_sender; v_high := v_recipient;
  ELSE v_low := v_recipient; v_high := v_sender; END IF;

  INSERT INTO public.conversations (channel_id, user_low, user_high)
  VALUES (v_channel_id, v_low, v_high)
  ON CONFLICT (channel_id, user_low, user_high) DO UPDATE SET last_message_at = now()
  RETURNING id INTO v_conv_id;

  -- "words" column now stores character count (kept for schema stability)
  INSERT INTO public.messages (conversation_id, sender_id, recipient_id, body, words)
  VALUES (v_conv_id, v_sender, v_recipient, v_clean, v_chars)
  RETURNING id INTO v_msg_id;

  INSERT INTO public.token_transactions
    (user_id, stripe_session_id, price_id, amount_cents, currency, tokens_credited, status, environment, amount_paid_inr)
  VALUES
    (v_sender,    NULL, 'dm:' || p_channel_slug || '→' || p_recipient_email, 0, 'inr', -v_chars, 'completed', 'live', 0),
    (v_recipient, NULL, 'dm:' || p_channel_slug || '←' || (SELECT email FROM public.profiles WHERE user_id = v_sender),
                                                                              0, 'inr',  v_chars, 'completed', 'live', 0);

  RETURN jsonb_build_object(
    'message_id', v_msg_id,
    'conversation_id', v_conv_id,
    'chars', v_chars,
    'sender_remaining', v_sender_balance - v_chars
  );
END;
$$;