CREATE POLICY "own lyrics update" ON public.previewer_lyrics FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own brain update" ON public.previewer_brain_messages FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own brand update" ON public.previewer_brand_payloads FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own rec list update" ON public.previewer_recommendations FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own rec update" ON public.previewer_recordings FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);