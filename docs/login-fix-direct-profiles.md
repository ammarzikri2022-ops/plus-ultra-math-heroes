# Login fix: use the existing profiles table

This supersedes the earlier RPC-based login/onboarding instructions.

## Root cause and change

The previous code called hero_complete_onboarding and hero_portal_profile unconditionally. These are application-specific RPC names, not Supabase's create_student_profile trigger function. Their absence caused PGRST202 even when Auth users and profiles already existed.

Login and session restoration now:

1. Use the official Supabase SDK for password authentication/refresh.
2. Verify identity with auth.getUser(accessToken).
3. Bind that exact access token as the Authorization header of a request-scoped SDK client.
4. Read profiles.select('id,full_name,class_id,role').eq('id', verifiedUser.id).maybeSingle().
5. Check the returned ID and database role. Never authorize from Auth user_metadata, a submitted ID, an avatar, or a portal button.
6. Allow a student profile to enter Home even when class_id is null. Class assignment is independent from basic learning access.
7. For an approved teacher role, read teacher_classes.select('class_id').eq('teacher_id', verifiedUser.id), using the same JWT/RLS context. No readable assignments gives an explicit empty-class notice, not broader access.

No SQL changes, profile creation, trigger replacement or table recreation are needed for this login fix. Do not execute the historical review migrations just to fix login. Existing optional reflection/report RPCs remain separate from authentication; failures there identify only the actual failed operation, never assert that the entire database is uninstalled.

## Error diagnostics

- publishable_key_missing / publishable_key_invalid / project_url_invalid / client_creation_failed
- email_not_confirmed / invalid_credentials / bad_jwt / not_authenticated
- profile_not_visible: an authenticated SELECT returned no visible row. Without administrator access, an absent row cannot be distinguished reliably from RLS filtering. The message explicitly states both possibilities.
- database_read_denied: explicit 42501/permission/RLS denial; diagnostic identifies SELECT and public.profiles or public.teacher_classes.
- profile_identity_mismatch / role_not_allowed / teacher_pending

Diagnostics contain operation, table and upstream error code, not passwords, access tokens, refresh tokens or full request headers. No RLS bypass or service-role key is used.

## SDK/session behavior

Access and refresh tokens stay in Secure HttpOnly cookies. The server verifies Auth rather than trusting a getSession() object from browser storage. This server-only SDK does not use browser localStorage or a browser onAuthStateChange listener as authorization. Sign-in, restored sessions and refresh are verified at the API/server boundary. SDK signOut(scope:local) revokes the current Supabase session when possible, and browser cookies are always cleared. A failed upstream logout is reported as a warning, not a falsely confirmed revocation.

## Teacher registration and approval

signUp sends full_name and requested_portal as registration metadata only; it does not send role=teacher. The existing Auth trigger creates a student profile as confirmed by the owner. When such an account enters the teacher portal, the API returns teacher_pending. Approval is an administrator operation on the existing profile role plus teacher_classes assignments, never a website role selector. Auth user_metadata can help administrators locate a request; it cannot grant permissions.

An administrator should verify the teacher's confirmed Auth identity in the Supabase Dashboard, set only the intended profile's role to teacher, and assign only the permitted class IDs in teacher_classes. Students must not have permission to change role or class membership. This fix does not change existing grants/policies; live policy isolation must be tested with controlled real accounts.

## Validation

Automated tests mock the upstream responses and prove that student and approved teacher login succeed with ALL custom RPCs absent; profile/class requests use the verified UID and user JWT; teacher metadata cannot elevate a student; hidden/denied profiles and unapproved teachers are rejected; refresh and SDK signOut work through the expected endpoints; tokens/passwords are absent from responses.

These tests do not prove live password correctness, mail delivery, administrator approval or live RLS policies. End-to-end verification requires controlled student and approved teacher accounts via the secure browser authentication flow. No real accounts, profile rows, roles or SQL policies were modified for tests.
