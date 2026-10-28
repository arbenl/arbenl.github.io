# Classroom email sign-in Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development. Steps use checkbox syntax for tracking.

**Goal:** Students register with a live class QR and their contact email, without GitHub, mailbox codes or new passwords.

**Architecture:** NextAuth classroom Credentials validates classroom proof and establishes a scoped student JWT. Canonical users/roster and legacy GitHub data are preserved. A public readiness check gates the new UI until staff applies an additive migration.

**Tech Stack:** Existing NextAuth v4, Next.js App Router, Drizzle/postgres, React, Vitest and Playwright. No mail service or new dependencies.

**Spec:** docs/superpowers/specs/2026-10-28-email-student-sign-in-design.md

## Chunk 1: Schema and classroom enrollment

### Task 1: Enrollment backend
Files: attendance-app/lib/attendance/classroom-registration.ts; attendance-app/app/api/classroom/status/route.ts; attendance-app/drizzle/0002_classroom_registration.sql; attendance-app/lib/db/schema.ts; attendance-app/tests/integration/classroom-registration.test.ts; attendance-app/scripts/test-integration.sh.

- [ ] Write regression tests and run them failing before implementation.
- [ ] Export registerClassroomStudent(input, ip), classroomRegistrationReady(), ensureClassroomRegistrationSchema(executor).
- [ ] Input: token,email,firstName,lastName,studentId,groupName (G1/G2). No client semester ID is trusted.
- [ ] Return {id,name,email,authMethod:'classroom',semesterId,rosterId}, with all IDs real UUIDs.
- [ ] Revalidate active QR/session/deadline under shared session advisory lock and serialize enrollment per semester/student ID. Existing email/name/ID must match; never bind staff/configured professor, never overwrite GitHub or attendance.
- [ ] Persist only an enrollment audit marker; registration does not insert attendance.
- [ ] Apply documented limits using database counters/HMAC keys before matching. Readiness false until schema marker exists; public status has no-store response.
- [ ] Migration and staff migration helper must be equivalent/idempotent, preserve every legacy row, and allow null GitHub fields for email-only users.
- [ ] Test PostgreSQL via npm run test:integration; harness includes all integration test files, serially.

## Chunk 2: Auth and bounded existing services

### Task 2: Scoped classroom sessions
Files: attendance-app/lib/auth/options.ts; attendance-app/lib/auth/session.ts; attendance-app/types/next-auth.d.ts; attendance-app/lib/attendance/service.ts; attendance-app/app/api/admin/bootstrap/route.ts; attendance-app/tests/auth.test.ts; attendance-app/tests/integration/classroom-session.test.ts.

- [ ] Write failing tests for classroom Credentials, JWT separation, staff denial and cross-semester scope.
- [ ] Add provider id classroom with Credentials. authorize delegates to Task 1 and takes the first forwarded IP; no fake GitHub identifiers.
- [ ] Preserve existing GitHub callbacks. Classroom JWT/user/session carries internal UUID + roster/semester IDs + email + explicit authMethod. Clear old provider claims when switching providers.
- [ ] getSessionIdentity accepts legacy GitHub identity or classroom identity with well-formed required UUIDs. requireStaff and requireStaffActor reject classroom identities before any staff membership lookups.
- [ ] Adapt requireActor to resolve scoped roster/user for classroom; recheck not staff/configured professor. Actor subject for rate limits is original githubId for GitHub or classroom:userId:rosterId for classroom. Preserve existing signed permit shape while keying it by actor subject.
- [ ] listSemesters restricts classroom to active scoped semester; getStudentHistory/profile restricts scoped roster/semester; checkIn rejects other semester; activateRoster forbids classroom activation shortcuts; class report checks semester scope.
- [ ] Staff-only ensureCurrentCourseSetup invokes Task 1's migration helper after staff authorization under the existing setup lock. Update nullable-type narrowing in directory/bootstrap, never weaken role checks.
- [ ] Run unit tests, integration suite and TypeScript. Resolve interfaces with Task 1 without editing its owned files.

## Chunk 3: Student UI and end-to-end delivery

### Task 3: QR-first student form
Files: attendance-app/components/classroom-login.tsx; attendance-app/components/check-in-result.tsx; attendance-app/components/profile-form.tsx; attendance-app/app/student/page.tsx; attendance-app/app/report/page.tsx; attendance-app/tests/ui/classroom-login.test.tsx; attendance-app/tests/ui/check-in.test.tsx; attendance-app/tests/e2e/classroom-registration.spec.ts.

- [ ] Add failing UI tests for no-GitHub registration and retained QR token on sign-in/retry.
- [ ] ClassroomLogin props {token:string,onAuthenticated:()=>void}. Read GET /api/classroom/status once; false/error retains GitHub fallback and clear status. Ready form includes name/surname/student ID/group and exactly one email; no OTP/password or email-verification claim.
- [ ] signIn('classroom',{redirect:false,token,email,firstName,lastName,studentId,groupName}) sets signed session; success calls callback so parent retries check-in with original held token. Do not put token/contact info in URL, localStorage or logs.
- [ ] Map generic credentials errors, expiry and conflicts into Albanian. Keep existing GitHub fallback and beginLogin token handoff.
- [ ] Outside class, explain first email-only entry needs the live QR rather than promising bare-email login. Existing signed students see own history/report and saved profile.
- [ ] Add real E2E tests with anonymous browser using QR, faculty/private email, subsequent session, scope/staff denial and preserved old student record. Use existing disposable DB/test professor harness; never create synthetic production students.
- [ ] Run full app tests, lint, production build and browser suite; review entire branch against revised spec.
- [ ] Publish reviewed code using existing project link, invoke staff-only migration on authenticated app, verify readiness and public form/anonymous API protections. Merge/attach PR and verify deployment. Do not export database/SMTP credentials.
