CREATE OR REPLACE FUNCTION public.request_deactivation(_mpin text, _days integer DEFAULT NULL::integer)
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
  IF _days IS NULL OR _days NOT IN (7,30) THEN
    RAISE EXCEPTION 'Invalid duration';
  END IF;

  v_check := public.verify_mpin(_mpin);
  IF NOT COALESCE((v_check->>'ok')::boolean, false) THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Incorrect MPIN.');
  END IF;

  INSERT INTO public.account_lifecycle (user_id, state, deactivated_at, reactivate_at, deactivation_days)
  VALUES (v_uid, 'deactivated', now(), now() + make_interval(days => _days), _days)
  ON CONFLICT (user_id) DO UPDATE
    SET state = 'deactivated',
        deactivated_at = now(),
        reactivate_at = EXCLUDED.reactivate_at,
        deactivation_days = EXCLUDED.deactivation_days,
        deletion_requested_at = NULL,
        delete_after = NULL,
        updated_at = now()
    WHERE public.account_lifecycle.state <> 'deleted';

  UPDATE public.listings SET archived_at = now() WHERE seller_id = v_uid AND archived_at IS NULL;

  RETURN jsonb_build_object('ok', true);
END; $function$;