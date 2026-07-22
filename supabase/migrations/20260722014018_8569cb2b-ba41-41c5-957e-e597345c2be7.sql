
-- 1. Dedupe existing threads by (user_a, user_b, listing_id)
WITH ranked AS (
  SELECT id, user_a, user_b, listing_id, created_at,
    ROW_NUMBER() OVER (
      PARTITION BY user_a, user_b, COALESCE(listing_id::text, '__nil__')
      ORDER BY created_at ASC
    ) AS rn,
    FIRST_VALUE(id) OVER (
      PARTITION BY user_a, user_b, COALESCE(listing_id::text, '__nil__')
      ORDER BY created_at ASC
    ) AS keeper_id
  FROM public.threads
),
dupes AS (SELECT id, keeper_id FROM ranked WHERE rn > 1)
UPDATE public.messages m
   SET thread_id = d.keeper_id
  FROM dupes d
 WHERE m.thread_id = d.id;

WITH ranked AS (
  SELECT id, user_a, user_b, listing_id, created_at,
    ROW_NUMBER() OVER (
      PARTITION BY user_a, user_b, COALESCE(listing_id::text, '__nil__')
      ORDER BY created_at ASC
    ) AS rn
  FROM public.threads
)
DELETE FROM public.threads t USING ranked r WHERE t.id = r.id AND r.rn > 1;

-- 2. Unique indexes for future dedupe
CREATE UNIQUE INDEX IF NOT EXISTS threads_pair_listing_unique
  ON public.threads(user_a, user_b, listing_id) WHERE listing_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS threads_pair_dm_unique
  ON public.threads(user_a, user_b) WHERE listing_id IS NULL;

-- 3. Add image_url to messages
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS image_url text;

-- 4. Storage RLS for chat-attachments bucket (bucket created via storage tool)
-- Path convention: <thread_id>/<uuid>.<ext>
CREATE POLICY "chat_attach_select_participants"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'chat-attachments'
    AND EXISTS (
      SELECT 1 FROM public.threads t
      WHERE t.id::text = split_part(name, '/', 1)
        AND (t.user_a = auth.uid() OR t.user_b = auth.uid())
    )
  );

CREATE POLICY "chat_attach_insert_participants"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat-attachments'
    AND owner = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.threads t
      WHERE t.id::text = split_part(name, '/', 1)
        AND (t.user_a = auth.uid() OR t.user_b = auth.uid())
    )
  );

CREATE POLICY "chat_attach_delete_own"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'chat-attachments' AND owner = auth.uid());
