-- REVIEW ONLY. In Supabase SQL Editor, replace the placeholder with the UUID
-- of a confirmed student from Auth whose public.profiles.role is student.
-- The first query must return student / confirmed. Do not paste private data
-- back into an issue or chat. Run this in staging before production.
select p.role, u.email_confirmed_at is not null as confirmed
from public.profiles p join auth.users u on u.id=p.id
where p.id='00000000-0000-0000-0000-000000000000'::uuid;

-- Execute as authenticated, with the chosen student's JWT subject simulated.
-- This transaction rolls back even if a faulty RPC permits registration.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub',
                  '00000000-0000-0000-0000-000000000000',true);
do $$
begin
  perform public.ua_register_teacher_workspace();
  raise exception 'FAIL: student registration unexpectedly succeeded';
exception
  when insufficient_privilege then
    raise notice 'PASS: student registration rejected (42501)';
end $$;
select public.ua_teacher_workspace_context() is null as student_context_is_null;
rollback;

-- Also test unauthenticated and a different teacher using their real JWT
-- through the application/API. SQL Editor is not a substitute for those tests.
