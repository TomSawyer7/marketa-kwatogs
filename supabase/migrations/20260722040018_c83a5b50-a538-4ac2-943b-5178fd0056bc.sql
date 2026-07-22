ALTER TABLE public.review_appeals REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.review_appeals;