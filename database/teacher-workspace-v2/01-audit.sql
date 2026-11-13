-- Read-only: send these results without pupil rows or credentials.
select table_name,column_name,data_type,is_nullable,column_default
from information_schema.columns where table_schema='public'
and table_name in('classes','profiles','teacher_classes','quizzes','attempts','answers','student_reflections','teacher_access_requests')
order by table_name,ordinal_position;
select tablename,policyname,roles,cmd,qual,with_check from pg_policies
where schemaname='public' and tablename in('classes','profiles','teacher_classes','quizzes','attempts','answers');
select t.tgname,pg_get_triggerdef(t.oid) as trigger_definition,
 pg_get_functiondef(t.tgfoid) as trigger_function
from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
where n.nspname='auth' and c.relname='users' and not t.tgisinternal;
select conrelid::regclass as table_name,conname,pg_get_constraintdef(oid) as definition
from pg_constraint where conrelid in('public.classes'::regclass,'public.profiles'::regclass,'public.teacher_classes'::regclass);

-- Review every exposed SECURITY DEFINER RPC: such functions can bypass RLS.
-- Definitions only: no pupil rows, Auth tokens or passwords are selected.
select n.nspname as schema_name,p.proname,p.prosecdef,
 pg_get_function_identity_arguments(p.oid) as arguments,
 p.proacl as execution_grants,pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.prokind='f' and p.prosecdef
order by p.proname;

-- Read definitions and compare policies BEFORE approving this fingerprint.
-- Include all public policies/SECURITY DEFINER functions, not only new tables.
select md5(coalesce(string_agg(v,E'\n' order by v),'')) as security_fingerprint
from (
 select 'POLICY:'||schemaname||'.'||tablename||':'||policyname||':'||permissive||':'||roles::text||':'||cmd||':'||coalesce(qual,'')||':'||coalesce(with_check,'') v from pg_policies where schemaname='public'
 union all select 'FUNCTION:'||p.oid::regprocedure::text||':'||pg_get_functiondef(p.oid)||':'||coalesce(p.proacl::text,'DEFAULT PUBLIC EXECUTE') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f' and p.prosecdef
) audit;
-- Inspect student workflows that change profile authority through trusted RPCs.
select p.oid::regprocedure as function_name,p.prosecdef,p.proacl,pg_get_functiondef(p.oid)
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.prokind='f' and (p.proname='is_teacher_for_class' or p.proname like 'hero_%');

-- Check base table SELECT grants; RLS cannot supply missing table privileges.
select t as table_name,has_table_privilege('authenticated','public.'||t,'SELECT') as can_select
from unnest(array['profiles','classes','teacher_classes','quizzes','attempts','answers']) t;
-- Profile/class triggers may perform trusted enrollment or impose extra checks.
select c.oid::regclass as table_name,t.tgname,pg_get_triggerdef(t.oid),pg_get_functiondef(t.tgfoid)
from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in('profiles','classes','teacher_classes','attempts','answers','student_reflections') and not t.tgisinternal;
-- Security-definer views also need review (do not query pupil rows).
select c.oid::regclass as view_name,c.reloptions,c.relacl,pg_get_viewdef(c.oid)
from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='v';
