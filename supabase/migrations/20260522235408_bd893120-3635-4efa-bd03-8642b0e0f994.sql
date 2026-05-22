ALTER TABLE public.live_channels REPLICA IDENTITY FULL;
ALTER TABLE public.live_active_call_spaces REPLICA IDENTITY FULL;
ALTER TABLE public.live_call_requests REPLICA IDENTITY FULL;
ALTER TABLE public.live_acs_messages REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_channels;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_active_call_spaces;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_call_requests;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_acs_messages;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;