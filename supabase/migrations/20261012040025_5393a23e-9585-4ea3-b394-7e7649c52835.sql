CREATE OR REPLACE FUNCTION public.audit_row_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := NULLIF(current_setting('request.jwt.claim.sub', true),'')::uuid;
  v_action text; v_category text := TG_ARGV[0]; v_entity_type text := TG_TABLE_NAME;
  v_entity_id text; v_actor uuid; v_meta jsonb; v_new jsonb; v_old jsonb;
BEGIN
  v_action := lower(TG_TABLE_NAME) || '_' || lower(TG_OP);
  IF TG_OP <> 'INSERT' THEN v_old := to_jsonb(OLD) - 'images'; END IF;
  IF TG_OP <> 'DELETE' THEN v_new := to_jsonb(NEW) - 'images'; END IF;
  IF TG_OP = 'DELETE' THEN
    v_entity_id := v_old->>'id'; v_meta := jsonb_build_object('old', v_old);
  ELSIF TG_OP = 'UPDATE' THEN
    v_entity_id := v_new->>'id';
    v_meta := jsonb_build_object('changed', (SELECT jsonb_object_agg(key, value) FROM jsonb_each(v_new) WHERE v_new->key IS DISTINCT FROM v_old->key));
  ELSE
    v_entity_id := v_new->>'id'; v_meta := jsonb_build_object('new', v_new);
  END IF;
  v_actor := v_uid;
  IF v_actor IS NULL THEN
    BEGIN v_actor := (COALESCE(v_new, v_old)->>'user_id')::uuid;
    EXCEPTION WHEN OTHERS THEN v_actor := NULL; END;
  END IF;
  PERFORM public.append_audit_log(jsonb_build_object('user_id', v_actor,'category', v_category,'action', v_action,'entity_type', v_entity_type,'entity_id', v_entity_id,'success', true,'metadata', v_meta));
  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RETURN COALESCE(NEW, OLD);
END; $$;
REVOKE ALL ON FUNCTION public.audit_row_change() FROM PUBLIC;