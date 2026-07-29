CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE public.user_mpins (
  user_id uuid PRIMARY KEY,
  mpin_hash text NOT NULL,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.user_mpins TO service_role;

ALTER TABLE public.user_mpins ENABLE ROW LEVEL SECURITY;

-- No policies for anon/authenticated: the hash is only reachable via the
-- security-definer functions below.

CREATE TRIGGER user_mpins_touch
BEFORE UPDATE ON public.user_mpins
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Status: does the caller have an MPIN, and are they locked out?
CREATE OR REPLACE FUNCTION public.mpin_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.user_mpins%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_row FROM public.user_mpins WHERE user_id = v_uid;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('has_mpin', false, 'locked', false, 'attempts_left', 5);
  END IF;

  RETURN jsonb_build_object(
    'has_mpin', true,
    'locked', COALESCE(v_row.locked_until > now(), false),
    'attempts_left', GREATEST(0, 5 - v_row.failed_attempts)
  );
END;
$$;

-- Create or reset the caller's MPIN.
CREATE OR REPLACE FUNCTION public.set_mpin(_mpin text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF _mpin !~ '^[0-9]{6}$' THEN
    RAISE EXCEPTION 'MPIN must be exactly 6 digits';
  END IF;

  INSERT INTO public.user_mpins (user_id, mpin_hash, failed_attempts, locked_until)
  VALUES (v_uid, extensions.crypt(_mpin, extensions.gen_salt('bf')), 0, NULL)
  ON CONFLICT (user_id) DO UPDATE
    SET mpin_hash = EXCLUDED.mpin_hash,
        failed_attempts = 0,
        locked_until = NULL,
        updated_at = now();

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Verify the caller's MPIN, tracking failed attempts server-side.
CREATE OR REPLACE FUNCTION public.verify_mpin(_mpin text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.user_mpins%ROWTYPE;
  v_attempts integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_row FROM public.user_mpins WHERE user_id = v_uid;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'has_mpin', false, 'locked', false, 'attempts_left', 5);
  END IF;

  IF v_row.locked_until IS NOT NULL AND v_row.locked_until > now() THEN
    RETURN jsonb_build_object('ok', false, 'has_mpin', true, 'locked', true, 'attempts_left', 0);
  END IF;

  IF _mpin ~ '^[0-9]{6}$' AND extensions.crypt(_mpin, v_row.mpin_hash) = v_row.mpin_hash THEN
    UPDATE public.user_mpins
      SET failed_attempts = 0, locked_until = NULL, updated_at = now()
      WHERE user_id = v_uid;
    RETURN jsonb_build_object('ok', true, 'has_mpin', true, 'locked', false, 'attempts_left', 5);
  END IF;

  v_attempts := v_row.failed_attempts + 1;

  UPDATE public.user_mpins
    SET failed_attempts = v_attempts,
        locked_until = CASE WHEN v_attempts >= 5 THEN now() + interval '15 minutes' ELSE NULL END,
        updated_at = now()
    WHERE user_id = v_uid;

  RETURN jsonb_build_object(
    'ok', false,
    'has_mpin', true,
    'locked', v_attempts >= 5,
    'attempts_left', GREATEST(0, 5 - v_attempts)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mpin_status() FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.set_mpin(text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.verify_mpin(text) FROM public, anon;

GRANT EXECUTE ON FUNCTION public.mpin_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_mpin(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_mpin(text) TO authenticated;