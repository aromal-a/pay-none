-- Allow a viewer to delete their own call requests (anonymity on role switch)
CREATE POLICY "Viewers delete own requests"
ON public.live_call_requests
FOR DELETE
TO authenticated
USING (auth.uid() = viewer_id);

-- Allow ACS participants to delete their own messages (used by wipe)
CREATE POLICY "Authors delete own ACS messages"
ON public.live_acs_messages
FOR DELETE
TO authenticated
USING (auth.uid() = author_id);

-- Wipe helper: discards the caller's viewer-side records.
CREATE OR REPLACE FUNCTION public.wipe_viewer_traces()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_msgs int := 0;
  v_reqs int := 0;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- Delete ACS messages this user wrote while they were the viewer side.
  WITH d AS (
    DELETE FROM public.live_acs_messages m
    USING public.live_active_call_spaces a
    WHERE m.acs_id = a.id
      AND m.author_id = v_user
      AND a.viewer_id = v_user
    RETURNING 1
  ) SELECT count(*) INTO v_msgs FROM d;

  -- Delete this user's call requests (sent as viewer).
  WITH d AS (
    DELETE FROM public.live_call_requests
    WHERE viewer_id = v_user
    RETURNING 1
  ) SELECT count(*) INTO v_reqs FROM d;

  RETURN jsonb_build_object('messages_wiped', v_msgs, 'requests_wiped', v_reqs);
END;
$$;