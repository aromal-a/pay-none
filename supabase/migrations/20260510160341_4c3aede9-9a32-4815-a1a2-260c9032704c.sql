
CREATE TABLE public.live_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  previewer_id uuid NOT NULL,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  is_open boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.live_channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Channels readable by authenticated" ON public.live_channels FOR SELECT TO authenticated USING (true);
CREATE POLICY "Previewers create channels" ON public.live_channels FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = previewer_id AND public.has_role(auth.uid(), 'previewer'));
CREATE POLICY "Owners update channels" ON public.live_channels FOR UPDATE TO authenticated USING (auth.uid() = previewer_id);
CREATE POLICY "Owners delete channels" ON public.live_channels FOR DELETE TO authenticated USING (auth.uid() = previewer_id);

CREATE TABLE public.live_call_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.live_channels(id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL,
  previewer_id uuid NOT NULL,
  story_plot text NOT NULL,
  suggested_role text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);
ALTER TABLE public.live_call_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants view requests" ON public.live_call_requests FOR SELECT TO authenticated
  USING (auth.uid() = viewer_id OR auth.uid() = previewer_id);
CREATE POLICY "Viewers create requests" ON public.live_call_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = viewer_id AND viewer_id <> previewer_id);
CREATE POLICY "Previewer updates requests" ON public.live_call_requests FOR UPDATE TO authenticated
  USING (auth.uid() = previewer_id);

CREATE TABLE public.live_active_call_spaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL UNIQUE REFERENCES public.live_call_requests(id) ON DELETE CASCADE,
  channel_id uuid NOT NULL REFERENCES public.live_channels(id) ON DELETE CASCADE,
  previewer_id uuid NOT NULL,
  viewer_id uuid NOT NULL,
  membrane_id text,
  scratchpad text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);
ALTER TABLE public.live_active_call_spaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants view ACS" ON public.live_active_call_spaces FOR SELECT TO authenticated
  USING (auth.uid() = previewer_id OR auth.uid() = viewer_id);
CREATE POLICY "Participants update ACS" ON public.live_active_call_spaces FOR UPDATE TO authenticated
  USING (auth.uid() = previewer_id OR auth.uid() = viewer_id);

CREATE TABLE public.live_acs_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acs_id uuid NOT NULL REFERENCES public.live_active_call_spaces(id) ON DELETE CASCADE,
  author_id uuid,
  kind text NOT NULL CHECK (kind IN ('text','ai','system','file')),
  body text NOT NULL DEFAULT '',
  file_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.live_acs_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ACS participants view messages" ON public.live_acs_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.live_active_call_spaces a
    WHERE a.id = acs_id AND (a.previewer_id = auth.uid() OR a.viewer_id = auth.uid())));
CREATE POLICY "ACS participants insert messages" ON public.live_acs_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id AND kind IN ('text','file')
    AND EXISTS (SELECT 1 FROM public.live_active_call_spaces a
      WHERE a.id = acs_id AND (a.previewer_id = auth.uid() OR a.viewer_id = auth.uid())));

CREATE OR REPLACE FUNCTION public.accept_call_request(p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_req public.live_call_requests%ROWTYPE; v_acs_id uuid;
BEGIN
  SELECT * INTO v_req FROM public.live_call_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF v_req.previewer_id <> auth.uid() THEN RAISE EXCEPTION 'Only the previewer can accept'; END IF;
  IF v_req.status <> 'pending' THEN RAISE EXCEPTION 'Request is not pending'; END IF;
  UPDATE public.live_call_requests SET status = 'accepted', decided_at = now() WHERE id = p_request_id;
  INSERT INTO public.live_active_call_spaces (request_id, channel_id, previewer_id, viewer_id)
    VALUES (v_req.id, v_req.channel_id, v_req.previewer_id, v_req.viewer_id) RETURNING id INTO v_acs_id;
  RETURN jsonb_build_object('acs_id', v_acs_id);
END; $$;

CREATE OR REPLACE FUNCTION public.reject_call_request(p_request_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.live_call_requests SET status = 'rejected', decided_at = now()
    WHERE id = p_request_id AND previewer_id = auth.uid() AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Cannot reject this request'; END IF;
END; $$;

REVOKE EXECUTE ON FUNCTION public.accept_call_request(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reject_call_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_call_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_call_request(uuid) TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.live_channels;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_call_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_active_call_spaces;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_acs_messages;

INSERT INTO storage.buckets (id, name, public) VALUES ('acs-files', 'acs-files', false) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "ACS participants read files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'acs-files' AND EXISTS (
    SELECT 1 FROM public.live_active_call_spaces a
    WHERE a.id::text = (storage.foldername(name))[1]
      AND (a.previewer_id = auth.uid() OR a.viewer_id = auth.uid())));
CREATE POLICY "ACS participants upload files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'acs-files' AND EXISTS (
    SELECT 1 FROM public.live_active_call_spaces a
    WHERE a.id::text = (storage.foldername(name))[1]
      AND (a.previewer_id = auth.uid() OR a.viewer_id = auth.uid())));
CREATE POLICY "ACS participants delete files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'acs-files' AND EXISTS (
    SELECT 1 FROM public.live_active_call_spaces a
    WHERE a.id::text = (storage.foldername(name))[1]
      AND (a.previewer_id = auth.uid() OR a.viewer_id = auth.uid())));

CREATE INDEX live_call_requests_previewer_status_idx ON public.live_call_requests(previewer_id, status);
CREATE INDEX live_call_requests_viewer_idx ON public.live_call_requests(viewer_id);
CREATE INDEX live_acs_messages_acs_idx ON public.live_acs_messages(acs_id, created_at);
