CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker=on) AS
SELECT id, name, avatar_url, location, created_at
FROM public.profiles;

GRANT SELECT ON public.profiles_public TO anon, authenticated;

CREATE POLICY "Public can view basic profile fields"
ON public.profiles FOR SELECT
TO anon, authenticated
USING (true);