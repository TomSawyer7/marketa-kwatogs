
-- 1. Audit logs table
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seq bigserial UNIQUE NOT NULL,
  "timestamp" timestamptz NOT NULL DEFAULT now(),
  user_id uuid,
  user_role text,
  session_id text,
  correlation_id uuid,
  category text NOT NULL,
  action text NOT NULL,
  description text,
  entity_type text,
  entity_id text,
  ip_address inet,
  device text,
  browser text,
  operating_system text,
  endpoint text,
  http_method text,
  status_code integer,
  success boolean NOT NULL DEFAULT true,
  failure_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  previous_hash text NOT NULL,
  current_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_logs_timestamp_idx ON public.audit_logs ("timestamp" DESC);
CREATE INDEX audit_logs_user_id_idx ON public.audit_logs (user_id, "timestamp" DESC);
CREATE INDEX audit_logs_category_action_idx ON public.audit_logs (category, action);
CREATE INDEX audit_logs_correlation_idx ON public.audit_logs (correlation_id);
CREATE INDEX audit_logs_success_idx ON public.audit_logs (success);
CREATE INDEX audit_logs_metadata_gin ON public.audit_logs USING GIN (metadata);

-- 2. Grants — only service_role writes; admins read via RLS
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.audit_logs_seq_seq TO service_role;

-- 3. RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read audit logs"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- No INSERT/UPDATE/DELETE policies — blocked by default.

-- 4. Immutability guard triggers
CREATE OR REPLACE FUNCTION public.audit_logs_block_modification()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only; % is not permitted', TG_OP;
END;
$$;

CREATE TRIGGER audit_logs_no_update
  BEFORE UPDATE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.audit_logs_block_modification();

CREATE TRIGGER audit_logs_no_delete
  BEFORE DELETE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.audit_logs_block_modification();

-- 5. Canonical JSON helper (deterministic, sorted keys)
CREATE OR REPLACE FUNCTION public.canonical_jsonb(_j jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  WITH RECURSIVE walk AS (
    SELECT _j AS v
  )
  SELECT CASE
    WHEN _j IS NULL THEN 'null'
    WHEN jsonb_typeof(_j) = 'object' THEN
      '{' || COALESCE(string_agg(to_json(k)::text || ':' || public.canonical_jsonb(_j->k), ',' ORDER BY k), '') || '}'
    WHEN jsonb_typeof(_j) = 'array' THEN
      '[' || COALESCE((SELECT string_agg(public.canonical_jsonb(elem), ',') FROM jsonb_array_elements(_j) elem), '') || ']'
    ELSE _j::text
  END
  FROM (SELECT jsonb_object_keys(_j) AS k WHERE jsonb_typeof(_j) = 'object') keys;
$$;

-- Simpler & safer: use jsonb sorted serialization via plpgsql
CREATE OR REPLACE FUNCTION public.canonical_jsonb(_j jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  k text;
  parts text[] := ARRAY[]::text[];
  elem jsonb;
BEGIN
  IF _j IS NULL THEN RETURN 'null'; END IF;
  CASE jsonb_typeof(_j)
    WHEN 'object' THEN
      FOR k IN SELECT jsonb_object_keys(_j) ORDER BY 1 LOOP
        parts := parts || (to_json(k)::text || ':' || public.canonical_jsonb(_j->k));
      END LOOP;
      RETURN '{' || array_to_string(parts, ',') || '}';
    WHEN 'array' THEN
      FOR elem IN SELECT * FROM jsonb_array_elements(_j) LOOP
        parts := parts || public.canonical_jsonb(elem);
      END LOOP;
      RETURN '[' || array_to_string(parts, ',') || ']';
    ELSE
      RETURN _j::text;
  END CASE;
END;
$$;

-- 6. Append function — the only sanctioned write path
CREATE OR REPLACE FUNCTION public.append_audit_log(_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_prev text;
  v_seq bigint;
  v_id uuid := gen_random_uuid();
  v_ts timestamptz := now();
  v_canonical text;
  v_hash text;
  v_row jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('audit_logs_chain'));

  SELECT current_hash INTO v_prev
    FROM public.audit_logs
    ORDER BY seq DESC LIMIT 1;
  IF v_prev IS NULL THEN
    v_prev := repeat('0', 64);
  END IF;

  v_seq := nextval('public.audit_logs_seq_seq');

  v_row := jsonb_build_object(
    'id', v_id,
    'seq', v_seq,
    'timestamp', to_char(v_ts AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'user_id', _payload->'user_id',
    'user_role', _payload->'user_role',
    'session_id', _payload->'session_id',
    'correlation_id', _payload->'correlation_id',
    'category', _payload->'category',
    'action', _payload->'action',
    'description', _payload->'description',
    'entity_type', _payload->'entity_type',
    'entity_id', _payload->'entity_id',
    'ip_address', _payload->'ip_address',
    'device', _payload->'device',
    'browser', _payload->'browser',
    'operating_system', _payload->'operating_system',
    'endpoint', _payload->'endpoint',
    'http_method', _payload->'http_method',
    'status_code', _payload->'status_code',
    'success', COALESCE(_payload->'success', 'true'::jsonb),
    'failure_reason', _payload->'failure_reason',
    'metadata', COALESCE(_payload->'metadata', '{}'::jsonb),
    'previous_hash', to_jsonb(v_prev)
  );

  v_canonical := public.canonical_jsonb(v_row);
  v_hash := encode(extensions.digest(v_canonical, 'sha256'), 'hex');

  INSERT INTO public.audit_logs (
    id, seq, "timestamp", user_id, user_role, session_id, correlation_id,
    category, action, description, entity_type, entity_id,
    ip_address, device, browser, operating_system,
    endpoint, http_method, status_code, success, failure_reason,
    metadata, previous_hash, current_hash
  ) VALUES (
    v_id, v_seq, v_ts,
    NULLIF(_payload->>'user_id','')::uuid,
    _payload->>'user_role',
    _payload->>'session_id',
    NULLIF(_payload->>'correlation_id','')::uuid,
    COALESCE(_payload->>'category','unknown'),
    COALESCE(_payload->>'action','unknown'),
    _payload->>'description',
    _payload->>'entity_type',
    _payload->>'entity_id',
    NULLIF(_payload->>'ip_address','')::inet,
    _payload->>'device',
    _payload->>'browser',
    _payload->>'operating_system',
    _payload->>'endpoint',
    _payload->>'http_method',
    NULLIF(_payload->>'status_code','')::int,
    COALESCE((_payload->>'success')::boolean, true),
    _payload->>'failure_reason',
    COALESCE(_payload->'metadata','{}'::jsonb),
    v_prev,
    v_hash
  );

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.append_audit_log(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.append_audit_log(jsonb) TO service_role;

-- 7. Integrity verification function
CREATE OR REPLACE FUNCTION public.verify_audit_chain(_from_seq bigint DEFAULT NULL, _to_seq bigint DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  r record;
  v_prev text := repeat('0', 64);
  v_expected_seq bigint := 0;
  v_first_broken bigint := NULL;
  v_missing bigint[] := ARRAY[]::bigint[];
  v_broken bigint[] := ARRAY[]::bigint[];
  v_canonical text;
  v_hash text;
  v_row jsonb;
  v_count bigint := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  -- Establish starting previous hash
  IF _from_seq IS NOT NULL AND _from_seq > 1 THEN
    SELECT current_hash INTO v_prev FROM public.audit_logs WHERE seq = _from_seq - 1;
    IF v_prev IS NULL THEN v_prev := repeat('0', 64); END IF;
    v_expected_seq := _from_seq - 1;
  END IF;

  FOR r IN
    SELECT * FROM public.audit_logs
    WHERE (_from_seq IS NULL OR seq >= _from_seq)
      AND (_to_seq   IS NULL OR seq <= _to_seq)
    ORDER BY seq ASC
  LOOP
    v_count := v_count + 1;
    v_expected_seq := v_expected_seq + 1;
    WHILE v_expected_seq < r.seq LOOP
      v_missing := v_missing || v_expected_seq;
      v_expected_seq := v_expected_seq + 1;
    END LOOP;

    v_row := jsonb_build_object(
      'id', to_jsonb(r.id),
      'seq', to_jsonb(r.seq),
      'timestamp', to_jsonb(to_char(r."timestamp" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')),
      'user_id', to_jsonb(r.user_id),
      'user_role', to_jsonb(r.user_role),
      'session_id', to_jsonb(r.session_id),
      'correlation_id', to_jsonb(r.correlation_id),
      'category', to_jsonb(r.category),
      'action', to_jsonb(r.action),
      'description', to_jsonb(r.description),
      'entity_type', to_jsonb(r.entity_type),
      'entity_id', to_jsonb(r.entity_id),
      'ip_address', to_jsonb(host(r.ip_address)),
      'device', to_jsonb(r.device),
      'browser', to_jsonb(r.browser),
      'operating_system', to_jsonb(r.operating_system),
      'endpoint', to_jsonb(r.endpoint),
      'http_method', to_jsonb(r.http_method),
      'status_code', to_jsonb(r.status_code),
      'success', to_jsonb(r.success),
      'failure_reason', to_jsonb(r.failure_reason),
      'metadata', COALESCE(r.metadata, '{}'::jsonb),
      'previous_hash', to_jsonb(r.previous_hash)
    );

    v_canonical := public.canonical_jsonb(v_row);
    v_hash := encode(extensions.digest(v_canonical, 'sha256'), 'hex');

    IF r.previous_hash <> v_prev OR r.current_hash <> v_hash THEN
      v_broken := v_broken || r.seq;
      IF v_first_broken IS NULL THEN v_first_broken := r.seq; END IF;
    END IF;
    v_prev := r.current_hash;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', (array_length(v_broken,1) IS NULL AND array_length(v_missing,1) IS NULL),
    'checked', v_count,
    'first_broken_seq', v_first_broken,
    'broken_seqs', to_jsonb(v_broken),
    'missing_seqs', to_jsonb(v_missing)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.verify_audit_chain(bigint, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_audit_chain(bigint, bigint) TO authenticated;

-- 8. Trigger factory — DB events emit audit logs automatically
CREATE OR REPLACE FUNCTION public.audit_row_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := NULLIF(current_setting('request.jwt.claim.sub', true),'')::uuid;
  v_action text;
  v_category text := TG_ARGV[0];
  v_entity_type text := TG_TABLE_NAME;
  v_entity_id text;
  v_actor uuid;
  v_meta jsonb;
BEGIN
  v_action := lower(TG_TABLE_NAME) || '_' || lower(TG_OP);
  IF TG_OP = 'DELETE' THEN
    v_entity_id := (to_jsonb(OLD)->>'id');
    v_meta := jsonb_build_object('old', to_jsonb(OLD));
  ELSIF TG_OP = 'UPDATE' THEN
    v_entity_id := (to_jsonb(NEW)->>'id');
    v_meta := jsonb_build_object(
      'changed', (SELECT jsonb_object_agg(key, value)
                  FROM jsonb_each(to_jsonb(NEW))
                  WHERE to_jsonb(NEW)->key IS DISTINCT FROM to_jsonb(OLD)->key)
    );
  ELSE
    v_entity_id := (to_jsonb(NEW)->>'id');
    v_meta := jsonb_build_object('new', to_jsonb(NEW));
  END IF;

  -- Best-effort actor
  v_actor := v_uid;
  IF v_actor IS NULL THEN
    BEGIN
      v_actor := (to_jsonb(COALESCE(NEW, OLD))->>'user_id')::uuid;
    EXCEPTION WHEN OTHERS THEN v_actor := NULL; END;
  END IF;

  PERFORM public.append_audit_log(jsonb_build_object(
    'user_id', v_actor,
    'category', v_category,
    'action', v_action,
    'entity_type', v_entity_type,
    'entity_id', v_entity_id,
    'success', true,
    'metadata', v_meta
  ));

  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  -- Never break business writes because of audit failure
  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.audit_row_change() FROM PUBLIC;

-- 9. Wire triggers for key tables
CREATE TRIGGER audit_listings AFTER INSERT OR UPDATE OR DELETE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('marketplace');

CREATE TRIGGER audit_transactions AFTER INSERT OR UPDATE OR DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('marketplace');

CREATE TRIGGER audit_reviews AFTER INSERT OR UPDATE OR DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('trust');

CREATE TRIGGER audit_review_appeals AFTER INSERT OR UPDATE OR DELETE ON public.review_appeals
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('trust');

CREATE TRIGGER audit_verifications AFTER INSERT OR UPDATE OR DELETE ON public.verifications
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('identity');

CREATE TRIGGER audit_profiles AFTER UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('identity');

CREATE TRIGGER audit_user_roles AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('admin');

CREATE TRIGGER audit_account_status AFTER INSERT OR UPDATE OR DELETE ON public.account_status
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('admin');

CREATE TRIGGER audit_account_lifecycle AFTER INSERT OR UPDATE OR DELETE ON public.account_lifecycle
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('account');

CREATE TRIGGER audit_threads AFTER INSERT ON public.threads
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('messaging');

CREATE TRIGGER audit_messages AFTER INSERT OR UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('messaging');
