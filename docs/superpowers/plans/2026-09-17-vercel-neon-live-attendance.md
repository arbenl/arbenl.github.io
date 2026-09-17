# Vercel Neon Live Attendance Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy a free GitHub-authenticated attendance app where only professor `arbenl` can project rotating QR codes and a live ordered check-in list.

**Architecture:** A standalone Next.js application under `attendance-app/` runs on Vercel. Auth.js uses GitHub OAuth and a signed JWT cookie; Neon Postgres stores roster bindings, class sessions, hashed challenges, attendance and audit records. GitHub Pages links to the Vercel app after the production pilot passes.

**Tech Stack:** Next.js 16, React 19, TypeScript, Auth.js/next-auth 4, PostgreSQL on Neon, Drizzle ORM, postgres.js, Vitest, Playwright, Vercel

**Spec:** `docs/superpowers/specs/2026-09-17-vercel-neon-live-attendance-design.md`

---

## Chunk 1: Application foundation and database

### Task 1: Scaffold the standalone application

**Files:**
- Create: `attendance-app/package.json`
- Create: `attendance-app/tsconfig.json`
- Create: `attendance-app/next.config.ts`
- Create: `attendance-app/eslint.config.mjs`
- Create: `attendance-app/vitest.config.ts`
- Create: `attendance-app/.env.example`
- Create: `attendance-app/app/layout.tsx`
- Create: `attendance-app/app/globals.css`
- Create: `attendance-app/app/page.tsx`
- Create: `attendance-app/lib/env.ts`
- Modify: `.gitignore`

- [ ] **Step 1: Create the pinned package manifest**

Pin exact runtime dependencies: Next `16.3.5`, React and React DOM `19.3.0`, `next-auth` `4.24.15`, `drizzle-orm` `0.45.2`, `postgres` `3.4.9`, Zod `4.6.5` and QRCode `1.5.4`. Pin exact development dependencies: `drizzle-kit` `0.31.10`, TypeScript `5.9.3`, ESLint `9.39.5`, `eslint-config-next` `16.3.5`, Vitest `5.0.1`, `@playwright/test` `1.63.0`, `tsx` `4.23.13`, `@testing-library/dom` `10.4.2`, `@testing-library/react` `16.3.3`, `@testing-library/user-event` `14.6.7`, `jsdom` `30.1.0`, `@types/node` `22.20.3`, `@types/react` and `@types/react-dom` `19.3.0`, and `@types/qrcode` `1.5.6`. Add scripts for `dev`, `build`, `lint`, `test`, `test:integration`, `test:db`, `test:e2e`, `db:generate` and `db:migrate`. Configure `vitest.config.ts` so the default unit run includes jsdom UI tests but excludes `tests/integration`, `tests/e2e` and SQL tests; each database-backed suite has its own harness.

- [ ] **Step 2: Add configuration validation**

Create `attendance-app/lib/env.ts` with a Zod schema for `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `GITHUB_ID`, `GITHUB_SECRET`, `PROFESSOR_GITHUB_ID` and `RATE_LIMIT_SECRET`, and mirror the complete contract with placeholders in `.env.example`. `NEXTAUTH_URL` and `NEXTAUTH_SECRET` are the next-auth v4 names that implement the spec's generic `AUTH_URL` and `AUTH_SECRET` contract. Never prefix server secrets with `NEXT_PUBLIC_`.

- [ ] **Step 3: Create the minimal accessible shell**

Add Albanian metadata, skip link, responsive container and a disabled-state message. Do not copy the old PIN form.

- [ ] **Step 4: Install and run baseline checks**

Before installing, extend the repository `.gitignore` with `attendance-app/.env*` while allowing `attendance-app/.env.example`, plus `attendance-app/.next/`, `attendance-app/node_modules/`, `attendance-app/test-results/`, `attendance-app/playwright-report/`, `attendance-app/blob-report/`, `attendance-app/.vercel/` and `attendance-app/*.tsbuildinfo`. Verify with `git check-ignore` that a synthetic `.env.local`, `.next` file, incremental build file and Playwright artifact are ignored and `.env.example` is trackable.

Run:

```bash
cd attendance-app
npm install
npm run lint
npm run build
```

Expected: production build succeeds without environment access during static module import; protected routes read validated environment only at request time.

- [ ] **Step 5: Commit the scaffold**

```bash
git add .gitignore attendance-app
git commit -m "Scaffold Vercel attendance app"
```

### Task 2: Define and migrate the attendance schema

**Files:**
- Create: `attendance-app/lib/db/schema.ts`
- Create: `attendance-app/lib/db/client.ts`
- Create: `attendance-app/drizzle.config.ts`
- Create: `attendance-app/drizzle/0000_live_attendance.sql`
- Create: `attendance-app/tests/db/attendance.sql`
- Create: `attendance-app/scripts/test-database.sh`

- [ ] **Step 1: Write failing SQL assertions and a runnable disposable-container harness**

Create `scripts/test-database.sh` first. It must start a disposable PostgreSQL 16 container without publishing a host port, wait for readiness, apply `drizzle/0000_live_attendance.sql`, run `tests/db/attendance.sql`, and always remove the container through a trap. Cover unique GitHub user ID, unique Student ID and user binding per semester, one record per student/session, permitted states/statuses, foreign keys and cascade/restrict behavior. Assert indexes for every foreign-key access path and for the live ordering query.

- [ ] **Step 2: Run the isolated PostgreSQL test**

Run: `cd attendance-app && npm run test:db`

Expected: FAIL with an explicit missing-migration error from the now-runnable harness, because `drizzle/0000_live_attendance.sql` is absent.

- [ ] **Step 3: Implement focused tables and indexes**

Create `users`, `staff`, a singleton `bootstrap_state`, `semesters`, `roster`, `class_sessions`, `qr_challenges`, `attendance_records`, `request_limits` and `audit_log`. `bootstrap_state` permanently records completion of the first-staff bootstrap even if that staff row is later removed. Use database timestamps, UUID primary keys, check constraints and indexes for live session reads. Store only QR hashes.

- [ ] **Step 4: Keep Drizzle schema aligned**

Express the same types, constraints and relations in `schema.ts`; use postgres.js with `prepare: false` for Vercel/Neon compatibility.

- [ ] **Step 5: Run the database suite**

Expected: all assertions pass on a disposable PostgreSQL 16 container with no host port and no real data.

- [ ] **Step 6: Commit the database slice**

```bash
git add attendance-app/lib/db attendance-app/drizzle.config.ts attendance-app/drizzle attendance-app/tests/db attendance-app/scripts/test-database.sh
git commit -m "Add attendance database schema"
```

## Chunk 2: GitHub authentication and attendance domain

### Task 3: Implement GitHub login and server-side roles

**Files:**
- Create: `attendance-app/lib/auth/options.ts`
- Create: `attendance-app/lib/auth/session.ts`
- Create: `attendance-app/types/next-auth.d.ts`
- Create: `attendance-app/app/api/auth/[...nextauth]/route.ts`
- Create: `attendance-app/app/api/admin/bootstrap/route.ts`
- Create: `attendance-app/components/sign-in.tsx`
- Create: `attendance-app/tests/auth.test.ts`

- [ ] **Step 1: Write failing auth-policy tests**

Test numeric GitHub ID parsing, session identity extraction, denial without a session, production cookie flags (`HttpOnly`, `Secure`, `SameSite=Lax`), bootstrap authorization only when `session.githubId === PROFESSOR_GITHUB_ID`, permanent bootstrap closure after `bootstrap_state` exists, and that every later staff decision reads the `staff` table rather than the environment variable.

- [ ] **Step 2: Run the focused test**

Run: `cd attendance-app && npm test -- auth.test.ts`

Expected: FAIL because auth modules do not exist.

- [ ] **Step 3: Configure Auth.js GitHub provider**

Use JWT sessions. In the JWT callback, copy GitHub `profile.id` and `profile.login`; in the session callback expose `githubId` and `githubLogin`. On sign-in, upsert `users` without storing OAuth access tokens.

- [ ] **Step 4: Implement one-time professor bootstrap**

In one transaction, the POST route compares the authenticated GitHub ID with `PROFESSOR_GITHUB_ID`, requires that the singleton `bootstrap_state` row does not exist, inserts that internal user into `staff`, inserts the permanent completion marker and records an audit event. A repeated request is a harmless already-completed response, but it never recreates a removed staff row. Username alone never grants staff, and after completion every authorization check uses only `staff`.

- [ ] **Step 5: Run auth tests and build**

Expected: tests pass and protected pages compile.

- [ ] **Step 6: Commit authentication**

```bash
git add attendance-app/lib/auth attendance-app/types attendance-app/app/api/auth attendance-app/app/api/admin attendance-app/components/sign-in.tsx attendance-app/tests/auth.test.ts
git commit -m "Add GitHub authentication and professor role"
```

### Task 4: Implement pure domain rules

**Files:**
- Create: `attendance-app/lib/attendance/normalize.ts`
- Create: `attendance-app/lib/attendance/challenge.ts`
- Create: `attendance-app/lib/attendance/live-state.ts`
- Create: `attendance-app/tests/attendance-rules.test.ts`

- [ ] **Step 1: Write failing unit tests**

Cover Albanian name normalization, Student ID trim, masked display name, 64-character random token, SHA-256 hashing, the exact 40-second token lifetime capped by the session deadline, retry delays `1,2,4,5`, snapshot replacement and new-entry detection.

- [ ] **Step 2: Run and confirm failure**

Run: `cd attendance-app && npm test -- attendance-rules.test.ts`

- [ ] **Step 3: Implement minimal pure functions**

Keep time as injected `Date` values so tests never sleep. Use Node `crypto.randomBytes(32)` and `createHash('sha256')`.

- [ ] **Step 4: Run focused and full unit tests**

Expected: all pass.

- [ ] **Step 5: Commit domain rules**

```bash
git add attendance-app/lib/attendance attendance-app/tests/attendance-rules.test.ts
git commit -m "Add attendance domain rules"
```

### Task 5: Implement transactional services and route contracts

**Files:**
- Create: `attendance-app/lib/attendance/service.ts`
- Create: `attendance-app/app/api/roster/activate/route.ts`
- Create: `attendance-app/app/api/semesters/route.ts`
- Create: `attendance-app/app/api/semesters/[id]/state/route.ts`
- Create: `attendance-app/app/api/roster/import/route.ts`
- Create: `attendance-app/app/api/class-sessions/route.ts`
- Create: `attendance-app/app/api/class-sessions/[id]/challenge/route.ts`
- Create: `attendance-app/app/api/class-sessions/[id]/live/route.ts`
- Create: `attendance-app/app/api/class-sessions/[id]/state/route.ts`
- Create: `attendance-app/app/api/class-sessions/[id]/records/route.ts`
- Create: `attendance-app/app/api/check-in/route.ts`
- Create: `attendance-app/app/api/records/[id]/route.ts`
- Create: `attendance-app/app/api/semesters/[id]/export/route.ts`
- Create: `attendance-app/tests/integration/attendance.test.ts`
- Create: `attendance-app/scripts/test-integration.sh`

- [ ] **Step 1: Write failing integration tests against disposable PostgreSQL**

Test staff-only management, audited semester state transitions `draft → active → archived`, atomic concurrent roster activation, generic mismatch, cross-group rejection, challenge rotation, 40-second challenge expiry, two-minute cutoff, concurrent duplicate scans producing one record, live ordering, masked response, student isolation, manual creation for a student without a phone, manual correction, semester CSV export and audit. Student semester selection returns only `active` semesters.

- [ ] **Step 2: Implement a single service boundary**

Route handlers validate Zod input and call `service.ts`. The service owns transactions and authorization; routes do not duplicate SQL or role logic.

- [ ] **Step 3: Implement fixed-window rate limits in Postgres**

Use `request_limits(action, key_hash, window_start, count)` with one atomic `INSERT ... ON CONFLICT ... DO UPDATE ... RETURNING` statement. Build `key_hash` with HMAC-SHA-256 using `RATE_LIMIT_SECRET`: activation and scan hash `githubId|firstForwardedIp`; challenge hashes `githubId|firstForwardedIp|sessionId`; live hashes `githubId|firstForwardedIp|sessionId`, which makes the polling limit per professor and session. Never store or log raw IP. Enforce exact limits: activation 5 requests per 600 seconds, scan 10 per 60 seconds, challenge 10 per 60 seconds, and live 90 per 60 seconds. Tests issue concurrent increments at the boundary, assert the first over-limit response is 429 with the exact positive `Retry-After`, inspect stored rows for HMAC values rather than raw IP, and verify staff mutations delete windows older than 24 hours.

- [ ] **Step 4: Keep token handling safe**

Accept the raw token only in the check-in request, hash it immediately and never log it. Use the database clock for acceptance.

The staff-only `POST /api/class-sessions/[id]/records` accepts `rosterId`, `present|rejected|excused` and a mandatory reason to create the missing attendance record for a student without a phone. `PATCH /api/records/[id]` corrects an existing record with a mandatory reason. `GET /api/semesters/[id]/export` streams a staff-only CSV whose formula-capable cells are escaped and whose rows are covered by the same authorization tests.

The staff-only `PATCH /api/semesters/[id]/state` applies only the explicit `draft → active → archived` transitions and records an audit reason. Archived semesters are retained for evidence and excluded from the student activation list; they are never deleted ad hoc.

- [ ] **Step 5: Run integration and full tests**

Create `scripts/test-integration.sh` to start disposable PostgreSQL 16 bound to a random loopback port, wait for readiness, apply the reviewed migration, export its temporary `DATABASE_URL`, run only `tests/integration`, and always remove the container in a trap. Run:

```bash
cd attendance-app
npm test
npm run test:integration
npm run test:db
```

Expected: all unit, integration and schema tests pass.

- [ ] **Step 6: Commit services and routes**

```bash
git add attendance-app/lib/attendance/service.ts attendance-app/app/api attendance-app/tests/integration attendance-app/scripts/test-integration.sh
git commit -m "Implement secure QR attendance API"
```

## Chunk 3: Student and professor interfaces

### Task 6: Build the student activation and scan flow

**Files:**
- Create: `attendance-app/app/student/page.tsx`
- Create: `attendance-app/app/student/activate/page.tsx`
- Create: `attendance-app/components/profile-form.tsx`
- Create: `attendance-app/app/check-in/page.tsx`
- Create: `attendance-app/components/check-in-result.tsx`
- Create: `attendance-app/app/api/student/history/route.ts`
- Create: `attendance-app/tests/ui/check-in.test.tsx`
- Create: `attendance-app/tests/ui/student-history.test.tsx`
- Modify: `attendance-app/lib/attendance/service.ts`
- Modify: `attendance-app/tests/integration/attendance.test.ts`
- Modify: `attendance-app/app/globals.css`

- [ ] **Step 1: Add the first-time form**

Ask the student to select the semester, then enter first name, last name and Student ID. Explain that the values must match the official roster. QR links use `/check-in#token=...`, so the raw token never reaches HTTP logs. Read the fragment into React memory and immediately call `history.replaceState`. When GitHub login is required, keep the token only in same-tab `sessionStorage` with a two-minute timestamp, return to `/check-in` without a token in the callback URL, then read-and-delete the temporary value into React memory before any API call. Never use `localStorage`, cookie or query string for the token.

- [ ] **Step 2: Make check-in automatic after authentication and activation**

The check-in page sends one POST, shows a pending state, then displays confirmed success or the server error. If the authenticated student is not linked, render the semester/profile form inline on `/check-in` without navigation; the raw token remains only in React memory. After successful activation, immediately resume the POST if the token is still valid. Refreshing during this inline step intentionally loses the token and asks for a fresh scan. Remove the raw token from browser history and clear all temporary state after success or terminal error. The standalone `/student/activate` page supports pre-activation without holding a QR token.

- [ ] **Step 3: Add the student's semester history**

Add the history query to `lib/attendance/service.ts`. Implement `GET /api/student/history` as a thin handler that derives the internal user from the server session and calls that service; it accepts no user ID from the client. Show only that student's lecture/lab sessions, statuses and totals. Extend `tests/integration/attendance.test.ts` and the UI test to prove that changing client parameters cannot reveal another student's rows.

- [ ] **Step 4: Verify mobile behavior**

At 320, 375 and 430 CSS pixels, forms and results must fit without horizontal scrolling; controls are at least 44 CSS pixels high.

- [ ] **Step 5: Test token lifecycle, activation resume, history isolation and mobile layout**

In `tests/ui/check-in.test.tsx`, use jsdom and fake timers to assert fragment capture and immediate URL removal, same-tab two-minute login storage, deletion after callback, absence from localStorage/cookies/query strings, inline activation resume and expiry requiring a fresh scan. In `tests/ui/student-history.test.tsx`, assert rendering of only the authenticated student's response. Component style assertions cover 44-pixel controls; Playwright in Chunk 4 performs the authoritative 320/375/430 overflow checks.

- [ ] **Step 6: Run lint, unit tests and build**

Expected: all pass.

### Task 7: Build the staff dashboard and projector

**Files:**
- Create: `attendance-app/app/staff/page.tsx`
- Create: `attendance-app/components/semester-admin.tsx`
- Create: `attendance-app/components/session-admin.tsx`
- Create: `attendance-app/app/staff/project/[sessionId]/page.tsx`
- Create: `attendance-app/components/live-projector.tsx`
- Create: `attendance-app/tests/ui/projector.test.tsx`
- Modify: `attendance-app/app/globals.css`

- [ ] **Step 1: Add staff-only administration**

Create semester, activate/archive semester with an audit reason, atomic roster import, class-session creation, close/cancel, reasoned corrections and CSV export. Every server response rechecks staff.

- [ ] **Step 2: Add the projector layout**

Use a two-column wide layout: rotating QR and countdown on the left; ordered list and total on the right. Stack on narrow screens. The projector response and view show masked names only. The private staff session view calls the staff-only records endpoint and shows full name, Student ID and GitHub username.

- [ ] **Step 3: Poll full live snapshots**

Poll full live snapshots every second while healthy. Request a new challenge every 25 seconds only while the server snapshot is open, never display it after `checkinEndsAt`, and compute both QR expiry and the two-minute countdown from `serverTime` rather than the browser clock. On snapshot failure, fade the last list, label it stale, retry after 1, 2, 4 seconds and then every 5 seconds until recovery; replace the full snapshot after recovery.

- [ ] **Step 4: Freeze only after a confirmed closing snapshot**

If the final request fails, show `Check-in u mbyll — rilidhu për totalin` instead of a final count.

- [ ] **Step 5: Add visible anti-sharing guidance**

Display: `Mos e shpërndani QR-në. Çdo hyrje shfaqet live dhe regjistrohet me kohën e serverit.`

- [ ] **Step 6: Test projector timing and confirmed closure**

In `tests/ui/projector.test.tsx`, use fake timers and mocked Route Handler responses to verify challenge refresh at 25 seconds, token display capped by the earlier of challenge expiry and `checkinEndsAt`, server-time countdown, 1/2/4/5/5 retry timing, full-snapshot replacement, masked projector rows, private staff fields and the unconfirmed-close message.

- [ ] **Step 7: Build and test**

From the repository root run `cd attendance-app && npm run lint && npm test && npm run test:integration && npm run test:db && npm run build`. Expected: UI, unit, integration, database, lint and production build pass.

- [ ] **Step 8: Commit both interfaces**

```bash
git add attendance-app/app attendance-app/components attendance-app/lib/attendance/service.ts attendance-app/tests/integration/attendance.test.ts attendance-app/tests/ui attendance-app/app/globals.css
git commit -m "Build student and live projector attendance UI"
```

## Chunk 4: End-to-end test and deployment

### Task 8: Add deterministic end-to-end coverage

**Files:**
- Create: `attendance-app/playwright.config.ts`
- Create: `attendance-app/tests/e2e/attendance.spec.ts`
- Create: `attendance-app/app/api/test/session/route.ts`
- Create: `attendance-app/scripts/test-e2e.sh`

- [ ] **Step 1: Add a test-only session route**

Enable it only when `E2E_TEST_AUTH=1` and `VERCEL` is absent. It issues a signed test session for synthetic GitHub IDs. Return 404 in every production configuration.

- [ ] **Step 2: Test the complete browser flow**

Create a synthetic professor and two students, import roster, activate one profile, project QR, scan, see rank 1 and total 1, repeat scan without duplication, reject expired token, deny student staff routes, simulate live fetch failure/recovery and verify audit correction.

- [ ] **Step 3: Test mobile viewports**

Run the student flow at 320×700, 375×812 and 430×932. Assert no document-level horizontal overflow.

- [ ] **Step 4: Run all local checks**

Implement `scripts/test-e2e.sh` as the `test:e2e` script. It starts disposable PostgreSQL 16 on a random loopback port, applies the migration, exports a temporary `DATABASE_URL`, synthetic OAuth/session secrets, `E2E_TEST_AUTH=1` and no `VERCEL`, starts the production Next server on an unused loopback port, waits for readiness, runs Playwright against that URL, and removes both processes/container in a trap. The script must fail if the test-session route is unavailable in this local mode or available when `VERCEL=1`.

```bash
cd attendance-app
npm run lint
npm test
npm run test:db
npm run build
npm run test:e2e
```

Expected: every check passes before any production deployment.

- [ ] **Step 5: Commit end-to-end tests**

```bash
git add attendance-app/playwright.config.ts attendance-app/tests/e2e attendance-app/app/api/test attendance-app/scripts/test-e2e.sh
git commit -m "Test live attendance end to end"
```

### Task 9: Provision GitHub OAuth, Vercel and Neon

**Files:**
- Runtime configuration only; never commit credentials.

- [ ] **Step 1: Log in to Vercel**

Run `vercel login --github` and complete the browser authorization as `arbenl`.

- [ ] **Step 2: Create the Vercel project from `attendance-app/`**

From the repository root run `cd attendance-app`, then `vercel link --yes --project aab-mobile-attendance`. Confirm `.vercel/project.json` points to that project and remains ignored. Run every later Vercel command from `attendance-app` (or with `--cwd attendance-app`) and capture the production URL.

- [ ] **Step 3: Provision Neon Free through Vercel Marketplace**

Create a dedicated database named for attendance, region EU, and connect it only to this Vercel project. Assign the Neon integration's `DATABASE_URL` explicitly to Production and Preview in the Vercel dashboard. Do not pull the production value into a repository file. If a development connection is needed, run `vercel env pull .env.local` only from `attendance-app`; `.env.local` must be ignored and is never used as evidence that Production is configured.

- [ ] **Step 4: Create the GitHub OAuth app**

Homepage: the Vercel production URL. Callback: `<production-url>/api/auth/callback/github`. From `attendance-app`, add client ID and secret specifically with `vercel env add GITHUB_ID production` and `vercel env add GITHUB_SECRET production`; repeat for Preview only if preview OAuth is intentionally configured.

- [ ] **Step 5: Set remaining secrets**

Generate `NEXTAUTH_SECRET` and `RATE_LIMIT_SECRET` with separate `openssl rand -base64 32` calls, set each with `vercel env add <NAME> production` from `attendance-app`, set `NEXTAUTH_URL` for Production, and obtain `PROFESSOR_GITHUB_ID` with `gh api user --jq .id` before adding it to Production. Confirm only variable names and targets with `vercel env list production`; do not print, pull or commit secret values.

- [ ] **Step 6: Apply the reviewed migration and deploy**

Open the dedicated Neon project's SQL Editor, paste the exact reviewed contents of `attendance-app/drizzle/0000_live_attendance.sql`, execute it once, and run the plan's schema assertions there or through a temporary, untracked connection shell. Then, from `attendance-app`, run `vercel --prod`. Verify the deployment is linked to `aab-mobile-attendance`, contains the intended Git commit and has all required Production variable names before testing it.

### Task 10: Run the real pilot as professor `arbenl`

- [ ] **Step 1: Sign in with GitHub and bootstrap staff**

Expected: `arbenl` becomes staff and a repeated bootstrap returns the harmless already-completed result. Do not remove the only production staff row. Permanent closure after role removal and nonstaff denial remain production-equivalent evidence from the local integration/E2E suites because the production test-auth route must stay unavailable.

- [ ] **Step 2: Use synthetic course data**

Create a 15-week semester and import 2–5 fake students, including one synthetic roster row reserved for the professor's own GitHub identity during the pilot, then open one lecture session. Do not upload real student data.

- [ ] **Step 3: Project and scan**

In one browser profile open the staff projector. In a second isolated browser profile, authenticate with the same controlled `arbenl` GitHub account, bind it only to the reserved synthetic pilot roster row and scan the QR. Verify ordered masked name, timestamp, total, duplicate handling and automatic closure. Close the pilot session, then use the reviewed semester-state endpoint to archive the clearly titled `[PILOT SYNTHETIC]` semester with an audit reason. Retain its synthetic rows as test evidence; archived semesters are excluded from active teaching selections. The local E2E suite separately proves nonstaff denial and student isolation with synthetic identities.

- [ ] **Step 4: Verify production security**

Confirm the test-auth route returns 404, headers protect cookies, raw QR tokens do not appear in server logs, and database credentials never reach browser bundles. Do not treat the pilot's `arbenl` scan session as a nonstaff authorization test because that identity is staff; use the passing integration/E2E denial tests as the required evidence for student isolation and staff-only live-list access.

- [ ] **Step 5: Run the mobile audit**

Use authenticated Playwright device emulation for the student flow. Use the existing nonpersistent WebKit script only for public/unauthenticated layout checks, with explicit commands such as `xcrun swift scripts/mobile-audit.swift "$PRODUCTION_URL/check-in" /tmp/attendance-320 320 700`, repeated for `375 812` and `430 932`. Assert the generated JSON has `horizontalOverflow: false`; do not claim this Swift script tests authenticated state. Record only pass/fail diagnostics with synthetic data.

### Task 11: Link the tested app from GitHub Pages

**Files:**
- Modify: `attendance.html`
- Modify: `index.html`
- Modify: `src/portal.js`
- Modify: `docs/attendance-deployment.md`
- Modify: `docs/mobile-audit.md`
- Modify: `docs/site-audit.md`

- [ ] **Step 1: Replace the disabled page only after the pilot passes**

Make `attendance.html` a static GitHub Pages redirect to the exact tested Vercel production URL using an immediate standards-based meta refresh, canonical link and visible fallback link. Update all portal check-in links to the same production URL. Test the redirect target and fallback link.

- [ ] **Step 2: Remove obsolete Supabase instructions from the active path**

Keep historical migrations only if needed for audit, but mark them unused. Document Vercel, Neon, GitHub OAuth, deployment and correction procedures.

- [ ] **Step 3: Build and test both projects**

```bash
npm run build
npm test
cd attendance-app
npm run lint
npm test
npm run test:integration
npm run test:db
npm run build
npm run test:e2e
```

Expected: all checks pass.

- [ ] **Step 4: Commit and push**

```bash
git add .gitignore attendance.html index.html src/portal.js docs/attendance-deployment.md docs/mobile-audit.md docs/site-audit.md docs/superpowers/specs/2026-09-17-vercel-neon-live-attendance-design.md docs/superpowers/plans/2026-09-17-vercel-neon-live-attendance.md attendance-app
git diff --cached --name-only
git commit -m "Publish Vercel live attendance"
git push -u origin HEAD
```

Before committing, require `git diff --cached --name-only` to contain only the listed attendance files, no `.env*` except `.env.example`, no `.vercel`, `.next`, `test-results`, Playwright reports or unrelated presentation artifacts. Unstage anything outside that list.

- [ ] **Step 5: Open and merge a focused PR**

The PR must state the login method, synthetic pilot evidence, production URL, security limits and validation commands. Merge only the reviewed commit set, then verify GitHub Pages no longer shows the disabled Supabase message.
