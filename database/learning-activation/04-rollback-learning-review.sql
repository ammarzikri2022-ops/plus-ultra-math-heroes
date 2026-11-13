-- REVIEW ONLY. Disable new frontend actions first; run BEFORE workspace rollback.
-- No pupil, quiz, reflection or class record is deleted. No DROP CASCADE.
BEGIN;
DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN('ua_account_preferences','ua_complete_profile','ua_student_context','ua_teacher_rename_class','ua_teacher_create_invite','ua_teacher_invites','ua_teacher_revoke_invite','ua_student_join_class','ua_teacher_class_roster','ua_teacher_remove_student','ua_submit_quiz','ua_student_results','ua_save_learning_reflection','ua_my_learning_reflections','ua_teacher_learning_records') LOOP
  EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);
  EXECUTE format('DROP FUNCTION %s',f.signature);
 END LOOP;
END $$;
-- Preserve private archive and existing student memberships/profile names.
-- No existing enrollment is rolled back to an older class without explicit
-- administrator review; doing that could expose pupils to the wrong teacher.
REVOKE ALL ON ua_teacher_private.preferences,ua_teacher_private.enrollments,ua_teacher_private.invites,ua_teacher_private.quiz_keys,ua_teacher_private.quiz_results,ua_teacher_private.learning_reflections FROM PUBLIC,anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
