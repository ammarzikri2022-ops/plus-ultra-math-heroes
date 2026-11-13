-- REVIEW ONLY. Roll frontend back to single-level version before running.
-- Restores previous grading RPC. Retains all level records/keys for audit.
BEGIN;
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
  IF(SELECT count(*) FROM ua_teacher_private.quiz_results WHERE student_id=uid AND submitted_at>now()-interval '1 day')>=200 THEN RAISE EXCEPTION 'Daily quiz submission limit reached'; END IF;
  SELECT count(*)::integer INTO points FROM generate_series(0,9)i WHERE p_answers->i=key->i;
  INSERT INTO ua_teacher_private.quiz_results(id,student_id,class_id,student_name,avatar,quiz_version,answers,score) VALUES(p_submission,uid,cid,ua_teacher_private.display_name(uid),ua_teacher_private.avatar(uid),p_version,p_answers,points) RETURNING * INTO saved;
 END IF;
 RETURN jsonb_build_object('id',saved.id,'score',saved.score,'max_score',saved.max_score,'submitted_at',saved.submitted_at,'class_id',saved.class_id::text);
END $$;
REVOKE ALL ON FUNCTION public.ua_submit_quiz(uuid,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ua_submit_quiz(uuid,jsonb,text) TO authenticated;
COMMIT;
