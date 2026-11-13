-- REVIEW ONLY. Disable new portal flow first. Never deletes class/student records.
-- Existing profiles.role and existing trigger were never changed.
BEGIN;
SET LOCAL lock_timeout='10s';
REVOKE EXECUTE ON FUNCTION public.ua_teacher_workspace_context(),public.ua_register_teacher_workspace(),public.ua_teacher_list_classes(),public.ua_teacher_create_class(text),public.ua_teacher_workspace_records(text) FROM PUBLIC,anon,authenticated;
DO $$ DECLARE t text; p text; BEGIN
 FOREACH t IN ARRAY ARRAY['profiles','classes','teacher_classes','attempts','answers','student_reflections'] LOOP
  IF to_regclass('public.'||t) IS NOT NULL THEN
   FOREACH p IN ARRAY ARRAY['ua_ws_select','ua_ws_read_ceiling','ua_ws_insert_ceiling','ua_ws_update_ceiling','ua_ws_delete_ceiling'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',p,t);
   END LOOP;
  END IF;
 END LOOP;
END $$;
DROP TRIGGER ua_workspace_profile_guard ON public.profiles;
DROP TRIGGER ua_workspace_class_id ON public.classes;
DROP FUNCTION public.ua_teacher_workspace_records(text);
DROP FUNCTION public.ua_teacher_create_class(text);
DROP FUNCTION public.ua_teacher_list_classes();
DROP FUNCTION public.ua_register_teacher_workspace();
DROP FUNCTION public.ua_teacher_workspace_context();
-- Private capability/ownership/share tables intentionally retained as archive.
-- No CASCADE: stop if another component gained a dependency.
REVOKE ALL ON SCHEMA ua_teacher_private FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA ua_teacher_private FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA ua_teacher_private FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA ua_teacher_private FROM PUBLIC,anon,authenticated;
-- classes.id again has its ORIGINAL behaviour (no default/identity/allocator).
-- Existing and newly created bigint IDs, names, memberships and pupil data remain.
-- Do not reset/reuse IDs or drop archive tables to rerun migration. Review a
-- forward migration if reactivation is wanted; the prerequisite refuses reruns.
NOTIFY pgrst,'reload schema';
COMMIT;
