ALTER FUNCTION public.messages_guard_update() SECURITY INVOKER;
REVOKE EXECUTE ON FUNCTION public.messages_guard_update() FROM PUBLIC, anon, authenticated;