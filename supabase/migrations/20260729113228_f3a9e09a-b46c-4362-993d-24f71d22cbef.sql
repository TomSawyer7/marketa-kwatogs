CREATE OR REPLACE FUNCTION public.verify_mpin_reset_otp(_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_token text;
  v_sent_at timestamptz;
  v_hash text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF _code !~ '^[0-9]{8}$' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Enter the 8-digit code.');
  END IF;

  SELECT email, reauthentication_token, reauthentication_sent_at
    INTO v_email, v_token, v_sent_at
  FROM auth.users
  WHERE id = v_uid;

  IF v_email IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'No email is linked to this account.');
  END IF;

  IF v_token IS NULL OR v_token = '' OR v_sent_at IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Request a new verification code.');
  END IF;

  IF v_sent_at < now() - interval '10 minutes' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'That code has expired. Request a new one.');
  END IF;

  v_hash := encode(extensions.digest(v_email || _code, 'sha224'), 'hex');

  IF v_hash <> v_token THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Invalid verification code.');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.verify_mpin_reset_otp(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_mpin_reset_otp(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_mpin_reset_otp(text) TO service_role;