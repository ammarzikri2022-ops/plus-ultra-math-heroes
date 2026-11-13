# Three Quiz stages — approval required for production SQL

Frontend: Easy / Medium / Hard, ten questions each. A completed attempt with at least six correct opens the following practice stage. Original ten questions remain Easy. Best practice scores are isolated by authenticated account in browser storage; they are not official marks or certificate evidence. Existing verified official results also restore stage access.

## Proposed database activation

Review the teacher-workspace v2 and learning activation 03 prerequisites first. Then review `05-quiz-levels-review.sql`. **Do not run automatically.** It adds two private answer keys and replaces only the existing authenticated grading RPC. No table recreation, role/profile change, RLS policy change, class ID change or deletion of historical results occurs.

The RPC obtains the student from the authenticated session, calculates scores using private keys, requires a stored Easy pass before Medium and both stored Easy and Medium passes before Hard, and serializes each pupil's submissions using the existing profile row lock. Browser practice progress cannot authorize an official result. Original Easy results count toward the prerequisite. Existing teacher class isolation is retained. Until this approved SQL is activated, new-level official saves may be rejected; the interface reports unsaved results honestly.

## Local verification

- `node --import tsx --test tests/academy-security.test.ts tests/learning-api.test.ts`
- `LINKEDOM_MODULE=<absolute linkedom esm/index.js> node tests/quiz-levels-dom.mjs`
- `UA_TEST_LEARNING=1 PGLITE_MODULE=<absolute pglite dist/index.js> node tests/teacher-workspace-postgres.mjs`
- `npx tsc --noEmit` and `node --check public/app.js`

These use local fixtures, not real pupil credentials. The PostgreSQL test covers 5/10 denied versus 6/10 accepted, skipping stages, teacher/pupil boundaries and class-history isolation. The DOM test exercises all thirty questions, repeated animations, hints, retry and duplicate-click guards, and checks the other five page sections are unchanged.

## After approved activation: staging checks

Use dedicated confirmed student accounts and two teachers, each with their own class. Verify Easy 5/10 keeps Medium locked; Easy 6/10 permits Medium; Medium 5/10 keeps Hard locked; Medium 6/10 permits Hard; direct Hard RPC requests fail before prerequisites; students cannot read private keys/results belonging to others; each teacher sees only their class-authorized history. Verify saved history survives refresh and sign-out/sign-in. Do not use or expose real pupil data in test output.

## Rollback

Restore the previous single-stage frontend before running reviewed `06-rollback-quiz-levels-review.sql`. It restores the prior grading function and retains all records and keys for audit. A transaction failure in either migration rolls back the entire SQL change. To deactivate the full learning module use its existing reviewed rollback, not this stage-only rollback.
