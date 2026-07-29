CREATE TABLE public.legal_acceptances (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document text NOT NULL CHECK (document IN ('terms','privacy','kyc_certification','community')),
  version text NOT NULL,
  context text NOT NULL CHECK (context IN ('registration','kyc','settings')),
  user_agent text,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX legal_acceptances_user_idx ON public.legal_acceptances(user_id, document, accepted_at DESC);

GRANT SELECT, INSERT ON public.legal_acceptances TO authenticated;
GRANT ALL ON public.legal_acceptances TO service_role;

ALTER TABLE public.legal_acceptances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own acceptances"
  ON public.legal_acceptances FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users read own acceptances"
  ON public.legal_acceptances FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins read all acceptances"
  ON public.legal_acceptances FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));