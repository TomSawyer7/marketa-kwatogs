
-- 1) Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'appeal_update',
  is_read boolean NOT NULL DEFAULT false,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own notifications"
ON public.notifications FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users mark own notifications read"
ON public.notifications FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON public.notifications (user_id, created_at DESC);

ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- 2) Extend the resolution trigger: clear comment on removed_review_only,
--    and emit notifications to both parties.
CREATE OR REPLACE FUNCTION public.review_appeals_apply_resolution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reviewee uuid;
  v_reviewer uuid;
  v_title text;
  v_buyer_msg text;
  v_seller_msg text;
  v_note text;
BEGIN
  IF NEW.status IN ('Approved','Rejected','Resolved')
     AND OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.resolved_at := COALESCE(NEW.resolved_at, now());
    NEW.buyer_chat_consent := false;
    NEW.seller_chat_consent := false;
    NEW.buyer_consent_at := NULL;
    NEW.seller_consent_at := NULL;

    SELECT reviewee_id, reviewer_id
      INTO v_reviewee, v_reviewer
      FROM public.reviews WHERE id = NEW.review_id;

    IF NEW.status = 'Approved' AND NEW.resolution_kind = 'removed_entirely' THEN
      UPDATE public.reviews
         SET status = 'removed_entirely', updated_at = now()
       WHERE id = NEW.review_id;
      PERFORM public.recalc_account_status(v_reviewee);
      v_title := 'Appeal approved — review removed';
      v_seller_msg := 'Your appeal was upheld. The reported rating and review have been removed from your profile.';
      v_buyer_msg  := 'An appeal on your review was upheld. The rating and comment have been removed.';
    ELSIF NEW.status = 'Approved' AND NEW.resolution_kind = 'removed_review_only' THEN
      UPDATE public.reviews
         SET status = 'removed_review_only', comment = NULL, updated_at = now()
       WHERE id = NEW.review_id;
      PERFORM public.recalc_account_status(v_reviewee);
      v_title := 'Appeal approved — comment removed';
      v_seller_msg := 'Your appeal was upheld in part. The written comment was removed; the star rating remains.';
      v_buyer_msg  := 'An appeal on your review was partially upheld. Your written comment was removed; the star rating remains.';
    ELSIF NEW.status = 'Rejected' THEN
      UPDATE public.reviews SET status = 'active', updated_at = now()
        WHERE id = NEW.review_id AND status <> 'active';
      v_title := 'Appeal dismissed';
      v_seller_msg := 'Your appeal was dismissed. The review was found to be legitimate and will remain on your profile.';
      v_buyer_msg  := 'An appeal on your review was dismissed. Your review remains active.';
    ELSE
      v_title := 'Appeal resolved';
      v_seller_msg := 'Your appeal has been resolved.';
      v_buyer_msg  := 'An appeal involving your review has been resolved.';
    END IF;

    v_note := COALESCE(NULLIF(trim(NEW.admin_notes), ''), NULL);
    IF v_note IS NOT NULL THEN
      v_seller_msg := v_seller_msg || E'\n\nAdmin note: ' || v_note;
      v_buyer_msg  := v_buyer_msg  || E'\n\nAdmin note: ' || v_note;
    END IF;

    -- Notify seller (reviewee / appeal author)
    IF NEW.seller_id IS NOT NULL THEN
      INSERT INTO public.notifications(user_id, title, message, type, meta)
      VALUES (
        NEW.seller_id, v_title, v_seller_msg, 'appeal_update',
        jsonb_build_object(
          'appeal_id', NEW.id,
          'review_id', NEW.review_id,
          'decision', NEW.status,
          'resolution_kind', NEW.resolution_kind,
          'role', 'seller'
        )
      );
    END IF;

    -- Notify buyer (reviewer)
    IF NEW.buyer_id IS NOT NULL THEN
      INSERT INTO public.notifications(user_id, title, message, type, meta)
      VALUES (
        NEW.buyer_id, v_title, v_buyer_msg, 'appeal_update',
        jsonb_build_object(
          'appeal_id', NEW.id,
          'review_id', NEW.review_id,
          'decision', NEW.status,
          'resolution_kind', NEW.resolution_kind,
          'role', 'buyer'
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END; $$;

REVOKE EXECUTE ON FUNCTION public.review_appeals_apply_resolution() FROM PUBLIC, anon, authenticated;
