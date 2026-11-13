-- Run once in the Supabase SQL Editor for project xhrbujjlvpmetzdnwwhv.
-- Additive: does not change the six existing learning tables or their policies.
-- Logs self-entered guest details, not verified identities or official marks.
begin;
create table if not exists public.portal_student_entries (
  id uuid primary key,
  student_name text not null check (char_length(student_name) between 2 and 100),
  class_name text not null check (char_length(class_name) between 1 and 100),
  avatar text not null check (avatar in ('deku','bakugo','todoroki','red-riot','tokoyami')),
  entered_at timestamptz not null default now()
);
alter table public.portal_student_entries enable row level security;
revoke all on public.portal_student_entries from public, anon, authenticated;

create or replace function public.portal_record_student_entry(
  p_entry_id uuid, p_student_name text, p_class_name text, p_avatar text, p_write_key text
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare saved_at timestamptz;
begin
  if p_write_key is null or
    pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_write_key,'UTF8')),'hex')
    <> '8504a777fd4fa13bcc99077d92b8b5e95aafce1ebf1fd5e9c2cf8ec95674736d' then
    raise exception 'Entry recorder access denied' using errcode = '42501';
  end if;
  if p_entry_id is null or p_student_name is null or p_class_name is null or p_avatar is null
    or char_length(btrim(p_student_name)) not between 2 and 100
    or char_length(btrim(p_class_name)) not between 1 and 100
    or p_avatar not in ('deku','bakugo','todoroki','red-riot','tokoyami') then
    raise exception 'Invalid entry';
  end if;
  insert into public.portal_student_entries(id,student_name,class_name,avatar)
    values(p_entry_id,btrim(p_student_name),btrim(p_class_name),p_avatar)
    on conflict (id) do nothing;
  select entered_at into saved_at from public.portal_student_entries where id=p_entry_id;
  return pg_catalog.jsonb_build_object('entry_id',p_entry_id,'recorded_at',saved_at);
end;
$$;
revoke all on function public.portal_record_student_entry(uuid,text,text,text,text) from public, anon, authenticated;
grant execute on function public.portal_record_student_entry(uuid,text,text,text,text) to anon;
-- The anon role may invoke the recorder but must supply the high-entropy
-- server write key. It cannot read, update or delete any pupil records.
-- The plaintext write key exists only in Sites runtime secrets, not this SQL.
notify pgrst, 'reload schema';
commit;

-- Verify records as the project administrator (not a public website endpoint):
-- select student_name,class_name,avatar,
--   entered_at at time zone 'Asia/Kuala_Lumpur' as masa_malaysia
-- from public.portal_student_entries order by entered_at desc;
