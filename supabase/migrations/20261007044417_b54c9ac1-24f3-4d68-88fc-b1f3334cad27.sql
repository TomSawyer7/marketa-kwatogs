DROP POLICY IF EXISTS "Admin reads during active appeal" ON public.messages;
ALTER TABLE public.review_reports ADD COLUMN IF NOT EXISTS admin_note text;