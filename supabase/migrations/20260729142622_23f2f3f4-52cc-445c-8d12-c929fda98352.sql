
-- ============ Behavior Monitoring / Anti-Fraud ============

-- 1. Lockout tables (progressive)
CREATE TABLE public.login_lockouts (
  identifier text PRIMARY KEY,           -- lowercased email
  user_id uuid,
  failed_count int NOT NULL DEFAULT 0,
  window_started_at timestamptz,
  lock_level int NOT NULL DEFAULT 0,
  locked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.login_lockouts TO service_role;
ALTER TABLE public.login_lockouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read login lockouts" ON public.login_lockouts
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.mpin_lockouts (
  user_id uuid PRIMARY KEY,
  failed_count int NOT NULL DEFAULT 0,
  window_started_at timestamptz,
  lock_level int NOT NULL DEFAULT 0,
  locked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.mpin_lockouts TO service_role;
ALTER TABLE public.mpin_lockouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read mpin lockouts" ON public.mpin_lockouts
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "user reads own mpin lockout" ON public.mpin_lockouts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 2. Behavior events (individual detections)
CREATE TABLE public.behavior_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  category text NOT NULL,          -- login | mpin | reporting | listings | messaging | transactions
  event_type text NOT NULL,        -- e.g. login_lockout, spam_burst
  severity text NOT NULL DEFAULT 'low', -- low|medium|high
  score_delta int NOT NULL DEFAULT 0,
  description text,
  ip inet,
  device text,
  browser text,
  session_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX behavior_events_user_created_idx ON public.behavior_events(user_id, created_at DESC);
CREATE INDEX behavior_events_category_idx ON public.behavior_events(category, created_at DESC);
GRANT SELECT ON public.behavior_events TO authenticated;
GRANT ALL ON public.behavior_events TO service_role;
ALTER TABLE public.behavior_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read behavior events" ON public.behavior_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- 3. Behavior alerts (aggregated open triage)
CREATE TABLE public.behavior_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  category text NOT NULL,
  event_type text NOT NULL,
  status text NOT NULL DEFAULT 'open', -- open|reviewing|dismissed|actioned
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  occurrences int NOT NULL DEFAULT 1,
  notes text,
  resolved_by uuid,
  resolved_at timestamptz,
  UNIQUE (user_id, category, event_type, status)
);
CREATE INDEX behavior_alerts_status_idx ON public.behavior_alerts(status, last_seen_at DESC);
GRANT SELECT, UPDATE ON public.behavior_alerts TO authenticated;
GRANT ALL ON public.behavior_alerts TO service_role;
ALTER TABLE public.behavior_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage behavior alerts" ON public.behavior_alerts
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins update behavior alerts" ON public.behavior_alerts
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 4. User risk scores
CREATE TABLE public.user_risk_scores (
  user_id uuid PRIMARY KEY,
  score int NOT NULL DEFAULT 0,
  risk_level text NOT NULL DEFAULT 'low',
  alerts_count int NOT NULL DEFAULT 0,
  last_event_at timestamptz,
  under_review boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_risk_scores TO authenticated;
GRANT ALL ON public.user_risk_scores TO service_role;
ALTER TABLE public.user_risk_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read risk scores" ON public.user_risk_scores
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR auth.uid() = user_id);

-- ============ Core scoring helper ============
CREATE OR REPLACE FUNCTION public.bump_risk_score(_user_id uuid, _delta int, _mark_review boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_score int;
  v_level text;
BEGIN
  IF _user_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.user_risk_scores(user_id, score, alerts_count, last_event_at, under_review)
    VALUES (_user_id, LEAST(100, GREATEST(0,_delta)), 1, now(), _mark_review)
  ON CONFLICT (user_id) DO UPDATE
    SET score = LEAST(100, public.user_risk_scores.score + _delta),
        alerts_count = public.user_risk_scores.alerts_count + 1,
        last_event_at = now(),
        under_review = public.user_risk_scores.under_review OR _mark_review,
        updated_at = now();

  SELECT score INTO v_score FROM public.user_risk_scores WHERE user_id = _user_id;
  v_level := CASE WHEN v_score >= 60 THEN 'high'
                  WHEN v_score >= 30 THEN 'medium'
                  ELSE 'low' END;
  UPDATE public.user_risk_scores SET risk_level = v_level WHERE user_id = _user_id;
END; $$;

CREATE OR REPLACE FUNCTION public.record_behavior_event(
  _user_id uuid, _category text, _event_type text, _severity text,
  _score_delta int, _description text, _metadata jsonb DEFAULT '{}'::jsonb,
  _mark_review boolean DEFAULT false
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.behavior_events(user_id, category, event_type, severity, score_delta, description, metadata)
    VALUES (_user_id, _category, _event_type, _severity, _score_delta, _description, COALESCE(_metadata,'{}'::jsonb))
    RETURNING id INTO v_id;

  INSERT INTO public.behavior_alerts(user_id, category, event_type, status, occurrences)
    VALUES (_user_id, _category, _event_type, 'open', 1)
  ON CONFLICT (user_id, category, event_type, status) DO UPDATE
    SET occurrences = public.behavior_alerts.occurrences + 1,
        last_seen_at = now();

  PERFORM public.bump_risk_score(_user_id, _score_delta, _mark_review);

  -- Audit trail entry
  BEGIN
    PERFORM public.append_audit_log(jsonb_build_object(
      'user_id', _user_id,
      'category', 'fraud',
      'action', _event_type,
      'description', _description,
      'entity_type', 'behavior_event',
      'entity_id', v_id::text,
      'success', true,
      'metadata', jsonb_build_object(
        'category', _category, 'severity', _severity, 'score_delta', _score_delta
      ) || COALESCE(_metadata,'{}'::jsonb)
    ));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN v_id;
END; $$;

-- ============ Login lockout RPCs ============
CREATE OR REPLACE FUNCTION public.check_login_lock(_email text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_row public.login_lockouts%ROWTYPE;
BEGIN
  IF _email IS NULL OR _email = '' THEN
    RETURN jsonb_build_object('locked', false);
  END IF;
  SELECT * INTO v_row FROM public.login_lockouts WHERE identifier = lower(_email);
  IF NOT FOUND OR v_row.locked_until IS NULL OR v_row.locked_until <= now() THEN
    RETURN jsonb_build_object('locked', false);
  END IF;
  RETURN jsonb_build_object(
    'locked', true,
    'locked_until', v_row.locked_until,
    'seconds_remaining', GREATEST(0, EXTRACT(EPOCH FROM (v_row.locked_until - now()))::int)
  );
END; $$;

CREATE OR REPLACE FUNCTION public.register_login_attempt(_email text, _success boolean, _user_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.login_lockouts%ROWTYPE;
  v_ident text := lower(COALESCE(_email,''));
  v_lock_minutes int;
  v_max_minutes int := 1440; -- 24h cap
BEGIN
  IF v_ident = '' THEN RETURN jsonb_build_object('locked', false); END IF;

  SELECT * INTO v_row FROM public.login_lockouts WHERE identifier = v_ident;

  IF _success THEN
    IF FOUND THEN
      UPDATE public.login_lockouts
        SET failed_count = 0, window_started_at = NULL, lock_level = 0,
            locked_until = NULL, user_id = COALESCE(_user_id, user_id), updated_at = now()
      WHERE identifier = v_ident;
    END IF;
    RETURN jsonb_build_object('locked', false);
  END IF;

  -- Failure path
  IF NOT FOUND THEN
    INSERT INTO public.login_lockouts(identifier, user_id, failed_count, window_started_at)
      VALUES (v_ident, _user_id, 1, now());
    RETURN jsonb_build_object('locked', false, 'failed_count', 1);
  END IF;

  -- Rolling 8-min window
  IF v_row.window_started_at IS NULL OR v_row.window_started_at < now() - interval '8 minutes' THEN
    UPDATE public.login_lockouts
      SET failed_count = 1, window_started_at = now(),
          user_id = COALESCE(_user_id, user_id), updated_at = now()
      WHERE identifier = v_ident;
    RETURN jsonb_build_object('locked', false, 'failed_count', 1);
  END IF;

  UPDATE public.login_lockouts
    SET failed_count = failed_count + 1,
        user_id = COALESCE(_user_id, user_id),
        updated_at = now()
    WHERE identifier = v_ident
    RETURNING * INTO v_row;

  IF v_row.failed_count >= 10 THEN
    v_lock_minutes := LEAST(v_max_minutes, 10 * POWER(2, v_row.lock_level)::int);
    UPDATE public.login_lockouts
      SET lock_level = LEAST(v_row.lock_level + 1, 8),
          locked_until = now() + make_interval(mins => v_lock_minutes),
          failed_count = 0,
          window_started_at = NULL,
          updated_at = now()
      WHERE identifier = v_ident
      RETURNING * INTO v_row;

    PERFORM public.record_behavior_event(
      COALESCE(_user_id, v_row.user_id),
      'login', 'login_lockout', 'medium', 10,
      format('Account locked for %s minutes after 10 failed login attempts', v_lock_minutes),
      jsonb_build_object('email', v_ident, 'lock_level', v_row.lock_level,
                         'lock_minutes', v_lock_minutes, 'locked_until', v_row.locked_until)
    );

    RETURN jsonb_build_object(
      'locked', true,
      'locked_until', v_row.locked_until,
      'seconds_remaining', GREATEST(0, EXTRACT(EPOCH FROM (v_row.locked_until - now()))::int)
    );
  END IF;

  RETURN jsonb_build_object('locked', false, 'failed_count', v_row.failed_count);
END; $$;

-- ============ Extend MPIN verification with progressive lockout ============
CREATE OR REPLACE FUNCTION public.verify_mpin(_mpin text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.user_mpins%ROWTYPE;
  v_lock public.mpin_lockouts%ROWTYPE;
  v_attempts integer;
  v_lock_minutes int;
  v_max_minutes int := 1440;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- Progressive lockout check
  SELECT * INTO v_lock FROM public.mpin_lockouts WHERE user_id = v_uid;
  IF FOUND AND v_lock.locked_until IS NOT NULL AND v_lock.locked_until > now() THEN
    RETURN jsonb_build_object(
      'ok', false, 'has_mpin', true, 'locked', true, 'attempts_left', 0,
      'seconds_remaining', GREATEST(0, EXTRACT(EPOCH FROM (v_lock.locked_until - now()))::int)
    );
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
    -- Reset progressive lock
    UPDATE public.mpin_lockouts
      SET failed_count = 0, window_started_at = NULL, lock_level = 0,
          locked_until = NULL, updated_at = now()
      WHERE user_id = v_uid;
    RETURN jsonb_build_object('ok', true, 'has_mpin', true, 'locked', false, 'attempts_left', 5);
  END IF;

  -- Inner attempts counter (kept as before)
  v_attempts := v_row.failed_attempts + 1;
  UPDATE public.user_mpins
    SET failed_attempts = v_attempts,
        locked_until = CASE WHEN v_attempts >= 5 THEN now() + interval '15 minutes' ELSE NULL END,
        updated_at = now()
    WHERE user_id = v_uid;

  -- Progressive rolling-window tracker
  IF NOT FOUND OR v_lock.user_id IS NULL THEN
    INSERT INTO public.mpin_lockouts(user_id, failed_count, window_started_at)
      VALUES (v_uid, 1, now())
    ON CONFLICT (user_id) DO UPDATE
      SET failed_count = 1, window_started_at = now(), updated_at = now();
  ELSIF v_lock.window_started_at IS NULL OR v_lock.window_started_at < now() - interval '8 minutes' THEN
    UPDATE public.mpin_lockouts
      SET failed_count = 1, window_started_at = now(), updated_at = now()
      WHERE user_id = v_uid;
  ELSE
    UPDATE public.mpin_lockouts
      SET failed_count = failed_count + 1, updated_at = now()
      WHERE user_id = v_uid
      RETURNING * INTO v_lock;

    IF v_lock.failed_count >= 10 THEN
      v_lock_minutes := LEAST(v_max_minutes, 10 * POWER(2, v_lock.lock_level)::int);
      UPDATE public.mpin_lockouts
        SET lock_level = LEAST(v_lock.lock_level + 1, 8),
            locked_until = now() + make_interval(mins => v_lock_minutes),
            failed_count = 0,
            window_started_at = NULL,
            updated_at = now()
        WHERE user_id = v_uid;

      PERFORM public.record_behavior_event(
        v_uid, 'mpin', 'mpin_lockout', 'medium', 15,
        format('MPIN locked for %s minutes after 10 failed attempts', v_lock_minutes),
        jsonb_build_object('lock_minutes', v_lock_minutes)
      );

      RETURN jsonb_build_object(
        'ok', false, 'has_mpin', true, 'locked', true, 'attempts_left', 0,
        'seconds_remaining', v_lock_minutes * 60
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', false,
    'has_mpin', true,
    'locked', v_attempts >= 5,
    'attempts_left', GREATEST(0, 5 - v_attempts)
  );
END;
$function$;

-- ============ Trigger-based detection ============

-- Listings: >20 in 10 minutes
CREATE OR REPLACE FUNCTION public.detect_listing_abuse()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count int;
BEGIN
  SELECT count(*) INTO v_count FROM public.listings
    WHERE seller_id = NEW.seller_id AND created_at > now() - interval '10 minutes';
  IF v_count > 20 THEN
    PERFORM public.record_behavior_event(
      NEW.seller_id, 'listings', 'listing_burst', 'high', 20,
      format('%s listings created in 10 minutes', v_count),
      jsonb_build_object('count_10m', v_count), true
    );
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_detect_listing_abuse
  AFTER INSERT ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.detect_listing_abuse();

-- Messages: >50 in 60 seconds; identical body to many recipients
CREATE OR REPLACE FUNCTION public.detect_messaging_abuse()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
  v_distinct_recipients int;
  v_dup_targets int;
BEGIN
  IF NEW.sender_id IS NULL THEN RETURN NEW; END IF;

  SELECT count(*) INTO v_count FROM public.messages
    WHERE sender_id = NEW.sender_id AND created_at > now() - interval '1 minute';
  IF v_count > 50 THEN
    PERFORM public.record_behavior_event(
      NEW.sender_id, 'messaging', 'spam_burst', 'high', 20,
      format('%s messages sent in one minute', v_count),
      jsonb_build_object('count_1m', v_count), true
    );
  END IF;

  IF NEW.body IS NOT NULL AND length(NEW.body) > 4 THEN
    SELECT count(DISTINCT t.id) INTO v_dup_targets
      FROM public.messages m
      JOIN public.threads t ON t.id = m.thread_id
     WHERE m.sender_id = NEW.sender_id
       AND m.body = NEW.body
       AND m.created_at > now() - interval '10 minutes';
    IF v_dup_targets >= 5 THEN
      PERFORM public.record_behavior_event(
        NEW.sender_id, 'messaging', 'duplicate_broadcast', 'medium', 20,
        format('Same message sent across %s threads', v_dup_targets),
        jsonb_build_object('threads', v_dup_targets), true
      );
    END IF;
  END IF;

  RETURN NEW;
END; $$;
CREATE TRIGGER trg_detect_messaging_abuse
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.detect_messaging_abuse();

-- Reports: >10/hr or >20/24h
CREATE OR REPLACE FUNCTION public.detect_reporting_abuse()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_hour int; v_day int;
BEGIN
  SELECT count(*) INTO v_hour FROM public.review_reports
    WHERE reporter_id = NEW.reporter_id AND created_at > now() - interval '1 hour';
  SELECT count(*) INTO v_day FROM public.review_reports
    WHERE reporter_id = NEW.reporter_id AND created_at > now() - interval '24 hours';
  IF v_hour > 10 OR v_day > 20 THEN
    PERFORM public.record_behavior_event(
      NEW.reporter_id, 'reporting', 'excessive_reporting', 'high', 20,
      format('Reports 1h=%s 24h=%s', v_hour, v_day),
      jsonb_build_object('hour', v_hour, 'day', v_day), true
    );
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_detect_reporting_abuse
  AFTER INSERT ON public.review_reports
  FOR EACH ROW EXECUTE FUNCTION public.detect_reporting_abuse();

-- Transactions: bursts and cancellation floods
CREATE OR REPLACE FUNCTION public.detect_transaction_abuse()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_burst int; v_cancels int;
BEGIN
  SELECT count(*) INTO v_burst FROM public.transactions
    WHERE (buyer_id = NEW.buyer_id OR seller_id = NEW.seller_id)
      AND created_at > now() - interval '10 minutes';
  IF v_burst > 15 THEN
    PERFORM public.record_behavior_event(
      NEW.buyer_id, 'transactions', 'transaction_burst', 'high', 25,
      format('%s transactions in 10 minutes', v_burst),
      jsonb_build_object('count_10m', v_burst), true
    );
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
    SELECT count(*) INTO v_cancels FROM public.transactions
      WHERE buyer_id = NEW.buyer_id AND status = 'cancelled'
        AND updated_at > now() - interval '24 hours';
    IF v_cancels >= 5 THEN
      PERFORM public.record_behavior_event(
        NEW.buyer_id, 'transactions', 'excessive_cancellations', 'medium', 25,
        format('%s cancelled transactions in 24 hours', v_cancels),
        jsonb_build_object('cancels_24h', v_cancels), true
      );
    END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_detect_transaction_insert
  AFTER INSERT ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.detect_transaction_abuse();
CREATE TRIGGER trg_detect_transaction_update
  AFTER UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.detect_transaction_abuse();

-- Grants for RPCs
GRANT EXECUTE ON FUNCTION public.check_login_lock(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_login_attempt(text, boolean, uuid) TO anon, authenticated;
