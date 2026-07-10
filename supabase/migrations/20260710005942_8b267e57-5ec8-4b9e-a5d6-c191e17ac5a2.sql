
-- 1) Profiles: restrict SELECT to owner/admin
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2) Verifications: prevent users from modifying system-managed columns
REVOKE UPDATE ON public.verifications FROM authenticated, anon;
GRANT UPDATE (
  status,
  id_front_path,
  id_back_path,
  ocr_full_name,
  ocr_first_name,
  ocr_middle_name,
  ocr_last_name,
  ocr_date_of_birth,
  ocr_gender,
  ocr_sex,
  ocr_psn,
  ocr_document_number,
  ocr_address,
  ocr_nationality,
  ocr_place_of_birth,
  ocr_blood_type,
  ocr_marital_status,
  ocr_date_of_issue,
  qr_payload,
  submitted_at,
  updated_at
) ON public.verifications TO authenticated;

-- 3) user_roles: deny all writes from regular clients (only service_role/admin edge paths mutate)
REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM authenticated, anon, PUBLIC;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

-- 4) Storage: add DELETE policy for id-documents (owner or admin)
DROP POLICY IF EXISTS "Users can delete own ID documents" ON storage.objects;
CREATE POLICY "Users can delete own ID documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'id-documents'
    AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin'))
  );

-- 5) Function search_path
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;
