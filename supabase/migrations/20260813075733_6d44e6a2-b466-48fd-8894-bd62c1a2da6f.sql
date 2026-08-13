CREATE OR REPLACE FUNCTION public.reactivate_account()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  UPDATE public.account_lifecycle
    SET state='active', deactivated_at=NULL, reactivate_at=NULL,
        deactivation_days=NULL, updated_at=now()
    WHERE user_id = v_uid AND state = 'deactivated';
  UPDATE public.listings SET archived_at = NULL WHERE seller_id = v_uid AND archived_at IS NOT NULL;
  RETURN jsonb_build_object('ok', true);
END; $function$;

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
    UPDATE public.listings SET archived_at = NULL
      WHERE seller_id = v_uid AND archived_at IS NOT NULL;
    RETURN jsonb_build_object('ok', true, 'state', 'active', 'auto_reactivated', true);
  END IF;

  RETURN jsonb_build_object('ok', true, 'state', v_row.state,
                            'reactivate_at', v_row.reactivate_at,
                            'delete_after', v_row.delete_after);
END; $function$;