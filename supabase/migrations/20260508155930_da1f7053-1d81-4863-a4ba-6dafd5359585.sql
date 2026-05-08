-- Channels
CREATE TABLE public.channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Channels readable by authenticated"
  ON public.channels FOR SELECT TO authenticated USING (true);

INSERT INTO public.channels (slug, name, description) VALUES
  ('omi-donts',         'omi-don''ts',       'Things to avoid'),
  ('cami-ons',          'cami-ons',          'Things on'),
  ('cami-off',          'cami-off',          'Things off'),
  ('broadcast-hour',    'broadcast: hour',   'Hourly broadcasts'),
  ('bearable-fashion',  'bearable fashion',  'Hour: bearable'),
  ('wearable-fashion',  'wearable fashion',  'Hour: wearable');

-- Conversations: one row per (user pair, channel). Stored canonically (user_low < user_high).
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  user_low uuid NOT NULL,
  user_high uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT conversations_user_order CHECK (user_low < user_high),
  CONSTRAINT conversations_unique UNIQUE (channel_id, user_low, user_high)
);
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants view conversations"
  ON public.conversations FOR SELECT TO authenticated
  USING (auth.uid() = user_low OR auth.uid() = user_high);
CREATE INDEX conv_user_low_idx ON public.conversations(user_low, last_message_at DESC);
CREATE INDEX conv_user_high_idx ON public.conversations(user_high, last_message_at DESC);

-- Messages
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  recipient_id uuid NOT NULL,
  body text NOT NULL,
  words integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants view messages"
  ON public.messages FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
CREATE INDEX messages_conv_idx ON public.messages(conversation_id, created_at);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;

-- send_message: atomic word-count → debit sender, credit recipient, persist message, log both
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
  v_words integer;
  v_low uuid;
  v_high uuid;
  v_conv_id uuid;
  v_msg_id uuid;
  v_sender_balance integer;
  v_clean text;
BEGIN
  IF v_sender IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  v_clean := coalesce(trim(p_body), '');
  IF length(v_clean) = 0 THEN RAISE EXCEPTION 'Message is empty'; END IF;
  v_words := array_length(regexp_split_to_array(v_clean, '\s+'), 1);
  IF v_words IS NULL OR v_words <= 0 THEN RAISE EXCEPTION 'Message is empty'; END IF;

  SELECT id INTO v_channel_id FROM public.channels WHERE slug = p_channel_slug;
  IF v_channel_id IS NULL THEN RAISE EXCEPTION 'Channel not found'; END IF;

  SELECT user_id INTO v_recipient FROM public.profiles WHERE lower(email) = lower(p_recipient_email) LIMIT 1;
  IF v_recipient IS NULL THEN RAISE EXCEPTION 'Recipient not found'; END IF;
  IF v_recipient = v_sender THEN RAISE EXCEPTION 'Cannot message yourself'; END IF;

  -- Lock sender wallet & check balance
  SELECT token_balance INTO v_sender_balance FROM public.profiles WHERE user_id = v_sender FOR UPDATE;
  IF v_sender_balance IS NULL THEN RAISE EXCEPTION 'Wallet not found'; END IF;
  IF v_sender_balance < v_words THEN
    RAISE EXCEPTION 'Insufficient tokens: need %, have %', v_words, v_sender_balance;
  END IF;

  -- Transfer
  UPDATE public.profiles SET token_balance = token_balance - v_words WHERE user_id = v_sender;
  UPDATE public.profiles SET token_balance = token_balance + v_words WHERE user_id = v_recipient;

  -- Canonical pair
  IF v_sender < v_recipient THEN v_low := v_sender; v_high := v_recipient;
  ELSE v_low := v_recipient; v_high := v_sender; END IF;

  INSERT INTO public.conversations (channel_id, user_low, user_high)
  VALUES (v_channel_id, v_low, v_high)
  ON CONFLICT (channel_id, user_low, user_high) DO UPDATE SET last_message_at = now()
  RETURNING id INTO v_conv_id;

  INSERT INTO public.messages (conversation_id, sender_id, recipient_id, body, words)
  VALUES (v_conv_id, v_sender, v_recipient, v_clean, v_words)
  RETURNING id INTO v_msg_id;

  -- History rows for both sides
  INSERT INTO public.token_transactions
    (user_id, stripe_session_id, price_id, amount_cents, currency, tokens_credited, status, environment, amount_paid_inr)
  VALUES
    (v_sender,    NULL, 'dm:'    || p_channel_slug || '→' || p_recipient_email, 0, 'inr', -v_words, 'completed', 'live', 0),
    (v_recipient, NULL, 'dm:'    || p_channel_slug || '←' || (SELECT email FROM public.profiles WHERE user_id = v_sender),
                                                                                  0, 'inr',  v_words, 'completed', 'live', 0);

  RETURN jsonb_build_object(
    'message_id', v_msg_id,
    'conversation_id', v_conv_id,
    'words', v_words,
    'sender_remaining', v_sender_balance - v_words
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.send_message(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_message(text, text, text) TO authenticated;

-- Helper: list a conversation's other participant email (for UI)
CREATE OR REPLACE FUNCTION public.conversation_peer_email(p_conv_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.email
  FROM public.conversations c
  JOIN public.profiles p ON p.user_id = CASE WHEN c.user_low = auth.uid() THEN c.user_high ELSE c.user_low END
  WHERE c.id = p_conv_id AND (c.user_low = auth.uid() OR c.user_high = auth.uid())
$$;
GRANT EXECUTE ON FUNCTION public.conversation_peer_email(uuid) TO authenticated;