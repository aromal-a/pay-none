ALTER TABLE public.live_channels
  ADD COLUMN IF NOT EXISTS active_boxes text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS multi_window boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS min_tokens integer NOT NULL DEFAULT 2000;