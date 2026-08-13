ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS archived_at timestamptz;

DROP POLICY IF EXISTS "Listings are viewable by everyone" ON public.listings;
CREATE POLICY "Listings are viewable by everyone"
ON public.listings FOR SELECT
USING (
  auth.uid() = seller_id
  OR (NOT public.is_account_hidden(seller_id) AND archived_at IS NULL)
);

CREATE OR REPLACE FUNCTION public.request_deletion(_mpin text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_check jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  v_check := public.verify_mpin(_mpin);
  IF NOT COALESCE((v_check->>'ok')::boolean, false) THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Incorrect MPIN.');
  END IF;

  INSERT INTO public.account_lifecycle (user_id, state, deletion_requested_at, delete_after)
  VALUES (v_uid, 'pending_deletion', now(), now() + interval '30 days')
  ON CONFLICT (user_id) DO UPDATE
    SET state='pending_deletion',
        deletion_requested_at = now(),
        delete_after = now() + interval '30 days',
        updated_at = now()
    WHERE public.account_lifecycle.state <> 'deleted';

  UPDATE public.listings
     SET archived_at = now()
   WHERE seller_id = v_uid AND archived_at IS NULL;

  RETURN jsonb_build_object('ok', true);
END; $function$;

CREATE OR REPLACE FUNCTION public.cancel_deletion()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  UPDATE public.account_lifecycle
    SET state='active', deletion_requested_at=NULL, delete_after=NULL,
        deactivated_at=NULL, reactivate_at=NULL, deactivation_days=NULL,
        updated_at=now()
    WHERE user_id = v_uid AND state = 'pending_deletion';

  UPDATE public.listings SET archived_at = NULL WHERE seller_id = v_uid AND archived_at IS NOT NULL;

  RETURN jsonb_build_object('ok', true);
END; $function$;

-- Auto-reactivate an account whose scheduled deactivation window has elapsed.
CREATE OR REPLACE FUNCTION public.resolve_lifecycle_on_login()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.account_lifecycle%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_row FROM public.account_lifecycle WHERE user_id = v_uid;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'state', 'active');
  END IF;

  IF v_row.state = 'deactivated'
     AND v_row.reactivate_at IS NOT NULL
     AND v_row.reactivate_at <= now() THEN
    UPDATE public.account_lifecycle
       SET state='active', deactivated_at=NULL, reactivate_at=NULL,
           deactivation_days=NULL, updated_at=now()
     WHERE user_id = v_uid;
    RETURN jsonb_build_object('ok', true, 'state', 'active', 'auto_reactivated', true);
  END IF;

  RETURN jsonb_build_object('ok', true, 'state', v_row.state,
                            'reactivate_at', v_row.reactivate_at,
                            'delete_after', v_row.delete_after);
END; $function$;

REVOKE EXECUTE ON FUNCTION public.resolve_lifecycle_on_login() FROM public;
GRANT EXECUTE ON FUNCTION public.resolve_lifecycle_on_login() TO authenticated, service_role;
