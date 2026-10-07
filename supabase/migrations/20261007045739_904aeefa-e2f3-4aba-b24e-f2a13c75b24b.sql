DROP TRIGGER IF EXISTS trg_reports_after_upd ON public.review_reports;

CREATE OR REPLACE FUNCTION public.recalc_account_status(_user_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_avg numeric; v_count int; v_current text; v_reason text;
BEGIN
  SELECT ROUND(AVG(rating)::numeric,2), COUNT(*) INTO v_avg, v_count FROM public.reviews WHERE reviewee_id = _user_id;
  SELECT status INTO v_current FROM public.account_status WHERE user_id = _user_id;
  IF v_current = 'suspended' THEN RETURN; END IF;
  IF v_count >= 5 AND v_avg < 2.0 THEN v_reason := 'auto:low_rating'; ELSE v_reason := NULL; END IF;
  IF v_reason IS NOT NULL THEN
    INSERT INTO public.account_status(user_id,status,reason,updated_by) VALUES (_user_id,'restricted',v_reason,NULL)
    ON CONFLICT (user_id) DO UPDATE SET status='restricted', reason=v_reason, updated_at=now()
      WHERE public.account_status.status <> 'suspended' AND (public.account_status.reason LIKE 'auto:%' OR public.account_status.reason IS NULL);
  ELSE
    UPDATE public.account_status SET status='active', reason=NULL, updated_at=now()
      WHERE user_id = _user_id AND status = 'restricted' AND reason LIKE 'auto:%';
  END IF;
END; $function$;

ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS seller_reply text, ADD COLUMN IF NOT EXISTS seller_reply_at timestamptz;

CREATE OR REPLACE FUNCTION public.set_review_reply(_review_id uuid, _reply text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE r public.reviews%ROWTYPE; v_text text := NULLIF(btrim(coalesce(_reply,'')),'');
BEGIN
  SELECT * INTO r FROM public.reviews WHERE id = _review_id;
  IF NOT FOUND OR r.reviewee_id <> auth.uid() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF v_text IS NOT NULL AND length(v_text) > 500 THEN RAISE EXCEPTION 'Reply too long'; END IF;
  UPDATE public.reviews SET seller_reply = v_text, seller_reply_at = CASE WHEN v_text IS NULL THEN NULL ELSE now() END WHERE id = _review_id;
  IF v_text IS NOT NULL AND r.seller_reply IS NULL THEN
    INSERT INTO public.notifications(user_id, title, message, type, meta)
    VALUES (r.reviewer_id, 'New reply to your review', left(v_text, 140), 'review_reply', jsonb_build_object('review_id', _review_id, 'reviewee_id', r.reviewee_id));
  END IF;
END; $$;
REVOKE ALL ON FUNCTION public.set_review_reply(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_review_reply(uuid, text) TO authenticated;