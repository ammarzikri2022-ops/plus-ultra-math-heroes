# U.A. Hero Academy — current authentication handoff

This document supersedes the earlier guest/shared-username workflow.

## Implemented in the Site

- Existing Site and all six original learning sections/assets/scripts retained.
- Student and teacher account choices, individual email/password registration and login.
- Official Supabase JavaScript SDK on the server; no secrets or passwords in client code, localStorage or profiles.
- Five existing character images retained. Teacher portal uses the existing All Might artwork with blue/gold styling.
- Signup sends only name, cosmetic avatar, requested class and requested portal as untrusted metadata. It never sends an authorized teacher role.
- Signup success means Auth accepted the request, not that a profile/teacher permission exists. Email confirmation is required by the live Supabase settings.
- Default Supabase confirmation redirects with a fragment are securely exchanged with the backend. Optional custom token-hash email template is supported at `/auth/confirm?token_hash=...&type=email`.
- Access and refresh tokens in Secure HttpOnly SameSite cookies. Refresh uses Supabase; tokens are never given back to browser JavaScript after login. Email callback fragments are removed immediately.
- Every protected operation revalidates Auth and the database profile. The former guest cookie no longer opens content. Shared AMMAR credentials were removed from runtime configuration.
- Logout clears access, refresh and legacy guest cookies. Failed/expired sessions do not grant access.
- Real upstream Auth error messages/codes are displayed, including confirmation/rate-limit failures. No simulated login.
- Teacher pending view is based on a database pending status, not on clicking the Teacher button.
- Teacher directory, quiz reports, reflections and analytics panels call authenticated, class-scoped RPCs; there are no fabricated records. CSV exports only returned authorized rows and escapes formulas.
- New `/reflection` form/history uses authenticated Supabase RPCs. Each successful submission must return a database-generated ID and timestamp. No localStorage database, no overwrite/delete workflow.

## Verified live on 2026-11-03

- `/auth/v1/settings`: HTTP 200.
- Email provider enabled; new signup enabled; `mailer_autoconfirm=false` (confirmation required).
- `hero_portal_profile`: HTTP 404, `PGRST202` — missing function.
- The Publishable Key works but cannot inspect admin-only schema, install SQL, approve teachers or inspect redirect allowlists.

## Not yet verified

- Real signup, mail delivery, clicking confirmation, student login/profile/avatar persistence.
- Teacher request persistence, administrator approval, assigned-class isolation.
- Reflection persistence/history and official quiz report rows.
- No test identities were registered and no test pupil records were inserted into the live project.

## Next required step: read-only schema review

Run `database/read-current-auth-schema.sql` in the Supabase SQL Editor and share its results without pupil data, passwords or keys. It inspects columns, RLS policies, Auth triggers and constraints, not pupil rows.

`database/review-auth-reflections.sql` is a **review draft, not executed**. Its preflight requires the exact expected types/columns. If they differ, it aborts before making changes. Do not work around that error by dropping tables. Adapt the draft to the actual schema first.

Expected existing fields:

- profiles: `id uuid`, `full_name text`, `role` containing student/teacher, nullable `class_id uuid`.
- classes: `id uuid`, `name text`.
- teacher_classes: `teacher_id uuid`, `class_id uuid`.

The draft adds only a cosmetic avatar column plus new teacher-request and reflection tables, and the authenticated RPCs. It tightens profile column grants so pupils cannot change role/class/identity. Existing RLS policies must also be reviewed; enabling RLS alone does not prove those policies are correct. Existing Auth triggers must be checked for profile creation failures and must never grant teacher status from user_metadata. The API's onboarding function safely creates a missing profile, without replacing an existing trigger.

A newly registered pupil's requested class is not trusted as an assignment. A teacher/administrator must assign the actual class ID. A newly registered teacher remains pending until an administrator approves the request and assigns classes.

## Administrator approval workflow (no public admin page)

Use the Supabase Dashboard/SQL Editor under the project administrator account:

1. Review the teacher's confirmed Auth email and request identity.
2. In one reviewed transaction, change the existing profile role to teacher, set the corresponding teacher_access_requests status to approved with approved_at and approved_by, and add only permitted class IDs to teacher_classes.
3. Verify the Auth user UUID is used consistently; do not infer an ID from name/email.
4. Revoke access by changing the request/profile status and removing assignments as appropriate. Preserve historical rows.
5. Do not grant authenticated users permission to update role, class membership, approval status or official scores.

No default administrator/password or automatic teacher promotion was added. Server-only project administration is required; do not share service_role keys in chat.

## Email configuration

Confirm in Auth > URL Configuration:

- Site URL: `https://plus-ultra-misi-ukuran-ali-2026.ammarzikri2022.chatgpt.site`
- Allow redirect: `https://plus-ultra-misi-ukuran-ali-2026.ammarzikri2022.chatgpt.site/academy?confirmed=1`
- Optional custom email template uses `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`.

The default ConfirmationURL template also works with the Site's fragment exchange; no template change is required just for that flow. Check SMTP delivery/rate limits and school email policy. Real mail delivery was not tested with an unowned address.

## RPC contracts

- hero_complete_onboarding(): authenticated UUID only. Create missing profile with student role and no trusted class assignment; insert a pending teacher request if requested. Never overwrite role/class/approval on existing profiles.
- hero_portal_profile(): current caller only, returns id, role, display_name, class_name, avatar, approval_status. Pending teacher returns role pending_teacher, approval_status pending. Reject disabled/rejected accounts.
- hero_teacher_directory(): actual approved teacher's assigned classes only; fields student_id, student_name, class_name, avatar.
- hero_teacher_reflections(): same class filter; full reflection fields plus student name/class.
- hero_my_reflections(): own records only, newest first, no supplied user ID.
- hero_submit_reflection(p_emotion,p_topic,p_understanding,p_reflection,p_help_requested): derive student ID, assigned class and avatar on the database; append one record and return id/created_at.
- hero_teacher_report(): requires real quizzes/attempts/answers schema mapping, still pending. Return student_id, student_name, class_name, avatar, quiz_title, score, max_score, submitted_at, attempt_number and pupil answers only for assigned classes.

Official quiz grading must remain on a reviewed server/database function with private answer keys. Existing browser quiz marks were preserved and are not newly represented as official Supabase attempts. Map the actual quizzes/attempts/answers fields before integrating submission; ignore any client-supplied score.

## Acceptance after schema integration

Use dedicated, non-personal test accounts provided/controlled by the school. Test email confirmation, refresh/logout, own-profile/avatar, pending-teacher rejection, manual approval and two-class isolation. Submit two reflections and verify both persist after refresh/relogin. Test a student's direct report URL, forged role metadata and a teacher from an unassigned class. Verify official grading and answers against database-held keys before relying on analytics.
