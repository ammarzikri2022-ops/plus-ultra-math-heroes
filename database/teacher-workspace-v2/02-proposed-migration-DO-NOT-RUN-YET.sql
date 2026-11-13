-- REVIEW ONLY. Do not run on production before reviewing 01-audit.sql.
-- Single authorized teacher: db291d38-1c27-41b4-9a68-6bcff1773838.
-- This is an Auth user ID, not an email or a client-supplied parameter.
-- One-time migration; no DROP/RECREATE of existing tables, no role promotion.
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '90s';
-- After reviewing every existing policy and callable SECURITY DEFINER body,
-- paste the fingerprint from 01-audit.sql here. Never approve an unread digest.
SET LOCAL ua.reviewed_security_fingerprint = '';
DO $$
DECLARE r record; required text; actual text;
BEGIN
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls)) THEN RAISE EXCEPTION 'Trusted migration owner must bypass RLS for private authorization helpers'; END IF;
 IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Run reviewed migration as postgres (SQL Editor), not through the public API'; END IF;
 IF to_regnamespace('ua_teacher_private') IS NOT NULL THEN RAISE EXCEPTION 'Workspace schema already exists; inspect before applying or rerunning'; END IF;
 IF NOT EXISTS(
   SELECT FROM auth.users u JOIN public.profiles p ON p.id=u.id
   WHERE u.id='db291d38-1c27-41b4-9a68-6bcff1773838'::uuid
     AND lower(u.email)='ammarzikri2020@gmail.com'
     AND u.email_confirmed_at IS NOT NULL AND p.role::text='teacher'
 ) THEN RAISE EXCEPTION 'Authorized teacher UUID, confirmed Auth email, and teacher profile must match before activation'; END IF;
 FOR r IN SELECT * FROM (VALUES
 ('profiles','id','uuid'),('profiles','class_id','bigint'),
 ('classes','id','bigint'),('classes','name','text'),('classes','year_level','integer'),
 ('teacher_classes','teacher_id','uuid'),('teacher_classes','class_id','bigint'),
 ('attempts','student_id','uuid')) v(t,c,typ) LOOP
  -- attempts/answers id mapping may differ: stop instead of casting/guessing.
  IF NOT EXISTS(SELECT FROM information_schema.columns WHERE table_schema='public' AND table_name=r.t AND column_name=r.c AND data_type=r.typ) THEN RAISE EXCEPTION 'Mapping required for %.%: expected %; transaction not applied',r.t,r.c,r.typ; END IF;
 END LOOP;
 IF NOT EXISTS(SELECT FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='role') THEN RAISE EXCEPTION 'profiles.role missing'; END IF;
 IF NOT EXISTS(SELECT FROM information_schema.columns WHERE table_schema='public' AND table_name='attempts' AND column_name='id') OR NOT EXISTS(SELECT FROM information_schema.columns WHERE table_schema='public' AND table_name='answers' AND column_name='attempt_id') THEN RAISE EXCEPTION 'Expected attempts.id and answers.attempt_id relationship'; END IF;
 IF EXISTS(SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('ua_register_teacher_workspace','ua_teacher_workspace_context','ua_teacher_list_classes','ua_teacher_create_class','ua_teacher_workspace_records')) THEN RAISE EXCEPTION 'Workspace RPC already exists; inspect signatures and definitions before applying'; END IF;
 IF NOT EXISTS(SELECT FROM pg_constraint WHERE conrelid='public.classes'::regclass AND contype='p' AND conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='public.classes'::regclass AND attname='id')]) THEN RAISE EXCEPTION 'Expected classes primary key on id'; END IF;
 SELECT string_agg(table_name||'.'||column_name,', ') INTO required FROM information_schema.columns WHERE table_schema='public' AND table_name IN('classes','teacher_classes') AND is_nullable='NO' AND column_default IS NULL AND is_identity='NO' AND is_generated='NEVER' AND NOT ((table_name='classes' AND column_name IN('id','name')) OR(table_name='teacher_classes' AND column_name IN('teacher_id','class_id')));
 IF required IS NOT NULL THEN RAISE EXCEPTION 'Required insert mapping missing: %',required; END IF;
 IF EXISTS(SELECT FROM information_schema.columns WHERE table_schema='public' AND table_name='classes' AND column_name='id' AND (column_default IS NOT NULL OR is_identity<>'NO')) THEN RAISE EXCEPTION 'classes.id already has generator; review instead of replacing'; END IF;
 IF NOT EXISTS(SELECT FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid WHERE t.tgrelid='auth.users'::regclass AND NOT t.tgisinternal AND p.proname='create_student_profile') THEN RAISE EXCEPTION 'Expected existing create_student_profile Auth trigger'; END IF;
 FOR r IN SELECT unnest(ARRAY['profiles','classes','teacher_classes','quizzes','attempts','answers']) t LOOP
  IF NOT EXISTS(SELECT FROM pg_class WHERE oid=to_regclass('public.'||r.t) AND relrowsecurity) THEN RAISE EXCEPTION 'RLS must already be enabled on public.%',r.t; END IF;
  IF NOT has_table_privilege('authenticated','public.'||r.t,'SELECT') THEN RAISE EXCEPTION 'authenticated SELECT grant missing on public.%',r.t; END IF;
 END LOOP;
 IF to_regclass('public.student_reflections') IS NOT NULL AND NOT EXISTS(SELECT FROM information_schema.columns WHERE table_schema='public' AND table_name='student_reflections' AND column_name='student_id' AND data_type='uuid') THEN RAISE EXCEPTION 'Map student_reflections.student_id before migration'; END IF;
 IF to_regclass('public.student_reflections') IS NOT NULL AND NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.student_reflections'::regclass) THEN RAISE EXCEPTION 'student_reflections must have RLS enabled'; END IF;
 IF to_regclass('public.student_reflections') IS NOT NULL AND NOT has_table_privilege('authenticated','public.student_reflections','SELECT') THEN RAISE EXCEPTION 'authenticated SELECT grant missing on public.student_reflections'; END IF;
 SELECT md5(coalesce(string_agg(v,E'\n' ORDER BY v),'')) INTO actual FROM (
  SELECT 'POLICY:'||schemaname||'.'||tablename||':'||policyname||':'||permissive||':'||roles::text||':'||cmd||':'||coalesce(qual,'')||':'||coalesce(with_check,'') v FROM pg_policies WHERE schemaname='public'
  UNION ALL SELECT 'FUNCTION:'||p.oid::regprocedure::text||':'||pg_get_functiondef(p.oid)||':'||coalesce(p.proacl::text,'DEFAULT PUBLIC EXECUTE') FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f' AND p.prosecdef
 ) audit;
 IF current_setting('ua.reviewed_security_fingerprint',true) IS DISTINCT FROM actual THEN RAISE EXCEPTION 'Review required: policy/SECURITY DEFINER fingerprint is %. Match reviewed audit before activation',actual; END IF;
END $$;

-- Serialize initialisation against existing writers. No ID or record is changed.
LOCK TABLE public.classes IN ACCESS EXCLUSIVE MODE;
CREATE SCHEMA ua_teacher_private;
REVOKE ALL ON SCHEMA ua_teacher_private FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA ua_teacher_private TO authenticated;
-- Transactional allocator: unlike setval(), a rejected REST insert cannot
-- permanently advance the generator to bigint maximum before RLS rejects it.
CREATE TABLE ua_teacher_private.class_id_counter(singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),last_id bigint NOT NULL CHECK(last_id>=0));
INSERT INTO ua_teacher_private.class_id_counter(singleton,last_id) SELECT true,greatest(coalesce(max(id),0),0) FROM public.classes;
ALTER TABLE ua_teacher_private.class_id_counter ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ua_teacher_private.class_id_counter FROM PUBLIC,anon,authenticated;
CREATE FUNCTION ua_teacher_private.allocate_class_id() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE previous bigint;
BEGIN
 -- All insert paths, including legacy explicit IDs and ID updates, serialize
 -- on this one row. A failed outer INSERT rolls back the counter update too.
 SELECT last_id INTO STRICT previous FROM ua_teacher_private.class_id_counter WHERE singleton FOR UPDATE;
 IF TG_OP='INSERT' AND NEW.id IS NULL THEN
  IF previous=9223372036854775807 THEN RAISE EXCEPTION 'bigint class ID space exhausted'; END IF;
  NEW.id:=previous+1;
 END IF;
 IF NEW.id>previous THEN UPDATE ua_teacher_private.class_id_counter SET last_id=NEW.id WHERE singleton; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER ua_workspace_class_id BEFORE INSERT OR UPDATE OF id ON public.classes FOR EACH ROW EXECUTE FUNCTION ua_teacher_private.allocate_class_id();

CREATE TABLE ua_teacher_private.workspaces(teacher_id uuid PRIMARY KEY REFERENCES auth.users(id),created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE ua_teacher_private.owned_classes(class_id bigint PRIMARY KEY REFERENCES public.classes(id),teacher_id uuid NOT NULL REFERENCES ua_teacher_private.workspaces(teacher_id),created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE ua_teacher_private.class_grants(class_id bigint NOT NULL REFERENCES ua_teacher_private.owned_classes(class_id),teacher_id uuid NOT NULL REFERENCES ua_teacher_private.workspaces(teacher_id),granted_by uuid NOT NULL REFERENCES auth.users(id),created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(class_id,teacher_id));
CREATE INDEX ua_workspace_owner_idx ON ua_teacher_private.owned_classes(teacher_id);
CREATE INDEX ua_workspace_grantee_idx ON ua_teacher_private.class_grants(teacher_id);
ALTER TABLE ua_teacher_private.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE ua_teacher_private.owned_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ua_teacher_private.class_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA ua_teacher_private FROM PUBLIC,anon,authenticated;

CREATE FUNCTION ua_teacher_private.is_member() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() = 'db291d38-1c27-41b4-9a68-6bcff1773838'::uuid
 AND EXISTS(SELECT FROM ua_teacher_private.workspaces WHERE teacher_id=auth.uid());
$$;
CREATE FUNCTION ua_teacher_private.is_active() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT ua_teacher_private.is_member()
 AND EXISTS(SELECT FROM public.profiles WHERE id=auth.uid() AND role::text='teacher')
 AND EXISTS(SELECT FROM auth.users WHERE id=auth.uid() AND email_confirmed_at IS NOT NULL);
$$;
CREATE FUNCTION ua_teacher_private.owns_class(cid bigint) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT FROM ua_teacher_private.owned_classes WHERE class_id=cid AND teacher_id=auth.uid());
$$;
CREATE FUNCTION ua_teacher_private.can_class(cid bigint) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT ua_teacher_private.is_active() AND cid IS NOT NULL AND (
 EXISTS(SELECT FROM ua_teacher_private.owned_classes WHERE class_id=cid AND teacher_id=auth.uid()) OR
 EXISTS(SELECT FROM ua_teacher_private.class_grants WHERE class_id=cid AND teacher_id=auth.uid()) OR
 EXISTS(SELECT FROM public.teacher_classes tc JOIN public.profiles p ON p.id=tc.teacher_id WHERE tc.teacher_id=auth.uid() AND tc.class_id=cid AND p.role::text='teacher'));
$$;
CREATE FUNCTION ua_teacher_private.can_student(sid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT FROM public.profiles p WHERE p.id=sid AND p.role::text='student' AND ua_teacher_private.can_class(p.class_id));
$$;
-- No grading/quiz ownership inference: an attempt belongs to its pupil.
CREATE FUNCTION ua_teacher_private.row_readable(tbl text,r jsonb) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE linked jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RETURN false; END IF;
 IF tbl='profiles' THEN RETURN r->>'id'=auth.uid()::text OR (r->>'role'='student' AND ua_teacher_private.can_student((r->>'id')::uuid)); END IF;
 IF tbl='classes' THEN RETURN ua_teacher_private.can_class((r->>'id')::bigint); END IF;
 IF tbl='teacher_classes' THEN RETURN r->>'teacher_id'=auth.uid()::text AND ua_teacher_private.can_class((r->>'class_id')::bigint); END IF;
 IF tbl IN('attempts','student_reflections') THEN RETURN coalesce(r->>'student_id'=auth.uid()::text OR ua_teacher_private.can_student((r->>'student_id')::uuid),false); END IF;
 IF tbl='answers' THEN
  SELECT to_jsonb(a) INTO linked FROM public.attempts a WHERE a.id::text=r->>'attempt_id';
  RETURN coalesce(ua_teacher_private.row_readable('attempts',linked),false);
 END IF;
 RETURN false;
END $$;
CREATE FUNCTION ua_teacher_private.row_self(tbl text,r jsonb) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE sid uuid;
BEGIN
 IF auth.uid() IS NULL THEN RETURN false; END IF;
 IF tbl='profiles' THEN RETURN r->>'id'=auth.uid()::text; END IF;
 IF tbl IN('attempts','student_reflections') THEN RETURN coalesce(r->>'student_id'=auth.uid()::text,false); END IF;
 IF tbl='answers' THEN SELECT student_id INTO sid FROM public.attempts WHERE id::text=r->>'attempt_id'; RETURN coalesce(sid=auth.uid(),false); END IF;
 RETURN false;
END $$;
-- Workspace-scoped permissive SELECT only; intersected with ALL existing
-- restrictive policies and the new ceiling. No new write grants/policies.
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['profiles','classes','teacher_classes','attempts','answers','student_reflections'] LOOP
  IF to_regclass('public.'||t) IS NOT NULL THEN
   EXECUTE format('CREATE POLICY ua_ws_select ON public.%I FOR SELECT TO authenticated USING (ua_teacher_private.is_member() AND ua_teacher_private.row_readable(%L,to_jsonb(%I)))',t,t,t);
   EXECUTE format('CREATE POLICY ua_ws_read_ceiling ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated USING (NOT ua_teacher_private.is_member() OR ua_teacher_private.row_readable(%L,to_jsonb(%I)))',t,t,t);
   EXECUTE format('CREATE POLICY ua_ws_insert_ceiling ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (NOT ua_teacher_private.is_member() OR ua_teacher_private.row_self(%L,to_jsonb(%I)))',t,t,t);
   EXECUTE format('CREATE POLICY ua_ws_update_ceiling ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (NOT ua_teacher_private.is_member() OR ua_teacher_private.row_self(%L,to_jsonb(%I))) WITH CHECK (NOT ua_teacher_private.is_member() OR ua_teacher_private.row_self(%L,to_jsonb(%I)))',t,t,t,t,t);
   -- Own pupil workflow remains subject to its original policies; no new rights.
   EXECUTE format('CREATE POLICY ua_ws_delete_ceiling ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (NOT ua_teacher_private.is_member() OR ua_teacher_private.row_self(%L,to_jsonb(%I)))',t,t,t);
  END IF;
 END LOOP;
END $$;
-- quizzes intentionally untouched: preserve the original question/content flow.
-- App-facing roles cannot change profile authority even under broad old RLS.
-- Trusted existing SECURITY DEFINER functions must be reviewed by the audit gate.
CREATE FUNCTION ua_teacher_private.protect_profile() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF current_user IN('authenticated','anon') THEN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Profile deletion requires trusted account workflow' USING ERRCODE='42501'; END IF;
  IF TG_OP='INSERT' AND (auth.uid() IS NULL OR NEW.id IS DISTINCT FROM auth.uid() OR NEW.role::text IS DISTINCT FROM 'student' OR NEW.class_id IS NOT NULL) THEN RAISE EXCEPTION 'Profile authority must be assigned by trusted server' USING ERRCODE='42501'; END IF;
  IF TG_OP='UPDATE' AND (NEW.id IS DISTINCT FROM OLD.id OR NEW.role IS DISTINCT FROM OLD.role OR NEW.class_id IS DISTINCT FROM OLD.class_id) THEN RAISE EXCEPTION 'Cannot modify profile identity, role or class' USING ERRCODE='42501'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER ua_workspace_profile_guard BEFORE INSERT OR UPDATE OR DELETE ON public.profiles FOR EACH ROW EXECUTE FUNCTION ua_teacher_private.protect_profile();

-- Every public RPC derives its actor from auth.uid(), never a body teacher_id.
CREATE FUNCTION public.ua_teacher_workspace_context() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE ids jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Auth session required' USING ERRCODE='42501'; END IF;
 IF NOT ua_teacher_private.is_member() THEN RETURN NULL; END IF;
 IF NOT ua_teacher_private.is_active() THEN RAISE EXCEPTION 'Active confirmed workspace required' USING ERRCODE='42501'; END IF;
 SELECT coalesce(jsonb_agg(c.id::text ORDER BY c.id),'[]'::jsonb) INTO ids FROM public.classes c WHERE ua_teacher_private.can_class(c.id);
 RETURN jsonb_build_object('teacher_id',auth.uid(),'scope','owned_classes','class_ids',ids,'version',2);
END $$;
CREATE FUNCTION public.ua_register_teacher_workspace() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS DISTINCT FROM 'db291d38-1c27-41b4-9a68-6bcff1773838'::uuid
 OR NOT EXISTS(SELECT FROM auth.users WHERE id=auth.uid() AND email_confirmed_at IS NOT NULL)
 OR NOT EXISTS(SELECT FROM public.profiles WHERE id=auth.uid() AND role::text='teacher')
 THEN RAISE EXCEPTION 'Authorized confirmed teacher required' USING ERRCODE='42501'; END IF;
 INSERT INTO ua_teacher_private.workspaces(teacher_id) VALUES(auth.uid()) ON CONFLICT DO NOTHING;
 RETURN public.ua_teacher_workspace_context();
END $$;
CREATE FUNCTION public.ua_teacher_list_classes() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT ua_teacher_private.is_active() THEN RAISE EXCEPTION 'Active confirmed workspace required' USING ERRCODE='42501'; END IF;
 RETURN(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) FROM (SELECT c.id::text AS id,c.name,c.year_level,ua_teacher_private.owns_class(c.id) AS is_owner FROM public.classes c WHERE ua_teacher_private.can_class(c.id) ORDER BY c.id) x);
END $$;
CREATE FUNCTION public.ua_teacher_create_class(p_name text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE cid bigint; clean text:=btrim(p_name);
BEGIN
 IF NOT ua_teacher_private.is_active() THEN RAISE EXCEPTION 'Active confirmed workspace required' USING ERRCODE='42501'; END IF;
 IF clean IS NULL OR char_length(clean) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Class name must be 1-100 characters'; END IF;
 PERFORM 1 FROM ua_teacher_private.workspaces WHERE teacher_id=auth.uid() FOR UPDATE;
 IF(SELECT count(*) FROM ua_teacher_private.owned_classes WHERE teacher_id=auth.uid())>=100 THEN RAISE EXCEPTION 'Class limit reached'; END IF;
 INSERT INTO public.classes(name,year_level) VALUES(clean,5) RETURNING id INTO cid;
 INSERT INTO ua_teacher_private.owned_classes(class_id,teacher_id) VALUES(cid,auth.uid());
 INSERT INTO public.teacher_classes(teacher_id,class_id) VALUES(auth.uid(),cid);
 RETURN jsonb_build_object('id',cid::text,'name',clean,'year_level',5,'is_owner',true);
END $$;
-- Reports use invoker rights/RLS. New workspaces NEVER invoke old definer reports.
CREATE FUNCTION public.ua_teacher_workspace_records(p_kind text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF NOT ua_teacher_private.is_active() THEN RAISE EXCEPTION 'Active confirmed workspace required' USING ERRCODE='42501'; END IF;
 IF p_kind='directory' THEN
  SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO result FROM (SELECT p.id AS student_id,p.full_name AS student_name,c.id::text AS class_id,c.name AS class_name,NULL::text AS avatar FROM public.profiles p JOIN public.classes c ON c.id=p.class_id WHERE p.role::text='student' AND p.id<>auth.uid() ORDER BY p.full_name LIMIT 5000) x;
 ELSIF p_kind='report' THEN
  -- Column names beyond the audited core are read as JSON, no fabricated scores.
  SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO result FROM (SELECT p.id AS student_id,p.full_name AS student_name,c.id::text AS class_id,c.name AS class_name,to_jsonb(q)->>'title' AS quiz_title,to_jsonb(a)->'score' AS score,coalesce(to_jsonb(a)->'max_score',to_jsonb(q)->'max_score') AS max_score,to_jsonb(a)->>'submitted_at' AS submitted_at,to_jsonb(a)->'attempt_number' AS attempt_number,(SELECT coalesce(jsonb_agg(to_jsonb(ans)),'[]'::jsonb) FROM public.answers ans WHERE ans.attempt_id::text=a.id::text) AS answers FROM public.attempts a JOIN public.profiles p ON p.id=a.student_id JOIN public.classes c ON c.id=p.class_id LEFT JOIN public.quizzes q ON to_jsonb(q)->>'id'=to_jsonb(a)->>'quiz_id' WHERE p.id<>auth.uid() ORDER BY a.id DESC LIMIT 5000) x;
 ELSIF p_kind='teacher-reflections' THEN
  IF to_regclass('public.student_reflections') IS NULL THEN RAISE EXCEPTION 'Reflection table mapping unavailable'; END IF;
  EXECUTE 'SELECT coalesce(jsonb_agg(to_jsonb(x)),''[]''::jsonb) FROM (SELECT to_jsonb(r)->>''id'' AS id,p.id AS student_id,p.full_name AS student_name,c.id::text AS class_id,c.name AS class_name,to_jsonb(r)->>''emotion'' AS emotion,to_jsonb(r)->>''topic'' AS topic,to_jsonb(r)->''understanding'' AS understanding,to_jsonb(r)->>''reflection'' AS reflection,to_jsonb(r)->''help_requested'' AS help_requested,to_jsonb(r)->>''created_at'' AS created_at FROM public.student_reflections r JOIN public.profiles p ON p.id=r.student_id JOIN public.classes c ON c.id=p.class_id WHERE p.id<>auth.uid() LIMIT 5000) x' INTO result;
 ELSE RAISE EXCEPTION 'Unknown record kind'; END IF;
 RETURN result;
END $$;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA ua_teacher_private FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION ua_teacher_private.is_member(),ua_teacher_private.is_active(),ua_teacher_private.row_readable(text,jsonb),ua_teacher_private.row_self(text,jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.ua_teacher_workspace_context(),public.ua_register_teacher_workspace(),public.ua_teacher_list_classes(),public.ua_teacher_create_class(text),public.ua_teacher_workspace_records(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ua_teacher_workspace_context(),public.ua_register_teacher_workspace(),public.ua_teacher_list_classes(),public.ua_teacher_create_class(text),public.ua_teacher_workspace_records(text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
