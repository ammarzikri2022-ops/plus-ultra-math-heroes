-- REVIEW DRAFT, NOT EXECUTED. Confirm schema and RLS policies before applying.
-- Transaction aborts BEFORE any changes if the expected existing columns differ.
-- Existing classes/profiles/teacher_classes tables are retained; no rows deleted.
begin;
do $$
declare spec record;
begin
 for spec in select * from (values
  ('profiles','id','uuid'),('profiles','class_id','uuid'),('profiles','full_name','text'),
  ('classes','id','uuid'),('classes','name','text'),
  ('teacher_classes','teacher_id','uuid'),('teacher_classes','class_id','uuid')
 ) as expected(t,c,typ) loop
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name=spec.t and column_name=spec.c and data_type=spec.typ) then
   raise exception 'Schema review required: %.% must be %. No changes applied.',spec.t,spec.c,spec.typ;
  end if;
 end loop;
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='role') then raise exception 'profiles.role missing'; end if;
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='class_id' and is_nullable='YES') then raise exception 'Pending accounts require nullable profiles.class_id; review rather than change blindly'; end if;
end $$;
alter table public.profiles add column if not exists hero_avatar text;
-- Reuse an existing avatar column instead if present; adapt the aliases below.
create table if not exists public.teacher_access_requests (
 user_id uuid primary key references auth.users(id), full_name text not null,
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 requested_at timestamptz not null default now(), approved_at timestamptz,
 approved_by uuid references auth.users(id)
);
create table if not exists public.student_reflections (
 id uuid primary key default gen_random_uuid(),
 student_id uuid not null references auth.users(id), class_id uuid not null references public.classes(id),
 avatar text not null check(avatar in('deku','bakugo','todoroki','red-riot','tokoyami')),
 emotion text not null check(emotion in('gembira','yakin','keliru','perlukan_bantuan')),
 topic text not null check(topic in('cm-mm','m-cm','km-m','gabungan')),
 understanding smallint not null check(understanding between 1 and 5),
 reflection text not null check(char_length(reflection) between 1 and 3000),
 help_requested boolean not null default false, created_at timestamptz not null default now()
);
alter table public.teacher_access_requests enable row level security;
alter table public.student_reflections enable row level security;
revoke all on public.teacher_access_requests,public.student_reflections from public,anon,authenticated;
-- Deny client-side privilege escalation. REVIEW grants inherited via other roles.
revoke insert,update,delete on public.profiles from public,anon,authenticated;
do $$ declare cols text; begin
 select string_agg(quote_ident(column_name),',') into cols from information_schema.columns where table_schema='public' and table_name='profiles';
 execute format('revoke insert (%s), update (%s) on public.profiles from public,anon,authenticated',cols,cols);
end $$;
grant update(full_name,hero_avatar) on public.profiles to authenticated;

create or replace function public.hero_complete_onboarding() returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); md jsonb; n text; av text; requested text; current_role text;
begin
 if uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select raw_user_meta_data into md from auth.users where id=uid;
 n:=left(btrim(coalesce(md->>'full_name','')),100);
 if char_length(n)<2 then raise exception 'Full name must be provided at registration'; end if;
 av:=md->>'hero_avatar'; if av is null or av not in('deku','bakugo','todoroki','red-riot','tokoyami') then av:='deku'; end if;
 -- Never trust metadata for an authorized role or class membership.
 insert into public.profiles(id,full_name,role,class_id,hero_avatar) values(uid,n,'student',null,av) on conflict(id) do nothing;
 select role::text into current_role from public.profiles where id=uid;
 requested:=md->>'requested_portal';
 if requested='teacher' and current_role<>'teacher' then
  insert into public.teacher_access_requests(user_id,full_name) values(uid,n) on conflict(user_id) do nothing;
 end if;
 return jsonb_build_object('profile_created',true);
end $$;

create or replace function public.hero_portal_profile() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare p public.profiles%rowtype; c text; approval text;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select * into p from public.profiles where id=auth.uid(); if not found then raise exception 'Profile not provisioned'; end if;
 select status into approval from public.teacher_access_requests where user_id=auth.uid();
 if approval='pending' then return jsonb_build_object('id',p.id,'role','pending_teacher','approval_status','pending'); end if;
 if approval='rejected' then raise exception 'Teacher request rejected' using errcode='42501'; end if;
 if p.role::text not in ('student','teacher') then raise exception 'Account is not approved' using errcode='42501'; end if;
 if p.role::text='student' and p.class_id is null then raise exception 'Kelas murid belum ditetapkan oleh guru atau pentadbir.'; end if;
 select name into c from public.classes where id=p.class_id;
 return jsonb_build_object('id',p.id,'role',p.role,'display_name',p.full_name,'class_name',coalesce(c,''),'avatar',coalesce(p.hero_avatar,'deku'),'approval_status',coalesce(approval,'approved'));
end $$;

create or replace function public.hero_teacher_has_class(cid uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.profiles p join public.teacher_classes tc on tc.teacher_id=p.id where p.id=auth.uid() and p.role::text='teacher' and tc.class_id=cid)
 and not exists(select 1 from public.teacher_access_requests r where r.user_id=auth.uid() and r.status<>'approved');
$$;

create or replace function public.hero_teacher_directory() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if (public.hero_portal_profile()->>'role') is distinct from 'teacher' then raise exception 'Approved teacher required' using errcode='42501'; end if;
 return (select coalesce(jsonb_agg(to_jsonb(s)),'[]'::jsonb) from (select p.id as student_id,p.full_name as student_name,c.name as class_name,p.hero_avatar as avatar from public.profiles p join public.classes c on c.id=p.class_id where p.role::text='student' and public.hero_teacher_has_class(p.class_id) order by c.name,p.full_name limit 5000) s);
end $$;

create or replace function public.hero_submit_reflection(p_emotion text,p_topic text,p_understanding integer,p_reflection text,p_help_requested boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.profiles%rowtype; rid uuid; at_time timestamptz;
begin
 if (public.hero_portal_profile()->>'role') is distinct from 'student' then raise exception 'Approved student required' using errcode='42501'; end if;
 select * into p from public.profiles where id=auth.uid();
 if p.class_id is null then raise exception 'Assigned class required'; end if;
 insert into public.student_reflections(student_id,class_id,avatar,emotion,topic,understanding,reflection,help_requested)
 values(auth.uid(),p.class_id,coalesce(p.hero_avatar,'deku'),p_emotion,p_topic,p_understanding,btrim(p_reflection),coalesce(p_help_requested,false)) returning id,created_at into rid,at_time;
 return jsonb_build_object('id',rid,'created_at',at_time);
end $$;

create or replace function public.hero_my_reflections() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if (public.hero_portal_profile()->>'role') is distinct from 'student' then raise exception 'Approved student required' using errcode='42501'; end if;
 return (select coalesce(jsonb_agg(to_jsonb(s)),'[]'::jsonb) from (select id,emotion,topic,understanding,reflection,help_requested,created_at from public.student_reflections where student_id=auth.uid() order by created_at desc limit 5000) s);
end $$;

create or replace function public.hero_teacher_reflections() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if (public.hero_portal_profile()->>'role') is distinct from 'teacher' then raise exception 'Approved teacher required' using errcode='42501'; end if;
 return (select coalesce(jsonb_agg(to_jsonb(s)),'[]'::jsonb) from (select r.id,r.student_id,p.full_name as student_name,c.name as class_name,r.avatar,r.emotion,r.topic,r.understanding,r.reflection,r.help_requested,r.created_at from public.student_reflections r join public.profiles p on p.id=r.student_id join public.classes c on c.id=r.class_id where public.hero_teacher_has_class(r.class_id) order by r.created_at desc limit 5000) s);
end $$;

-- Direct access, if needed, is SELECT-only and protected by RLS.
create policy reflections_read_own_or_assigned on public.student_reflections for select to authenticated using(student_id=auth.uid() or public.hero_teacher_has_class(class_id));
create policy teacher_request_read_own on public.teacher_access_requests for select to authenticated using(user_id=auth.uid());
grant select on public.student_reflections,public.teacher_access_requests to authenticated;
-- No client UPDATE/DELETE/INSERT: each reflection submission is a new RPC insert.
revoke all on function public.hero_complete_onboarding(),public.hero_portal_profile(),public.hero_teacher_has_class(uuid),public.hero_teacher_directory(),public.hero_submit_reflection(text,text,integer,text,boolean),public.hero_my_reflections(),public.hero_teacher_reflections() from public,anon,authenticated;
grant execute on function public.hero_complete_onboarding(),public.hero_portal_profile(),public.hero_teacher_has_class(uuid),public.hero_teacher_directory(),public.hero_submit_reflection(text,text,integer,text,boolean),public.hero_my_reflections(),public.hero_teacher_reflections() to authenticated;
notify pgrst,'reload schema';
commit;
-- Do not grant teacher status through the website or user_metadata.
-- Administrator approval and class assignments are described in the handoff.
-- Quiz/report RPCs require the REAL quizzes/attempts/answers column mapping first.
