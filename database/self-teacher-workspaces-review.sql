-- REVIEW BEFORE RUNNING. Not executed against the live Supabase project.
-- Goal: verified users can open ONLY their own teacher workspace without
-- profiles.role being promoted to the legacy global teacher role.
-- Existing Auth trigger create_student_profile() is NOT changed.
-- Run database/read-current-auth-schema.sql first to inspect live policies.
begin;
-- 1. Fail before changing anything if the existing schema differs.
do $$
declare x record; required text;
begin
 for x in select * from (values
  ('profiles','id','uuid'),('profiles','class_id','uuid'),
  ('teacher_classes','teacher_id','uuid'),('teacher_classes','class_id','uuid'),
  ('classes','id','uuid')) as v(t,c,typ) loop
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name=x.t and column_name=x.c and data_type=x.typ) then raise exception 'Schema mapping required: %.% must be %. No migration applied.',x.t,x.c,x.typ; end if;
 end loop;
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='role') then raise exception 'profiles.role missing'; end if;
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='classes' and column_name='name' and data_type in('text','character varying')) then raise exception 'Expected classes.name text/varchar; review actual class-name column'; end if;
 -- Extra required columns need an explicit reviewed mapping, not guessed values.
 select string_agg(table_name||'.'||column_name,', ') into required from information_schema.columns where table_schema='public' and table_name in('classes','teacher_classes') and is_nullable='NO' and column_default is null and is_identity='NO' and is_generated='NEVER' and not ((table_name='classes' and column_name in('id','name')) or(table_name='teacher_classes' and column_name in('teacher_id','class_id')));
 if required is not null then raise exception 'Required column mapping needed: %. No migration applied.',required; end if;
 for x in select unnest(array['profiles','classes','teacher_classes','quizzes','attempts','answers']) as t loop
  if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=x.t and c.relkind='r' and c.relrowsecurity) then raise exception 'Expected RLS-enabled table public.%',x.t; end if;
 end loop;
end $$;

-- 2. Private capability and ownership tables; none are writable by API users.
create schema if not exists ua_teacher_private;
revoke all on schema ua_teacher_private from public,anon,authenticated;
grant usage on schema ua_teacher_private to authenticated;
create table ua_teacher_private.workspaces (
 teacher_id uuid primary key references auth.users(id), created_at timestamptz not null default now()
);
create table ua_teacher_private.owned_classes (
 class_id uuid primary key references public.classes(id),
 teacher_id uuid not null references ua_teacher_private.workspaces(teacher_id),
 created_at timestamptz not null default now()
);
create table ua_teacher_private.class_grants (
 class_id uuid not null references ua_teacher_private.owned_classes(class_id),
 teacher_id uuid not null references ua_teacher_private.workspaces(teacher_id),
 granted_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
 primary key(class_id,teacher_id)
);
alter table ua_teacher_private.workspaces enable row level security;
alter table ua_teacher_private.owned_classes enable row level security;
alter table ua_teacher_private.class_grants enable row level security;
revoke all on all tables in schema ua_teacher_private from public,anon,authenticated;

create function ua_teacher_private.is_workspace_user() returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from ua_teacher_private.workspaces where teacher_id=auth.uid());
$$;
create function ua_teacher_private.owns_class(cid text) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from ua_teacher_private.owned_classes where class_id::text=cid and teacher_id=auth.uid());
$$;
create function ua_teacher_private.can_class(cid text) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and cid is not null and (
  exists(select 1 from ua_teacher_private.owned_classes where class_id::text=cid and teacher_id=auth.uid())
  or exists(select 1 from ua_teacher_private.class_grants where class_id::text=cid and teacher_id=auth.uid())
  -- Preserve explicit pre-existing assignments of administrator-approved legacy
  -- teachers. New self-registered workspaces NEVER gain this global role.
  or exists(select 1 from public.profiles p join public.teacher_classes tc on tc.teacher_id=p.id where p.id=auth.uid() and p.role::text='teacher' and tc.class_id::text=cid)
 );
$$;

-- Fail-closed record ceiling for NEW workspace accounts. No inferred ownership
-- from names, client-supplied IDs, or current pupil-class changes is used.
create function ua_teacher_private.row_allowed(tbl text,r jsonb) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare linked jsonb;
begin
 if auth.uid() is null then return false; end if;
 if tbl='profiles' then return r->>'id'=auth.uid()::text or ua_teacher_private.can_class(r->>'class_id'); end if;
 if tbl='classes' then return ua_teacher_private.can_class(r->>'id'); end if;
 if tbl='teacher_classes' then return r->>'teacher_id'=auth.uid()::text and ua_teacher_private.can_class(r->>'class_id'); end if;
 if ua_teacher_private.can_class(r->>'class_id') then return true; end if;
 if tbl in('attempts','student_reflections') and coalesce(r->>'student_id',r->>'user_id')=auth.uid()::text then return true; end if;
 if tbl='attempts' and r->>'quiz_id' is not null then
  select to_jsonb(q) into linked from public.quizzes q where to_jsonb(q)->>'id'=r->>'quiz_id';
  return coalesce(ua_teacher_private.can_class(linked->>'class_id'),false);
 end if;
 if tbl='answers' and r->>'attempt_id' is not null then
  select to_jsonb(a) into linked from public.attempts a where to_jsonb(a)->>'id'=r->>'attempt_id';
  return coalesce(ua_teacher_private.row_allowed('attempts',linked),false);
 end if;
 return false;
end $$;

-- 3. Restrictive policies intersect existing policies; no old policy is removed.
-- Missing class relationships deny access instead of guessing ownership.
do $$
declare t text;
begin
 foreach t in array array['profiles','classes','teacher_classes','quizzes','attempts','answers','student_reflections'] loop
  if to_regclass('public.'||t) is not null then
   execute format('create policy ua_workspace_read_ceiling on public.%I as restrictive for select to authenticated using (not ua_teacher_private.is_workspace_user() or ua_teacher_private.row_allowed(%L,to_jsonb(%I)))',t,t,t);
   if t <> 'profiles' then
    -- Class/membership and official learning-record writes require trusted RPCs.
    -- Workspace capability never permits changing another pupil record or score.
    execute format('create policy ua_workspace_insert_ceiling on public.%I as restrictive for insert to authenticated with check (not ua_teacher_private.is_workspace_user())',t);
    execute format('create policy ua_workspace_update_ceiling on public.%I as restrictive for update to authenticated using (not ua_teacher_private.is_workspace_user()) with check (not ua_teacher_private.is_workspace_user())',t);
    execute format('create policy ua_workspace_delete_ceiling on public.%I as restrictive for delete to authenticated using (not ua_teacher_private.is_workspace_user())',t);
   else
    execute format('create policy ua_workspace_insert_ceiling on public.%I as restrictive for insert to authenticated with check (not ua_teacher_private.is_workspace_user() or (to_jsonb(%I)->>''id'')=auth.uid()::text)',t,t);
    execute format('create policy ua_workspace_update_ceiling on public.%I as restrictive for update to authenticated using (not ua_teacher_private.is_workspace_user() or (to_jsonb(%I)->>''id'')=auth.uid()::text) with check (not ua_teacher_private.is_workspace_user() or (to_jsonb(%I)->>''id'')=auth.uid()::text)',t,t,t);
    execute format('create policy ua_workspace_delete_ceiling on public.%I as restrictive for delete to authenticated using (not ua_teacher_private.is_workspace_user())',t);
   end if;
  end if;
 end loop;
end $$;

-- Protect authorization columns even if an old self-update policy is too broad.
create function ua_teacher_private.protect_profile_authority() returns trigger
language plpgsql set search_path='' as $$
begin
 if current_user='authenticated' and TG_OP='INSERT' and (new.id is distinct from auth.uid() or new.role::text is distinct from 'student' or new.class_id is not null) then raise exception 'Profile creation requires own student identity without class authority' using errcode='42501'; end if;
 if current_user='authenticated' and TG_OP='UPDATE' and (new.id is distinct from old.id or new.role is distinct from old.role or new.class_id is distinct from old.class_id) then raise exception 'Profile identity/role/class changes require a trusted server operation' using errcode='42501'; end if;
 return new;
end $$;
create trigger ua_protect_profile_authority before insert or update on public.profiles for each row execute function ua_teacher_private.protect_profile_authority();

-- 4. Public, narrow RPC surface. No function accepts an acting teacher ID.
create function public.ua_teacher_workspace_context() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare ids jsonb;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if not ua_teacher_private.is_workspace_user() then return null; end if;
 select coalesce(jsonb_agg(c.id),'[]'::jsonb) into ids from public.classes c where ua_teacher_private.can_class(c.id::text);
 return jsonb_build_object('teacher_id',auth.uid(),'scope','owned_classes','class_ids',ids);
end $$;
create function public.ua_register_teacher_workspace() returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null) then raise exception 'Confirmed email and valid Auth session required' using errcode='42501'; end if;
 if not exists(select 1 from public.profiles where id=auth.uid()) then raise exception 'Authenticated profile missing' using errcode='42501'; end if;
 insert into ua_teacher_private.workspaces(teacher_id) values(auth.uid()) on conflict(teacher_id) do nothing;
 -- Deliberately NO update to public.profiles.role and NO grants on old classes.
 return public.ua_teacher_workspace_context();
end $$;
create function public.ua_teacher_list_classes() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not ua_teacher_private.is_workspace_user() then raise exception 'Teacher workspace required' using errcode='42501'; end if;
 return (select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (select c.id,c.name,ua_teacher_private.owns_class(c.id::text) as is_owner from public.classes c where ua_teacher_private.can_class(c.id::text) order by c.name,c.id) x);
end $$;
create function public.ua_teacher_create_class(p_name text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare cid uuid:=gen_random_uuid(); clean_name text:=btrim(p_name);
begin
 if not ua_teacher_private.is_workspace_user() then raise exception 'Teacher workspace required' using errcode='42501'; end if;
 if clean_name is null or char_length(clean_name) not between 1 and 100 then raise exception 'Class name must contain 1-100 characters'; end if;
 perform 1 from ua_teacher_private.workspaces where teacher_id=auth.uid() for update;
 if (select count(*) from ua_teacher_private.owned_classes where teacher_id=auth.uid())>=100 then raise exception 'Workspace class limit reached'; end if;
 insert into public.classes(id,name) values(cid,clean_name);
 insert into ua_teacher_private.owned_classes(class_id,teacher_id) values(cid,auth.uid());
 insert into public.teacher_classes(teacher_id,class_id) values(auth.uid(),cid);
 return jsonb_build_object('id',cid,'name',clean_name,'is_owner',true);
end $$;

-- Optional explicit sharing: only the actual class owner may grant/revoke.
create function public.ua_teacher_share_class(p_class_id uuid,p_recipient uuid,p_allow boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not ua_teacher_private.owns_class(p_class_id::text) or p_recipient=auth.uid() then raise exception 'Only the class owner may share with another teacher' using errcode='42501'; end if;
 if not exists(select 1 from ua_teacher_private.workspaces where teacher_id=p_recipient) then raise exception 'Recipient has no verified teacher workspace'; end if;
 if p_allow then
  insert into ua_teacher_private.class_grants(class_id,teacher_id,granted_by) values(p_class_id,p_recipient,auth.uid()) on conflict(class_id,teacher_id) do nothing;
 else
  delete from ua_teacher_private.class_grants where class_id=p_class_id and teacher_id=p_recipient and granted_by=auth.uid();
 end if;
end $$;

-- Remove default PUBLIC/anon execution. Helpers need execution for RLS only.
revoke execute on all functions in schema ua_teacher_private from public,anon,authenticated;
grant execute on function ua_teacher_private.is_workspace_user(),ua_teacher_private.row_allowed(text,jsonb) to authenticated;
revoke execute on function public.ua_teacher_workspace_context(),public.ua_register_teacher_workspace(),public.ua_teacher_list_classes(),public.ua_teacher_create_class(text),public.ua_teacher_share_class(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.ua_teacher_workspace_context(),public.ua_register_teacher_workspace(),public.ua_teacher_list_classes(),public.ua_teacher_create_class(text),public.ua_teacher_share_class(uuid,uuid,boolean) to authenticated;
notify pgrst,'reload schema';
commit;
-- One-time migration: do not rerun blindly. CREATE (not OR REPLACE) intentionally
-- stops if a prior implementation exists, so it cannot silently overwrite it.
