-- Allow users to insert and update their own verification row from the client
-- (needed now that ID scanning happens browser-side via IDAnalyzer directly).

create policy "Users can insert own verification"
  on public.verifications
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own verification"
  on public.verifications
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own verification"
  on public.verifications
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- Allow users to upload their own ID images to the id-documents bucket
create policy "Users can upload own ID documents"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'id-documents' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can read own ID documents"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'id-documents'
    and (auth.uid()::text = (storage.foldername(name))[1] or public.has_role(auth.uid(), 'admin'))
  );

create policy "Users can update own ID documents"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'id-documents' and auth.uid()::text = (storage.foldername(name))[1]);
