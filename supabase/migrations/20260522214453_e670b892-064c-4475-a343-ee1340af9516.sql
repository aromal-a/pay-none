ALTER TABLE public.live_channels
ADD COLUMN IF NOT EXISTS box_payload jsonb NOT NULL DEFAULT '{}'::jsonb;