-- Add first_name and last_name to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text;

-- Update handle_new_user trigger function to populate first_name / last_name
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  meta_first text := new.raw_user_meta_data->>'first_name';
  meta_last  text := new.raw_user_meta_data->>'last_name';
  meta_name  text := coalesce(
    new.raw_user_meta_data->>'name',
    nullif(trim(coalesce(meta_first,'') || ' ' || coalesce(meta_last,'')), ''),
    split_part(new.email, '@', 1)
  );
begin
  insert into public.profiles (id, name, first_name, last_name, email)
  values (
    new.id,
    meta_name,
    meta_first,
    meta_last,
    new.email
  )
  on conflict (id) do update
    set first_name = coalesce(excluded.first_name, public.profiles.first_name),
        last_name  = coalesce(excluded.last_name,  public.profiles.last_name),
        name       = coalesce(excluded.name,       public.profiles.name),
        email      = coalesce(excluded.email,      public.profiles.email);

  insert into public.user_roles (user_id, role)
  values (new.id, 'user')
  on conflict do nothing;

  return new;
end;
$function$;

-- Ensure trigger is attached to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();