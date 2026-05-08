-- 1. Roles enum + table
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 2. has_role helper (SECURITY DEFINER avoids recursive RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 3. RLS for user_roles (admins only)
CREATE POLICY "Admins view roles" ON public.user_roles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert roles" ON public.user_roles
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete roles" ON public.user_roles
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- 4. Allow admins to view all token_transactions
CREATE POLICY "Admins view all transactions" ON public.token_transactions
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- 5. Admin manual credit RPC
CREATE OR REPLACE FUNCTION public.admin_credit_tokens(
  p_user_email TEXT,
  p_tokens INTEGER,
  p_amount_inr INTEGER,
  p_razorpay_payment_id TEXT,
  p_tier TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_txn_id UUID;
BEGIN
  -- Authorization: caller must be admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_tokens <= 0 OR p_amount_inr <= 0 THEN
    RAISE EXCEPTION 'Invalid amount or tokens';
  END IF;

  -- Resolve user by email via profiles
  SELECT user_id INTO v_user_id
  FROM public.profiles
  WHERE lower(email) = lower(p_user_email)
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No user found with email %', p_user_email;
  END IF;

  -- Prevent duplicate credit for same Razorpay payment
  IF EXISTS (
    SELECT 1 FROM public.token_transactions
    WHERE stripe_session_id = p_razorpay_payment_id
  ) THEN
    RAISE EXCEPTION 'This payment ID has already been credited';
  END IF;

  -- Credit balance
  UPDATE public.profiles
  SET token_balance = token_balance + p_tokens
  WHERE user_id = v_user_id;

  -- Record transaction
  INSERT INTO public.token_transactions (
    user_id, stripe_session_id, price_id, amount_cents,
    currency, tokens_credited, status, environment
  ) VALUES (
    v_user_id, p_razorpay_payment_id, p_tier, p_amount_inr * 100,
    'inr', p_tokens, 'completed', 'live'
  )
  RETURNING id INTO v_txn_id;

  RETURN jsonb_build_object(
    'transaction_id', v_txn_id,
    'user_id', v_user_id,
    'tokens_credited', p_tokens
  );
END;
$$;