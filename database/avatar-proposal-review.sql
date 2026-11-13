-- PROPOSAL ONLY. NOT EXECUTED. Review the actual profiles schema, existing
-- avatar fields and policies before applying. No tables are recreated.
-- Use an existing suitable avatar column instead if one already exists.
begin;
alter table public.profiles add column if not exists hero_avatar text;
alter table public.profiles add constraint profiles_hero_avatar_allowed
  check (hero_avatar is null or hero_avatar in
    ('deku','bakugo','todoroki','red-riot','tokoyami')) not valid;
alter table public.profiles validate constraint profiles_hero_avatar_allowed;
-- No grants or RLS policies are changed. Existing students must not gain
-- permission to change role, class, approval, identity or official marks.
-- Reviewed RPC hero_update_profile must update only the caller's cosmetic
-- avatar/name; hero_portal_profile must alias hero_avatar as avatar.
rollback; -- Deliberate review-only default. Change only after explicit review.
