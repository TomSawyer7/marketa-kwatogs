CREATE POLICY "Users upload own liveness media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'liveness-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users read own liveness media"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'liveness-media' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin')));

CREATE POLICY "Users update own liveness media"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'liveness-media' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'liveness-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users delete own liveness media"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'liveness-media' AND (storage.foldername(name))[1] = auth.uid()::text);