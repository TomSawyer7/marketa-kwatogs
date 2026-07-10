
-- Transactions
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL,
  buyer_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending_confirmation' CHECK (status IN ('pending_confirmation','completed','cancelled')),
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (seller_id <> buyer_id)
);
GRANT SELECT, INSERT, UPDATE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants read transactions" ON public.transactions
  FOR SELECT TO authenticated
  USING (auth.uid() = seller_id OR auth.uid() = buyer_id OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Seller creates transaction for own listing" ON public.transactions
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = seller_id
    AND EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.seller_id = auth.uid())
  );

CREATE POLICY "Buyer confirms transaction" ON public.transactions
  FOR UPDATE TO authenticated
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id)
  WITH CHECK (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE TRIGGER trg_transactions_updated_at BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Reviews
CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL,
  reviewee_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('buyer','seller')),
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  tags text[] NOT NULL DEFAULT '{}',
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (transaction_id, reviewer_id)
);
GRANT SELECT ON public.reviews TO anon;
GRANT SELECT, INSERT ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reviews are public" ON public.reviews FOR SELECT USING (true);

CREATE POLICY "Reviewer inserts on completed transaction" ON public.reviews
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = reviewer_id
    AND EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_id
        AND t.status = 'completed'
        AND ((role = 'buyer' AND t.buyer_id = auth.uid() AND reviewee_id = t.seller_id)
          OR (role = 'seller' AND t.seller_id = auth.uid() AND reviewee_id = t.buyer_id))
    )
  );

CREATE TRIGGER trg_reviews_updated_at BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Review reports
CREATE TABLE public.review_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','upheld','dismissed')),
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (review_id, reporter_id)
);
GRANT SELECT, INSERT ON public.review_reports TO authenticated;
GRANT UPDATE ON public.review_reports TO authenticated;
GRANT ALL ON public.review_reports TO service_role;
ALTER TABLE public.review_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reporter reads own reports; admins read all" ON public.review_reports
  FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "User creates own report" ON public.review_reports
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Admins update reports" ON public.review_reports
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_review_reports_updated_at BEFORE UPDATE ON public.review_reports
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Account status
CREATE TABLE public.account_status (
  user_id uuid PRIMARY KEY,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','restricted','suspended')),
  reason text,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.account_status TO anon, authenticated;
GRANT ALL ON public.account_status TO service_role;
ALTER TABLE public.account_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account status public read" ON public.account_status FOR SELECT USING (true);
CREATE POLICY "Admins manage account status" ON public.account_status
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_account_status_updated_at BEFORE UPDATE ON public.account_status
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Appeals
CREATE TABLE public.account_appeals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','denied')),
  admin_note text,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.account_appeals TO authenticated;
GRANT UPDATE ON public.account_appeals TO authenticated;
GRANT ALL ON public.account_appeals TO service_role;
ALTER TABLE public.account_appeals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User reads own appeals; admins read all" ON public.account_appeals
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "User creates own appeal" ON public.account_appeals
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins update appeals" ON public.account_appeals
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_account_appeals_updated_at BEFORE UPDATE ON public.account_appeals
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Rating stats view
CREATE OR REPLACE VIEW public.user_rating_stats AS
SELECT
  reviewee_id AS user_id,
  ROUND(AVG(rating)::numeric, 2) AS avg_rating,
  COUNT(*)::int AS review_count
FROM public.reviews
GROUP BY reviewee_id;
GRANT SELECT ON public.user_rating_stats TO anon, authenticated;

-- Recalc function
CREATE OR REPLACE FUNCTION public.recalc_account_status(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_avg numeric;
  v_count int;
  v_reports int;
  v_current text;
  v_reason text;
BEGIN
  SELECT ROUND(AVG(rating)::numeric,2), COUNT(*) INTO v_avg, v_count
  FROM public.reviews WHERE reviewee_id = _user_id;

  SELECT COUNT(*) INTO v_reports
  FROM public.review_reports rr
  JOIN public.reviews r ON r.id = rr.review_id
  WHERE r.reviewee_id = _user_id AND rr.status = 'upheld';

  SELECT status INTO v_current FROM public.account_status WHERE user_id = _user_id;

  -- Don't override manual admin actions (suspended, or manual restriction)
  IF v_current = 'suspended' THEN RETURN; END IF;

  IF v_reports >= 3 THEN
    v_reason := 'auto:reports';
  ELSIF v_count >= 5 AND v_avg < 2.0 THEN
    v_reason := 'auto:low_rating';
  ELSE
    v_reason := NULL;
  END IF;

  IF v_reason IS NOT NULL THEN
    INSERT INTO public.account_status(user_id,status,reason,updated_by)
    VALUES (_user_id,'restricted',v_reason,NULL)
    ON CONFLICT (user_id) DO UPDATE
      SET status='restricted', reason=v_reason, updated_at=now()
      WHERE public.account_status.status <> 'suspended'
        AND (public.account_status.reason LIKE 'auto:%' OR public.account_status.reason IS NULL);
  ELSE
    -- Only auto-clear if the current restriction was auto
    UPDATE public.account_status
      SET status='active', reason=NULL, updated_at=now()
      WHERE user_id = _user_id AND status = 'restricted' AND reason LIKE 'auto:%';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_reviews_recalc()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  PERFORM public.recalc_account_status(COALESCE(NEW.reviewee_id, OLD.reviewee_id));
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_reviews_after_ins AFTER INSERT ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.trg_reviews_recalc();

CREATE OR REPLACE FUNCTION public.trg_reports_recalc()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_reviewee uuid;
BEGIN
  SELECT reviewee_id INTO v_reviewee FROM public.reviews WHERE id = NEW.review_id;
  PERFORM public.recalc_account_status(v_reviewee);
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_reports_after_upd AFTER UPDATE ON public.review_reports
  FOR EACH ROW WHEN (NEW.status IS DISTINCT FROM OLD.status)
  EXECUTE FUNCTION public.trg_reports_recalc();
