-- REVIEW ONLY. Apply ONLY after approved teacher-workspace-v2 migration.
-- Existing six tables/records and original Auth trigger are never recreated.
-- New official website results live in private additive tables, deliberately
-- avoiding guessed INSERT mappings into legacy attempts/answers.
BEGIN;
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='90s';
DO $$ BEGIN
 IF current_user<>'postgres' OR NOT EXISTS(SELECT FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls)) THEN RAISE EXCEPTION 'Reviewed migration owner postgres with BYPASSRLS required'; END IF;
 IF to_regprocedure('public.ua_teacher_workspace_context()') IS NULL OR to_regprocedure('ua_teacher_private.can_class(bigint)') IS NULL OR to_regprocedure('ua_teacher_private.is_active()') IS NULL THEN RAISE EXCEPTION 'Approve/install bigint teacher workspace v2 first'; END IF;
 IF to_regclass('ua_teacher_private.quiz_results') IS NOT NULL THEN RAISE EXCEPTION 'Learning migration already exists; inspect, do not overwrite'; END IF;
 IF NOT EXISTS(SELECT FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='class_id' AND data_type='bigint') THEN RAISE EXCEPTION 'profiles.class_id must match classes.id bigint'; END IF;
END $$;
CREATE TABLE ua_teacher_private.preferences(user_id uuid PRIMARY KEY REFERENCES public.profiles(id),full_name text NOT NULL CHECK(char_length(full_name) BETWEEN 2 AND 100),avatar text NOT NULL CHECK(avatar IN('deku','bakugo','todoroki','red-riot','tokoyami')));
CREATE TABLE ua_teacher_private.enrollments(student_id uuid PRIMARY KEY REFERENCES public.profiles(id),class_id bigint NOT NULL REFERENCES public.classes(id),joined_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE ua_teacher_private.invites(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),class_id bigint NOT NULL REFERENCES public.classes(id),created_by uuid NOT NULL REFERENCES auth.users(id),code_hash bytea UNIQUE NOT NULL,expires_at timestamptz NOT NULL DEFAULT(now()+interval '7 days'),max_uses integer NOT NULL DEFAULT 100 CHECK(max_uses BETWEEN 1 AND 100),uses integer NOT NULL DEFAULT 0 CHECK(uses>=0),revoked boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE ua_teacher_private.quiz_keys(version text PRIMARY KEY,correct jsonb NOT NULL CHECK(jsonb_typeof(correct)='array' AND jsonb_array_length(correct)=10));
-- Exact answer indices of the existing ten Tokoyami questions; zero-based.
INSERT INTO ua_teacher_private.quiz_keys VALUES('tokoyami-5.1.1-v1','[1,1,1,1,2,2,1,1,1,2]');
CREATE TABLE ua_teacher_private.quiz_results(id uuid PRIMARY KEY,student_id uuid NOT NULL REFERENCES public.profiles(id),class_id bigint REFERENCES public.classes(id),student_name text NOT NULL,avatar text NOT NULL,quiz_version text NOT NULL REFERENCES ua_teacher_private.quiz_keys(version),answers jsonb NOT NULL CHECK(jsonb_typeof(answers)='array' AND jsonb_array_length(answers)=10),score integer NOT NULL CHECK(score BETWEEN 0 AND 10),max_score integer NOT NULL DEFAULT 10 CHECK(max_score=10),submitted_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX ua_quiz_student_time ON ua_teacher_private.quiz_results(student_id,submitted_at DESC);
CREATE INDEX ua_quiz_class_time ON ua_teacher_private.quiz_results(class_id,submitted_at DESC);
CREATE TABLE ua_teacher_private.learning_reflections(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),student_id uuid NOT NULL REFERENCES public.profiles(id),class_id bigint REFERENCES public.classes(id),student_name text NOT NULL,avatar text NOT NULL,emotion text NOT NULL CHECK(emotion IN('gembira','yakin','keliru','perlukan_bantuan')),topic text NOT NULL CHECK(topic IN('cm-mm','m-cm','km-m','gabungan')),understanding integer NOT NULL CHECK(understanding BETWEEN 1 AND 5),reflection text NOT NULL CHECK(char_length(reflection) BETWEEN 1 AND 3000),help_requested boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX ua_reflection_student_time ON ua_teacher_private.learning_reflections(student_id,created_at DESC);
CREATE INDEX ua_reflection_class_time ON ua_teacher_private.learning_reflections(class_id,created_at DESC);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['preferences','enrollments','invites','quiz_keys','quiz_results','learning_reflections'] LOOP
  EXECUTE format('ALTER TABLE ua_teacher_private.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON ua_teacher_private.%I FROM PUBLIC,anon,authenticated',t);
 END LOOP;
END $$;

CREATE FUNCTION ua_teacher_private.student_uid() RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT FROM auth.users WHERE id=auth.uid() AND email_confirmed_at IS NOT NULL) OR NOT EXISTS(SELECT FROM public.profiles WHERE id=auth.uid() AND role::text='student') OR ua_teacher_private.is_member() THEN RAISE EXCEPTION 'Confirmed student account required' USING ERRCODE='42501'; END IF;
 RETURN auth.uid();
END $$;
CREATE FUNCTION ua_teacher_private.display_name(uid uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(nullif(btrim(p.full_name),''),prefs.full_name,left(nullif(btrim(u.raw_user_meta_data->>'full_name'),''),100),'Wira Matematik') FROM public.profiles p LEFT JOIN ua_teacher_private.preferences prefs ON prefs.user_id=p.id LEFT JOIN auth.users u ON u.id=p.id WHERE p.id=uid;
$$;
CREATE FUNCTION ua_teacher_private.avatar(uid uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce((SELECT avatar FROM ua_teacher_private.preferences WHERE user_id=uid),(SELECT CASE WHEN raw_user_meta_data->>'hero_avatar' IN('deku','bakugo','todoroki','red-riot','tokoyami') THEN raw_user_meta_data->>'hero_avatar' ELSE 'deku' END FROM auth.users WHERE id=uid),'deku');
$$;
CREATE FUNCTION public.ua_complete_profile(p_name text,p_avatar text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT FROM auth.users WHERE id=auth.uid() AND email_confirmed_at IS NOT NULL) OR NOT EXISTS(SELECT FROM public.profiles WHERE id=auth.uid() AND role::text IN('student','teacher')) THEN RAISE EXCEPTION 'Confirmed active account required' USING ERRCODE='42501'; END IF;
 IF p_name IS NULL OR char_length(btrim(p_name)) NOT BETWEEN 2 AND 100 OR p_avatar IS NULL OR p_avatar NOT IN('deku','bakugo','todoroki','red-riot','tokoyami') THEN RAISE EXCEPTION 'Invalid name/avatar'; END IF;
 INSERT INTO ua_teacher_private.preferences(user_id,full_name,avatar) VALUES(auth.uid(),btrim(p_name),p_avatar) ON CONFLICT(user_id) DO UPDATE SET full_name=excluded.full_name,avatar=excluded.avatar;
 UPDATE public.profiles SET full_name=btrim(p_name) WHERE id=auth.uid();
 RETURN jsonb_build_object('user_id',auth.uid(),'full_name',btrim(p_name),'avatar',p_avatar);
END $$;
CREATE FUNCTION public.ua_account_preferences() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE cid bigint; cname text;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT FROM public.profiles WHERE id=auth.uid() AND role::text IN('student','teacher')) THEN RAISE EXCEPTION 'Active account required' USING ERRCODE='42501'; END IF;
 SELECT class_id INTO cid FROM public.profiles WHERE id=auth.uid(); SELECT name INTO cname FROM public.classes WHERE id=cid;
 RETURN jsonb_build_object('user_id',auth.uid(),'full_name',ua_teacher_private.display_name(auth.uid()),'avatar',ua_teacher_private.avatar(auth.uid()),'class_name',cname);
END $$;
CREATE FUNCTION public.ua_student_context() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE uid uuid:=ua_teacher_private.student_uid(); cid bigint; cname text;
BEGIN
 SELECT class_id INTO cid FROM public.profiles WHERE id=uid;
 SELECT name INTO cname FROM public.classes WHERE id=cid;
 RETURN jsonb_build_object('student_id',uid,'full_name',ua_teacher_private.display_name(uid),'avatar',ua_teacher_private.avatar(uid),'class_id',cid::text,'class_name',cname);
END $$;
CREATE FUNCTION public.ua_teacher_rename_class(p_class_id bigint,p_name text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT ua_teacher_private.is_active() OR NOT ua_teacher_private.owns_class(p_class_id) THEN RAISE EXCEPTION 'Class owner required' USING ERRCODE='42501'; END IF;
 IF p_name IS NULL OR char_length(btrim(p_name)) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Invalid class name'; END IF;
 UPDATE public.classes SET name=btrim(p_name) WHERE id=p_class_id;
 RETURN jsonb_build_object('id',p_class_id::text,'name',btrim(p_name));
END $$;
CREATE FUNCTION public.ua_teacher_create_invite(p_class_id bigint) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE token text; iid uuid; expiry timestamptz;
BEGIN
 IF NOT ua_teacher_private.is_active() OR NOT ua_teacher_private.owns_class(p_class_id) THEN RAISE EXCEPTION 'Class owner required' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.classes WHERE id=p_class_id FOR UPDATE;
 IF(SELECT count(*) FROM ua_teacher_private.invites WHERE class_id=p_class_id AND NOT revoked AND expires_at>now())>=20 THEN RAISE EXCEPTION 'Active invitation limit reached'; END IF;
 token:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
 INSERT INTO ua_teacher_private.invites(class_id,created_by,code_hash) VALUES(p_class_id,auth.uid(),pg_catalog.sha256(pg_catalog.convert_to(token,'UTF8'))) RETURNING id,expires_at INTO iid,expiry;
 RETURN jsonb_build_object('id',iid,'class_id',p_class_id::text,'code',token,'expires_at',expiry,'max_uses',100);
END $$;
CREATE FUNCTION public.ua_teacher_invites(p_class_id bigint) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT ua_teacher_private.is_active() OR NOT ua_teacher_private.owns_class(p_class_id) THEN RAISE EXCEPTION 'Class owner required' USING ERRCODE='42501'; END IF;
 RETURN(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) FROM(SELECT id,uses,max_uses,expires_at,revoked FROM ua_teacher_private.invites WHERE class_id=p_class_id ORDER BY created_at DESC LIMIT 100)x);
END $$;
CREATE FUNCTION public.ua_teacher_revoke_invite(p_class_id bigint,p_invite uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT ua_teacher_private.is_active() OR NOT ua_teacher_private.owns_class(p_class_id) THEN RAISE EXCEPTION 'Class owner required' USING ERRCODE='42501'; END IF;
 UPDATE ua_teacher_private.invites SET revoked=true WHERE id=p_invite AND class_id=p_class_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Invitation unavailable' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('revoked',true);
END $$;
CREATE FUNCTION public.ua_student_join_class(p_code text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE uid uuid:=ua_teacher_private.student_uid(); inv ua_teacher_private.invites%rowtype; old_class bigint;
BEGIN
 IF p_code IS NULL OR p_code!~'^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Invitation invalid or expired' USING ERRCODE='42501'; END IF;
 SELECT * INTO inv FROM ua_teacher_private.invites WHERE code_hash=pg_catalog.sha256(pg_catalog.convert_to(p_code,'UTF8')) FOR UPDATE;
 IF NOT FOUND OR inv.revoked OR inv.expires_at<=now() OR inv.uses>=inv.max_uses THEN RAISE EXCEPTION 'Invitation invalid or expired' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.classes WHERE id=inv.class_id FOR UPDATE;
 SELECT class_id INTO old_class FROM public.profiles WHERE id=uid FOR UPDATE;
 IF old_class=inv.class_id THEN RETURN public.ua_student_context(); END IF;
 IF (SELECT count(*) FROM public.profiles WHERE class_id=inv.class_id)>=1000 THEN RAISE EXCEPTION 'Class student limit reached'; END IF;
 IF old_class IS NOT NULL THEN RAISE EXCEPTION 'Existing class membership must be released by its owner before transfer' USING ERRCODE='42501'; END IF;
 UPDATE public.profiles SET class_id=inv.class_id WHERE id=uid;
 INSERT INTO ua_teacher_private.enrollments(student_id,class_id) VALUES(uid,inv.class_id) ON CONFLICT(student_id) DO UPDATE SET class_id=excluded.class_id,joined_at=now();
 UPDATE ua_teacher_private.invites SET uses=uses+1 WHERE id=inv.id;
 RETURN public.ua_student_context();
END $$;
CREATE FUNCTION public.ua_teacher_class_roster(p_class_id bigint) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT ua_teacher_private.is_active() OR NOT ua_teacher_private.can_class(p_class_id) THEN RAISE EXCEPTION 'Class access denied' USING ERRCODE='42501'; END IF;
 RETURN(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) FROM(SELECT p.id AS student_id,p.class_id::text AS class_id,ua_teacher_private.display_name(p.id) AS student_name,ua_teacher_private.avatar(p.id) AS avatar FROM public.profiles p WHERE p.class_id=p_class_id AND p.role::text='student' AND NOT EXISTS(SELECT FROM ua_teacher_private.workspaces WHERE teacher_id=p.id) ORDER BY p.full_name LIMIT 1000)x);
END $$;
CREATE FUNCTION public.ua_teacher_remove_student(p_class_id bigint,p_student uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT ua_teacher_private.is_active() OR NOT ua_teacher_private.owns_class(p_class_id) THEN RAISE EXCEPTION 'Class owner required' USING ERRCODE='42501'; END IF;
 UPDATE public.profiles SET class_id=NULL WHERE id=p_student AND class_id=p_class_id AND role::text='student';
 IF NOT FOUND THEN RAISE EXCEPTION 'Student not in this class' USING ERRCODE='42501'; END IF;
 DELETE FROM ua_teacher_private.enrollments WHERE student_id=p_student AND class_id=p_class_id;
 RETURN jsonb_build_object('removed',true);
END $$;
CREATE FUNCTION public.ua_submit_quiz(p_submission uuid,p_answers jsonb,p_version text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE uid uuid:=ua_teacher_private.student_uid(); key jsonb; points integer; cid bigint; saved ua_teacher_private.quiz_results%rowtype;
BEGIN
 IF p_submission IS NULL OR jsonb_typeof(p_answers) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid quiz submission'; END IF;
 IF jsonb_array_length(p_answers)<>10 OR EXISTS(SELECT FROM jsonb_array_elements(p_answers)e WHERE jsonb_typeof(e)<>'number' OR e::text!~'^[0-3]$') THEN RAISE EXCEPTION 'Exactly ten answer indices required'; END IF;
 SELECT correct INTO key FROM ua_teacher_private.quiz_keys WHERE version=p_version;
 IF NOT FOUND THEN RAISE EXCEPTION 'Unknown quiz version'; END IF;
 -- Serializes per-pupil quotas and idempotency checks.
 SELECT class_id INTO cid FROM public.profiles WHERE id=uid FOR UPDATE;
 SELECT * INTO saved FROM ua_teacher_private.quiz_results WHERE id=p_submission;
 IF FOUND THEN
  IF saved.student_id<>uid OR saved.answers<>p_answers OR saved.quiz_version<>p_version THEN RAISE EXCEPTION 'Submission identity conflict' USING ERRCODE='42501'; END IF;
 ELSE
  IF(SELECT count(*) FROM ua_teacher_private.quiz_results WHERE student_id=uid AND submitted_at>now()-interval '1 day')>=200 THEN RAISE EXCEPTION 'Daily quiz submission limit reached'; END IF;
  SELECT count(*)::integer INTO points FROM generate_series(0,9)i WHERE p_answers->i=key->i;
  INSERT INTO ua_teacher_private.quiz_results(id,student_id,class_id,student_name,avatar,quiz_version,answers,score) VALUES(p_submission,uid,cid,ua_teacher_private.display_name(uid),ua_teacher_private.avatar(uid),p_version,p_answers,points) RETURNING * INTO saved;
 END IF;
 RETURN jsonb_build_object('id',saved.id,'score',saved.score,'max_score',saved.max_score,'submitted_at',saved.submitted_at,'class_id',saved.class_id::text);
END $$;
CREATE FUNCTION public.ua_student_results() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE uid uuid:=ua_teacher_private.student_uid();
BEGIN
 RETURN(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) FROM(SELECT r.id,r.score,r.max_score,r.quiz_version,r.submitted_at,r.class_id::text AS class_id,c.name AS class_name FROM ua_teacher_private.quiz_results r LEFT JOIN public.classes c ON c.id=r.class_id WHERE r.student_id=uid ORDER BY r.submitted_at DESC,r.id LIMIT 200)x);
END $$;
CREATE FUNCTION public.ua_save_learning_reflection(p_emotion text,p_topic text,p_understanding integer,p_reflection text,p_help_requested boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE uid uuid:=ua_teacher_private.student_uid(); cid bigint; rid uuid; at_time timestamptz;
BEGIN
 IF p_emotion IS NULL OR p_topic IS NULL OR p_understanding IS NULL OR p_reflection IS NULL OR p_emotion NOT IN('gembira','yakin','keliru','perlukan_bantuan') OR p_topic NOT IN('cm-mm','m-cm','km-m','gabungan') OR p_understanding NOT BETWEEN 1 AND 5 OR char_length(btrim(p_reflection)) NOT BETWEEN 1 AND 3000 THEN RAISE EXCEPTION 'Invalid reflection'; END IF;
 SELECT class_id INTO cid FROM public.profiles WHERE id=uid FOR UPDATE;
 IF(SELECT count(*) FROM ua_teacher_private.learning_reflections WHERE student_id=uid AND created_at>now()-interval '1 day')>=200 THEN RAISE EXCEPTION 'Daily reflection limit reached'; END IF;
 INSERT INTO ua_teacher_private.learning_reflections(student_id,class_id,student_name,avatar,emotion,topic,understanding,reflection,help_requested) VALUES(uid,cid,ua_teacher_private.display_name(uid),ua_teacher_private.avatar(uid),p_emotion,p_topic,p_understanding,btrim(p_reflection),coalesce(p_help_requested,false)) RETURNING id,created_at INTO rid,at_time;
 RETURN jsonb_build_object('id',rid,'created_at',at_time);
END $$;
CREATE FUNCTION public.ua_my_learning_reflections() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE uid uuid:=ua_teacher_private.student_uid(); fresh jsonb; old jsonb:='[]'::jsonb;
BEGIN
 SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO fresh FROM(SELECT id::text,emotion,topic,understanding,reflection,help_requested,created_at FROM ua_teacher_private.learning_reflections WHERE student_id=uid ORDER BY created_at DESC LIMIT 200)x;
 IF to_regclass('public.student_reflections') IS NOT NULL THEN
  -- Original table is retained; only this authenticated pupil's own rows.
  EXECUTE 'SELECT coalesce(jsonb_agg(to_jsonb(x)),''[]''::jsonb) FROM(SELECT to_jsonb(r)->>''id'' AS id,to_jsonb(r)->>''emotion'' AS emotion,to_jsonb(r)->>''topic'' AS topic,to_jsonb(r)->''understanding'' AS understanding,to_jsonb(r)->>''reflection'' AS reflection,to_jsonb(r)->''help_requested'' AS help_requested,to_jsonb(r)->>''created_at'' AS created_at FROM public.student_reflections r WHERE r.student_id=$1 LIMIT 200)x' INTO old USING uid;
 END IF;
 RETURN fresh||old;
END $$;
CREATE FUNCTION public.ua_teacher_learning_records(p_kind text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT ua_teacher_private.is_active() THEN RAISE EXCEPTION 'Active teacher workspace required' USING ERRCODE='42501'; END IF;
 IF p_kind='directory' THEN
  RETURN(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) FROM(SELECT p.id AS student_id,ua_teacher_private.display_name(p.id) AS student_name,p.class_id::text AS class_id,c.name AS class_name,ua_teacher_private.avatar(p.id) AS avatar FROM public.profiles p JOIN public.classes c ON c.id=p.class_id WHERE p.role::text='student' AND ua_teacher_private.can_class(p.class_id) AND NOT EXISTS(SELECT FROM ua_teacher_private.workspaces w WHERE w.teacher_id=p.id) ORDER BY c.name,p.full_name LIMIT 5000)x);
 ELSIF p_kind='report' THEN
  RETURN(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) FROM(SELECT r.id::text AS id,r.student_id,r.student_name,r.class_id::text AS class_id,c.name AS class_name,r.avatar,'Quiz Penukaran Unit'::text AS quiz_title,r.score,r.max_score,r.submitted_at,row_number() OVER(PARTITION BY r.student_id,r.quiz_version ORDER BY r.submitted_at,r.id) AS attempt_number,r.answers,'ua-learning-v1'::text AS source FROM ua_teacher_private.quiz_results r JOIN public.classes c ON c.id=r.class_id WHERE ua_teacher_private.can_class(r.class_id) ORDER BY r.submitted_at DESC LIMIT 5000)x);
 ELSIF p_kind='teacher-reflections' THEN
  RETURN(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) FROM(SELECT r.id::text,r.student_id,r.student_name,r.class_id::text AS class_id,c.name AS class_name,r.avatar,r.emotion,r.topic,r.understanding,r.reflection,r.help_requested,r.created_at FROM ua_teacher_private.learning_reflections r JOIN public.classes c ON c.id=r.class_id WHERE ua_teacher_private.can_class(r.class_id) ORDER BY r.created_at DESC LIMIT 5000)x);
 ELSE RAISE EXCEPTION 'Unknown record kind'; END IF;
END $$;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA ua_teacher_private FROM PUBLIC,anon,authenticated;
-- Restore only the original RLS helper grants; the new private helpers remain private.
GRANT EXECUTE ON FUNCTION ua_teacher_private.is_member(),ua_teacher_private.is_active(),ua_teacher_private.row_readable(text,jsonb),ua_teacher_private.row_self(text,jsonb) TO authenticated;
DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN('ua_teacher_invites','ua_account_preferences','ua_complete_profile','ua_student_context','ua_teacher_rename_class','ua_teacher_create_invite','ua_teacher_revoke_invite','ua_student_join_class','ua_teacher_class_roster','ua_teacher_remove_student','ua_submit_quiz','ua_student_results','ua_save_learning_reflection','ua_my_learning_reflections','ua_teacher_learning_records') LOOP
  EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.signature);
 END LOOP;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
