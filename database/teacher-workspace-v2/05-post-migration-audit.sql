-- REVIEW ONLY. Run after a separately approved migration in the intended
-- Supabase project. Metadata and counts only; no student rows are returned.
select current_database() as database_name,
       to_regnamespace('ua_teacher_private') as workspace_schema,
       to_regclass('ua_teacher_private.workspaces') as workspaces,
       to_regclass('ua_teacher_private.owned_classes') as owned_classes;

select p.oid::regprocedure as signature, p.prosecdef as security_definer,
       p.proconfig as function_settings,
       has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
       has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
       pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in
 ('ua_register_teacher_workspace','ua_teacher_workspace_context',
  'ua_teacher_list_classes','ua_teacher_create_class',
  'ua_teacher_workspace_records')
order by p.oid::regprocedure::text;

select c.relname as table_name, c.relrowsecurity as rls_enabled,
       count(pol.policyname) filter (where pol.policyname like 'ua_ws_%') as workspace_policies
from pg_class c join pg_namespace n on n.oid=c.relnamespace
left join pg_policies pol on pol.schemaname=n.nspname and pol.tablename=c.relname
where n.nspname='public' and c.relname in
 ('profiles','classes','teacher_classes','attempts','answers','student_reflections')
group by c.relname,c.relrowsecurity order by c.relname;

-- Detect any unauthorized workspace rows without displaying user details.
select count(*) as total_workspaces,
       count(*) filter (where teacher_id='db291d38-1c27-41b4-9a68-6bcff1773838'::uuid) as authorized_workspaces,
       count(*) filter (where teacher_id<>'db291d38-1c27-41b4-9a68-6bcff1773838'::uuid) as unauthorized_workspaces
from ua_teacher_private.workspaces;

-- The migration must not alter the existing data or legacy helper definitions.
-- Compare these counts and definitions against the pre-migration audit/backup.
select 'classes' as relation, count(*) as rows from public.classes
union all select 'profiles',count(*) from public.profiles
union all select 'teacher_classes',count(*) from public.teacher_classes
union all select 'quizzes',count(*) from public.quizzes
union all select 'attempts',count(*) from public.attempts
union all select 'answers',count(*) from public.answers;
select pg_get_functiondef('public.is_teacher_for_class(bigint)'::regprocedure) as legacy_teacher_helper;
