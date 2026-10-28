# Classroom email registration without GitHub or email codes

Status: owner-authorized revision, 28 October 2026. The owner explicitly replaced SMTP/OTP with in-class registration without an email code. No SMTP configuration is needed.

## Contract

A student holding a currently valid classroom QR enters email (faculty or private), first name, surname, student ID and group. NextAuth classroom Credentials authorize revalidates the QR hash, expiry, open state, semester and server deadline inside the enrollment transaction. No bare-email sign-in outside the classroom is provided. GitHub remains supported, and staff authorization remains strictly GitHub-only.

This is classroom-possession authentication, not mailbox verification. A shared QR cannot distinguish classmates who know each other's details. The owner accepts this in-class attendance model. Do not label supplied emails as verified or silently turn this into global email-account recovery.

## Identity and data

Use real internal users.id UUIDs for classroom identities; make GitHub fields nullable for newly enrolled users. Never fabricate GitHub IDs. Classroom JWTs contain authMethod=classroom, userId, rosterId, semesterId and contact email. Reject mixed/forged staff claims and staff/professor-linked rows. Legacy GitHub JWTs and their users remain compatible.

Enrollment requires exact normalized student ID and matching full name (existing e/ë,c/ç matching), plus exact normalized existing contact email when one is already stored. Conflicts are generic and do not create duplicates or replace GitHub identity/email. Imported rows lacking an email can be completed in-class. New rows and users are created together. Serialize on semester/student ID and rely on unique indexes for email/user conflicts. Preserve old roster IDs, attendance, audit and GitHub identities.

Scope classroom sessions to the QR-derived semester and roster. Student history/profile may return only that roster and semester; check-in must refuse a different semester; activateRoster before-class/permit shortcuts are forbidden for classroom identities. Staff access, bootstrap and archived semester listing require real GitHub identity and the existing staff checks. Shared current-course report is allowed only for classroom sessions enrolled in that semester. Registration itself grants no attendance; normal check-in still checks the original live token.

## Backend and rollout

New classroom-registration module owns transactional enrollment, readiness, generic errors and unauthenticated rate limits. Throttle by IP/session (300 attempts per ten minutes to support campus NAT) and normalized email/student-ID/session (10 per ten minutes), with HMAC keys and no raw token logging. Error messages never include contact details of another student. Use NextAuth CSRF handling and encrypted JWT/HttpOnly cookie.

An additive migration drops NOT NULL only from GitHub fields and creates classroom_registrations as an audit/readiness marker table. Legacy digit checks/unique GitHub index remain. A staff-only serialized course setup can apply the same migration idempotently. Public readiness returns false until migration exists, without granting DDL permissions to students. Deployment before migration leaves GitHub functional. No credentials export or production synthetic records are permitted.

## UI

Check-in captures/removes the fragment token as before. On a 401, show the classroom registration form with one email field and no email code/password. Credentials sign-in returns without redirect; retry the existing check-in with the original token. Preserve GitHub fallback and same-tab QR handoff. If time expires while filling, show the QR-expired action and do not grant retrospective attendance. After successful enrollment the signed browser session permits future QR scans without retyping the profile. Outside class, explain that first entry needs the professor's QR; existing GitHub login remains optional. Keep student reports/history readable with both identity types.

## Verification

Cover private/faculty emails, empty/invalid/malformed fields, nonexistent/expired/closed/cancelled QR, duplicate and concurrent enrollment, current deadline boundaries, e/ë,c/ç, existing GitHub account preservation, email/ID/name mismatch, staff/professor denial, API authentication/CSRF, mixed JWT claims, scope across semesters, no attendance on signup, success after check-in, visiting groups, shared-IP bursts and the legacy test suite. Run full browser flows on 320/375/430px. Verify anonymous APIs remain protected and staff cannot be obtained through classroom credentials.
