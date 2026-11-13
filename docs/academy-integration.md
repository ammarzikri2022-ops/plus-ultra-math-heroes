# U.A. Academy portal — integration handoff

Existing Site, same origin. Six original learning page definitions, scripts, assets and tutor endpoint remain unchanged. Responses must not be cached publicly.

## Current student entry — simplified at the user's request

### New recording integration

Student-entry requests now carry a random event UUID and call the server-only
`portal_record_student_entry` Supabase function. Apply
`database/activate-student-entry-log.sql` in the SQL Editor of the specified
Supabase project to activate it. This creates a separate RLS-enabled entry log;
it does not alter the existing six tables. Only the recorder function is exposed
to anon, and it checks a high-entropy write secret held only in Sites runtime.
The migration contains its SHA-256 digest, never the plaintext secret.

The function's idempotent event ID prevents retry duplicates. The database sets
the timestamp. Website success requires matching database acknowledgement;
failure is shown as unsaved, with a retry button. Learning remains accessible.
This is a log of self-entered student details, not verified individual accounts
or official quiz scores. No success with the live database has yet been claimed.

Teacher login uses a username field. `TEACHER_LOGIN_USERNAME` and
`TEACHER_LOGIN_EMAIL` map the configured username to the existing Supabase Auth
account; `TEACHER_LOGIN_PASSWORD` is held as a runtime secret. Matching those
values alone grants no access: Supabase Auth must accept the same password and
the existing database profile must verify the teacher role. The Publishable Key
cannot reset the Supabase account password or create teacher roles. No password
has been changed in Supabase by this Site. Do not embed these credentials in the
client or SQL. Actual teacher authentication remains pending administrator setup
and an end-to-end test.

- Students choose a hero, enter name/class and continue without email/password. This is **guest learning**, not Supabase Authentication.
- `/api/academy` action `guest` validates the fields and sets a session-only HttpOnly/Secure `__Host-ua-guest=1` preference. It stores no identity claims and clears any prior verified Auth cookie on this browser. Teacher login clears the guest preference in return.
- Guest name/class/avatar are kept in this tab's sessionStorage for display and sent to the recorder above. If storage is unavailable, entry still succeeds. No profiles/attempts/answers are written, and no official scores are claimed.
- The original public learning shell accepts a guest-entry preference. Teacher reports always require the separate real Supabase Auth token plus a database-verified teacher role; a guest preference never authorizes reports.
- Guest-entry rate limit is 120/minute per isolate/IP to accommodate a classroom sharing Wi-Fi. Auth requests retain the 12/minute limit.
- Remaining Supabase setup below applies to verified teacher accounts, official records and the retained authenticated-account backend, not to guest learning. The student setup warning is no longer shown.
- Portal Red Riot and Tokoyami use transparent cutouts from the user's supplied images, edited with the built-in image generation tool (background extraction only). Assets: `public/assets/red-riot-portal-cutout.png`, `public/assets/tokoyami-portal-cutout.png`. Prompts: remove the plain background to real alpha; preserve each supplied character's pose, costume, colors and artist credit.

## Verified on 2026-11-03

- Project: https://xhrbujjlvpmetzdnwwhv.supabase.co
- Publishable key configured as a production secret, never copied into browser source.
- `/auth/v1/settings`: HTTP 200; email authentication enabled.
- Anonymous `profiles` query: denied (42501). Do **not** grant anonymous profile access to fix this.
- `hero_portal_profile` RPC: absent (PGRST202). No schema, grants, policies, tables or accounts were changed.
- No student/teacher credentials supplied; successful account sign-in and class isolation remain unverified.

## Required database contract — review against the existing schema first

Use existing `classes`, `profiles`, `teacher_classes`, `quizzes`, `attempts`, `answers`. The Site deliberately does not guess their column names. Review real column definitions and RLS policies, then add the functions below. Use `auth.uid()` for the caller; do not accept a user ID or role from the browser. Prefer SECURITY INVOKER with existing correct RLS. If a SECURITY DEFINER is required, pin the search_path, fully qualify objects and perform all authorization inside the function. Revoke PUBLIC/anon execution and grant only the authenticated role.

### `public.hero_portal_profile()`

Return exactly one JSON object (or one-row result):

`{id: UUID, role: "student"|"teacher", display_name: text, class_name: text, avatar: text|null}`

- Select only the profile bound to `auth.uid()`; role comes from the administrator-controlled database field, never user metadata.
- Reject unapproved or missing profiles. Reject disabled memberships. For students, return the class assigned by staff, not user input.
- `avatar` is one of `deku`, `bakugo`, `todoroki`, `red-riot`, `tokoyami`. Alias any existing avatar column to this result field.

### `public.hero_update_profile(p_display_name text, p_avatar text)`

- Require a verified, approved student profile for `auth.uid()`.
- Update only that student's display name and cosmetic avatar. Name: 2–100 characters. Avatar: the allowlist above.
- Never change role, class membership, approval, user ID or scores. Return success only after persistence.
- See `database/avatar-proposal-review.sql`; it is a proposal only and was not executed.

### `public.hero_teacher_report()`

- Require database role `teacher`.
- Derive allowed class IDs from `teacher_classes` for `auth.uid()` and constrain all profile/attempt joins to those IDs, in the database. Teachers cannot submit arbitrary class IDs.
- Return at most 5,000 official attempt rows with fields:
  `student_id` (stable UUID), `student_name`, `class_name`, `avatar`, `quiz_title`, `score`, `max_score`, `submitted_at` (ISO timestamp), `attempt_number` (integer).
- Return all official attempts, not just the latest. Never return passwords, answer keys or unrelated profile fields. Calculate attempt counts and scores from official records only.
- Empty array means no permitted attempts, not a simulated report. Raise an authorization error for missing teacher role.

The dashboard computes average percentages only from returned official scores and exports the currently filtered authorized rows. CSV cells are formula-escaped. Timestamps display in Asia/Kuala_Lumpur; export timestamps remain ISO.

## Account provisioning

- No public sign-up or role selector is exposed. A teacher/administrator must provision the Supabase Auth account via a trusted administration channel, bind the profile to its Auth UUID and assign its class. Teachers also require explicit teacher_classes assignments.
- Supabase currently reports signup enabled. This portal does not expose signup; for school-wide invitation-only provisioning, the Supabase administrator should review/disable public signups in Auth settings. This was not changed automatically.
- Ensure ordinary users cannot insert/update role or class fields through RLS or other APIs. A new Auth user without an approved profile must receive no learning access.
- Do not share real student passwords in chat. Use a dedicated non-personal test student and test teacher for final acceptance.

## Session / transport

- Password sent only to same-origin `/api/academy` and forwarded to this Supabase project's password Auth endpoint; never manually stored or logged.
- Access token stored in Secure, HttpOnly, SameSite=Lax `__Host-ua-session`, maximum 1 hour. No browser localStorage token. Re-authentication is required when expired; refresh-token persistence is intentionally not enabled.
- Each protected server render and report operation revalidates the token through Auth and reads the approved database profile. Cookie contents alone do not authorize access.
- Same-origin checks, JSON validation, 12 requests/minute per Worker isolate/IP (best effort; use a platform-wide rate limiter for stronger guarantees), bounded request sizes and upstream timeouts.
- Set `SUPABASE_PORTAL_READY=true` only after schema integration and acceptance tests pass. It hides the setup notice; it does not bypass any authentication check.

## Official quiz scoring

The six existing learning pages were preserved. Their existing client-side scoring is **not newly connected** to Supabase and must not be represented as official stored marks. Before enabling official record collection, use a reviewed database/Edge Function to validate question IDs and choices against private server-held keys and write `attempts`/`answers` in one transaction; ignore client-supplied scores. Wire that function in a separately authorized quiz integration change. No fake attempts are created by this portal.

## Acceptance still required

1. Profile/teacher RPCs deployed after schema review; anon execution and cross-class data access denied.
2. Dedicated test student login, avatar persistence, welcome → original Home, logout, expired session.
3. Student attempting Teacher portal rejected; forged cookies/metadata rejected.
4. Teacher sees only assigned classes; second unassigned class excluded at database level; CSV exact match.
5. Official quiz submission/score integration separately verified before relying on dashboard marks.

Read-only schema discovery for an administrator:

```sql
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
and table_name in ('classes','profiles','teacher_classes','quizzes','attempts','answers')
order by table_name, ordinal_position;

select tablename, policyname, roles, cmd, qual, with_check
from pg_policies where schemaname = 'public'
and tablename in ('classes','profiles','teacher_classes','quizzes','attempts','answers');
```
