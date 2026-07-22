
-- 1. Add status column to reviews
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
  CHECK (status IN ('active','removed_review_only','removed_entirely'));

-- 2. review_appeals table
CREATE TABLE IF NOT EXISTS public.review_appeals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL UNIQUE REFERENCES public.reviews(id) ON DELETE CASCADE,
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL,
  buyer_id uuid NOT NULL,
  reason text NOT NULL,
  evidence_urls text[] NOT NULL DEFAULT '{}',
  buyer_chat_consent boolean NOT NULL DEFAULT false,
  seller_chat_consent boolean NOT NULL DEFAULT true,
  buyer_consent_at timestamptz,
  seller_consent_at timestamptz DEFAULT now(),
  status text NOT NULL DEFAULT 'Waiting for Consent'
    CHECK (status IN ('Pending','Waiting for Consent','Under Review','Waiting for Additional Evidence','Approved','Rejected','Resolved')),
  resolution_kind text CHECK (resolution_kind IN ('removed_review_only','removed_entirely')),
  admin_notes text,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.review_appeals TO authenticated;
GRANT ALL ON public.review_appeals TO service_role;

ALTER TABLE public.review_appeals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Seller creates own appeal" ON public.review_appeals
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = seller_id
    AND EXISTS (
      SELECT 1 FROM public.reviews r
      WHERE r.id = review_id AND r.reviewee_id = auth.uid()
    )
  );

CREATE POLICY "Parties and admins read appeals" ON public.review_appeals
  FOR SELECT TO authenticated
  USING (
    auth.uid() = seller_id
    OR auth.uid() = buyer_id
    OR public.has_role(auth.uid(), 'admin')
  );

-- Buyer can update consent; seller can update evidence; admin can update all
CREATE POLICY "Buyer updates own consent" ON public.review_appeals
  FOR UPDATE TO authenticated
  USING (auth.uid() = buyer_id)
  WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Seller updates own evidence" ON public.review_appeals
  FOR UPDATE TO authenticated
  USING (auth.uid() = seller_id)
  WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Admins update appeals" ON public.review_appeals
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Guard trigger: non-admin buyer only edits consent fields; non-admin seller only edits evidence + reason
CREATE OR REPLACE FUNCTION public.review_appeals_guard_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF auth.uid() = OLD.buyer_id THEN
    IF NEW.seller_id IS DISTINCT FROM OLD.seller_id
      OR NEW.buyer_id IS DISTINCT FROM OLD.buyer_id
      OR NEW.review_id IS DISTINCT FROM OLD.review_id
      OR NEW.reason IS DISTINCT FROM OLD.reason
      OR NEW.evidence_urls IS DISTINCT FROM OLD.evidence_urls
      OR NEW.status IS DISTINCT FROM OLD.status
      OR NEW.resolution_kind IS DISTINCT FROM OLD.resolution_kind
      OR NEW.admin_notes IS DISTINCT FROM OLD.admin_notes THEN
      RAISE EXCEPTION 'Buyer may only update consent fields';
    END IF;
    IF NEW.buyer_chat_consent IS DISTINCT FROM OLD.buyer_chat_consent THEN
      NEW.buyer_consent_at := CASE WHEN NEW.buyer_chat_consent THEN now() ELSE NULL END;
    END IF;
  ELSIF auth.uid() = OLD.seller_id THEN
    IF NEW.buyer_chat_consent IS DISTINCT FROM OLD.buyer_chat_consent
      OR NEW.status IS DISTINCT FROM OLD.status
      OR NEW.resolution_kind IS DISTINCT FROM OLD.resolution_kind
      OR NEW.admin_notes IS DISTINCT FROM OLD.admin_notes THEN
      RAISE EXCEPTION 'Seller may only update evidence/reason';
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.review_appeals_guard_update() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER review_appeals_guard_update
BEFORE UPDATE ON public.review_appeals
FOR EACH ROW EXECUTE FUNCTION public.review_appeals_guard_update();

-- Auto-advance to Under Review once buyer consents
CREATE OR REPLACE FUNCTION public.review_appeals_auto_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'Waiting for Consent'
     AND NEW.buyer_chat_consent = true
     AND NEW.seller_chat_consent = true THEN
    NEW.status := 'Under Review';
  END IF;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.review_appeals_auto_status() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER review_appeals_auto_status
BEFORE UPDATE ON public.review_appeals
FOR EACH ROW EXECUTE FUNCTION public.review_appeals_auto_status();

-- Apply resolution to reviews
CREATE OR REPLACE FUNCTION public.review_appeals_apply_resolution()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IN ('Approved','Rejected','Resolved')
     AND OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.resolved_at := COALESCE(NEW.resolved_at, now());
    -- revoke consent so admin loses chat read access immediately
    NEW.buyer_chat_consent := false;
    NEW.seller_chat_consent := false;
    NEW.buyer_consent_at := NULL;
    NEW.seller_consent_at := NULL;

    IF NEW.status = 'Approved' AND NEW.resolution_kind IS NOT NULL THEN
      UPDATE public.reviews SET status = NEW.resolution_kind, updated_at = now()
        WHERE id = NEW.review_id;
      PERFORM public.recalc_account_status((SELECT reviewee_id FROM public.reviews WHERE id = NEW.review_id));
    ELSIF NEW.status = 'Rejected' THEN
      UPDATE public.reviews SET status = 'active', updated_at = now()
        WHERE id = NEW.review_id AND status <> 'active';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.review_appeals_apply_resolution() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER review_appeals_apply_resolution
BEFORE UPDATE ON public.review_appeals
FOR EACH ROW EXECUTE FUNCTION public.review_appeals_apply_resolution();

-- 3. Admin dual-consent read policy on messages
CREATE POLICY "Admin reads during active appeal"
ON public.messages FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  AND EXISTS (
    SELECT 1 FROM public.review_appeals ra
    JOIN public.transactions t ON t.id = ra.transaction_id
    WHERE t.thread_id = messages.thread_id
      AND ra.buyer_chat_consent = true
      AND ra.seller_chat_consent = true
      AND ra.status IN ('Under Review','Waiting for Additional Evidence')
  )
);

-- 4. Storage RLS for appeal-evidence bucket
CREATE POLICY "Seller uploads own appeal evidence"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'appeal-evidence'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Seller reads own appeal evidence"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'appeal-evidence'
  AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin'))
);

CREATE POLICY "Seller deletes own appeal evidence"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'appeal-evidence'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- updated_at trigger
CREATE TRIGGER review_appeals_touch_updated_at
BEFORE UPDATE ON public.review_appeals
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
