DROP POLICY IF EXISTS "Previewers create channels" ON public.live_channels;
CREATE POLICY "Authenticated create own channels"
ON public.live_channels
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = previewer_id);