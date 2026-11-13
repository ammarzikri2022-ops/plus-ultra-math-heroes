-- REVIEW ONLY. Do not run in production without owner approval.
-- Requires approved teacher workspace v2 and learning activation 03.
-- No tables, profiles, class IDs, RLS policies or old results are changed.
BEGIN;
DO $$ BEGIN
 IF to_regprocedure('public.ua_submit_quiz(uuid,jsonb,text)') IS NULL
 OR to_regclass('ua_teacher_private.quiz_keys') IS NULL
 OR to_regclass('ua_teacher_private.quiz_results') IS NULL THEN
 RAISE EXCEPTION 'Install approved learning activation 03 first'; END IF;
 IF NOT EXISTS(SELECT FROM ua_teacher_private.quiz_keys WHERE version='tokoyami-5.1.1-v1' AND correct='[1,1,1,1,2,2,1,1,1,2]'::jsonb) THEN
 RAISE EXCEPTION 'Unexpected Easy answer key; review before continuing'; END IF;
END $$;
INSERT INTO ua_teacher_private.quiz_keys(version,correct) VALUES
 ('tokoyami-5.1.1-medium-v1','[0,2,1,3,0,2,1,3,0,2]'),
 ('tokoyami-5.1.1-hard-v1','[1,3,0,2,1,3,0,2,1,3]')
 ON CONFLICT(version) DO NOTHING;
DO $$ BEGIN
 IF NOT EXISTS(SELECT FROM ua_teacher_private.quiz_keys WHERE version='tokoyami-5.1.1-medium-v1' AND correct='[0,2,1,3,0,2,1,3,0,2]'::jsonb)
 OR NOT EXISTS(SELECT FROM ua_teacher_private.quiz_keys WHERE version='tokoyami-5.1.1-hard-v1' AND correct='[1,3,0,2,1,3,0,2,1,3]'::jsonb) THEN
 RAISE EXCEPTION 'Conflicting level keys; no changes committed'; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.ua_submit_quiz(p_submission uuid,p_answers jsonb,p_version text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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
  IF p_version IN ('tokoyami-5.1.1-medium-v1','tokoyami-5.1.1-hard-v1') AND NOT EXISTS (
   SELECT FROM ua_teacher_private.quiz_results WHERE student_id=uid AND quiz_version='tokoyami-5.1.1-v1' AND score>=6
  ) THEN RAISE EXCEPTION 'Complete Easy with at least 6/10 first' USING ERRCODE='42501'; END IF;
  IF p_version='tokoyami-5.1.1-hard-v1' AND NOT EXISTS (
   SELECT FROM ua_teacher_private.quiz_results WHERE student_id=uid AND quiz_version='tokoyami-5.1.1-medium-v1' AND score>=6
  ) THEN RAISE EXCEPTION 'Complete Medium with at least 6/10 first' USING ERRCODE='42501'; END IF;
  IF(SELECT count(*) FROM ua_teacher_private.quiz_results WHERE student_id=uid AND submitted_at>now()-interval '1 day')>=200 THEN RAISE EXCEPTION 'Daily quiz submission limit reached'; END IF;
  SELECT count(*)::integer INTO points FROM generate_series(0,9)i WHERE p_answers->i=key->i;
  INSERT INTO ua_teacher_private.quiz_results(id,student_id,class_id,student_name,avatar,quiz_version,answers,score) VALUES(p_submission,uid,cid,ua_teacher_private.display_name(uid),ua_teacher_private.avatar(uid),p_version,p_answers,points) RETURNING * INTO saved;
 END IF;
 RETURN jsonb_build_object('id',saved.id,'score',saved.score,'max_score',saved.max_score,'submitted_at',saved.submitted_at,'class_id',saved.class_id::text);
END $$;
REVOKE ALL ON FUNCTION public.ua_submit_quiz(uuid,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ua_submit_quiz(uuid,jsonb,text) TO authenticated;
COMMIT;
