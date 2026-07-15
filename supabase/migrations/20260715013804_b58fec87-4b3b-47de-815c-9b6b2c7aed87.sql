
REVOKE EXECUTE ON FUNCTION public.messages_bump_thread() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.transactions_handshake() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.transactions_post_completion_message() FROM PUBLIC, anon, authenticated;
