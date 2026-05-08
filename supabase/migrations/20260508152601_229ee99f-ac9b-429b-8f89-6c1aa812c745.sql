
-- Add phone to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;

-- Make phone unique (nulls allowed) so the same phone can't create two bundles
CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_unique ON public.profiles (phone) WHERE phone IS NOT NULL;

-- Update signup trigger to capture phone from auth metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_phone text := nullif(trim(new.raw_user_meta_data->>'phone'), '');
  v_existing_user uuid;
BEGIN
  -- If a profile with the same phone already exists, do NOT create a new one.
  -- Instead, raise so signup fails clearly — preventing duplicate wallets.
  IF v_phone IS NOT NULL THEN
    SELECT user_id INTO v_existing_user FROM public.profiles WHERE phone = v_phone LIMIT 1;
    IF v_existing_user IS NOT NULL AND v_existing_user <> new.id THEN
      RAISE EXCEPTION 'A wallet already exists for this phone number. Please sign in to that account.';
    END IF;
  END IF;

  INSERT INTO public.profiles (user_id, email, display_name, phone)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    v_phone
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN new;
END;
$$;

-- Make sure the trigger is attached
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Ensure profiles.user_id is unique (one bundle per auth user)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='profiles_user_id_unique'
  ) THEN
    CREATE UNIQUE INDEX profiles_user_id_unique ON public.profiles (user_id);
  END IF;
END $$;
