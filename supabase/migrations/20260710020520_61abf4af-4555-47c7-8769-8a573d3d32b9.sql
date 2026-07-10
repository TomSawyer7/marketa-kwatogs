
ALTER VIEW public.user_rating_stats SET (security_invoker = true);

REVOKE EXECUTE ON FUNCTION public.recalc_account_status(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_reviews_recalc() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_reports_recalc() FROM PUBLIC, anon, authenticated;
