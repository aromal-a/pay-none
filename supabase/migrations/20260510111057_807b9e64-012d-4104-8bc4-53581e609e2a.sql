-- Previewer persistence tables
CREATE TABLE public.previewer_brain_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.previewer_brain_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own brain select" ON public.previewer_brain_messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own brain insert" ON public.previewer_brain_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own brain delete" ON public.previewer_brain_messages FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE public.previewer_lyrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  title text,
  body text NOT NULL,
  kind text NOT NULL DEFAULT 'lyric',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.previewer_lyrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own lyrics select" ON public.previewer_lyrics FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own lyrics insert" ON public.previewer_lyrics FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own lyrics delete" ON public.previewer_lyrics FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE public.previewer_recordings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  title text,
  storage_path text NOT NULL,
  duration_seconds integer,
  mime_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.previewer_recordings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own rec select" ON public.previewer_recordings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own rec insert" ON public.previewer_recordings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own rec delete" ON public.previewer_recordings FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE public.previewer_brand_payloads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  brand_name text,
  brand_appeal text,
  brand_self text,
  api_link text,
  api_seed integer,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.previewer_brand_payloads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own brand select" ON public.previewer_brand_payloads FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own brand insert" ON public.previewer_brand_payloads FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own brand delete" ON public.previewer_brand_payloads FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE public.previewer_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  label text NOT NULL,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.previewer_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own rec list select" ON public.previewer_recommendations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own rec list insert" ON public.previewer_recommendations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own rec list delete" ON public.previewer_recommendations FOR DELETE USING (auth.uid() = user_id);

-- Storage bucket for previewer recordings
INSERT INTO storage.buckets (id, name, public) VALUES ('previewer-audio', 'previewer-audio', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "own audio read" ON storage.objects FOR SELECT
  USING (bucket_id = 'previewer-audio' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "own audio insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'previewer-audio' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "own audio delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'previewer-audio' AND auth.uid()::text = (storage.foldername(name))[1]);