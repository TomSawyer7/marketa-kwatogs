
DROP POLICY IF EXISTS "Account status public read" ON public.account_status;
CREATE POLICY "Users read own account status" ON public.account_status
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Reviews are public" ON public.reviews;
CREATE POLICY "Authenticated users read reviews" ON public.reviews
  FOR SELECT TO authenticated
  USING (true);
