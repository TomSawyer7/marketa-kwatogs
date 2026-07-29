
-- 1. Lifecycle table
CREATE TABLE public.account_lifecycle (
  user_id uuid PRIMARY KEY,
  state text NOT NULL DEFAULT 'active',
  deactivated_at timestamptz,
  reactivate_at timestamptz,
  deactivation_days integer,
  deletion_requested_at timestamptz,
  delete_after timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.account_lifecycle TO authenticated;
GRANT ALL ON public.account_lifecycle TO service_role;

ALTER TABLE public.account_lifecycle ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own lifecycle"
  ON public.account_lifecycle FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all lifecycle"
  ON public.account_lifecycle FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER account_lifecycle_touch
  BEFORE UPDATE ON public.account_lifecycle
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2. Deletion audit log (no personal data)
CREATE TABLE public.account_deletion_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grace_started_at timestamptz,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  had_kyc boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.account_deletion_log TO authenticated;
GRANT ALL ON public.account_deletion_log TO service_role;

ALTER TABLE public.account_deletion_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view deletion log"
  ON public.account_deletion_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3. Visibility helper
CREATE OR REPLACE FUNCTION public.is_account_hidden(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.account_lifecycle
    WHERE user_id = _user_id
      AND state IN ('deactivated','pending_deletion')
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_account_hidden(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.is_account_hidden(uuid) TO anon, authenticated, service_role;

-- 4. Marketplace hiding
DROP POLICY IF EXISTS "Public can view basic profile fields" ON public.profiles;
CREATE POLICY "Public can view basic profile fields"
  ON public.profiles FOR SELECT
  USING (NOT public.is_account_hidden(id));

DROP POLICY IF EXISTS "Listings are viewable by everyone" ON public.listings;
CREATE POLICY "Listings are viewable by everyone"
  ON public.listings FOR SELECT
  USING (auth.uid() = seller_id OR NOT public.is_account_hidden(seller_id));

-- 5. RPCs
CREATE OR REPLACE FUNCTION public.request_deactivation(_mpin text, _days integer DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_check jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _days IS NOT NULL AND _days NOT IN (7,30,90) THEN
    RAISE EXCEPTION 'Invalid duration';
  END IF;

  v_check := public.verify_mpin(_mpin);
  IF NOT COALESCE((v_check->>'ok')::boolean, false) THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Incorrect MPIN.');
  END IF;

  INSERT INTO public.account_lifecycle (user_id, state, deactivated_at, reactivate_at, deactivation_days)
  VALUES (v_uid, 'deactivated', now(),
          CASE WHEN _days IS NULL THEN NULL ELSE now() + make_interval(days => _days) END,
          _days)
  ON CONFLICT (user_id) DO UPDATE
    SET state = 'deactivated',
        deactivated_at = now(),
        reactivate_at = EXCLUDED.reactivate_at,
        deactivation_days = EXCLUDED.deactivation_days,
        deletion_requested_at = NULL,
        delete_after = NULL,
        updated_at = now()
    WHERE public.account_lifecycle.state <> 'deleted';

  RETURN jsonb_build_object('ok', true);
END; $$;

CREATE OR REPLACE FUNCTION public.reactivate_account()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  UPDATE public.account_lifecycle
    SET state='active', deactivated_at=NULL, reactivate_at=NULL,
        deactivation_days=NULL, updated_at=now()
    WHERE user_id = v_uid AND state = 'deactivated';
  RETURN jsonb_build_object('ok', true);
END; $$;

CREATE OR REPLACE FUNCTION public.request_deletion(_mpin text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  RETURN jsonb_build_object('ok', true);
END; $$;

CREATE OR REPLACE FUNCTION public.cancel_deletion()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  UPDATE public.account_lifecycle
    SET state='active', deletion_requested_at=NULL, delete_after=NULL,
        deactivated_at=NULL, reactivate_at=NULL, deactivation_days=NULL,
        updated_at=now()
    WHERE user_id = v_uid AND state = 'pending_deletion';
  RETURN jsonb_build_object('ok', true);
END; $$;

REVOKE EXECUTE ON FUNCTION public.request_deactivation(text,integer) FROM public;
REVOKE EXECUTE ON FUNCTION public.reactivate_account() FROM public;
REVOKE EXECUTE ON FUNCTION public.request_deletion(text) FROM public;
REVOKE EXECUTE ON FUNCTION public.cancel_deletion() FROM public;
GRANT EXECUTE ON FUNCTION public.request_deactivation(text,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reactivate_account() TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_deletion(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_deletion() TO authenticated;
