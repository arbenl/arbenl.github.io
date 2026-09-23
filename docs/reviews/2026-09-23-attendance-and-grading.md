# Audit: Mobile attendance and assessment — 23 September 2026

## Attendance findings and implemented changes

The schedule was already generated, but staff had to scroll past semester/roster management, select a session, enter a reason, open check-in and open a separate projector. The course page's general attendance link led to student history, not a teacher QR. Those are distinct audiences.

Implemented: stable teacher links `/staff/qr?week=2&kind=lecture` and `kind=lab`, linked from all 15 course weeks and the staff dashboard. Week 1 has no lab. A staff-authenticated client POST resolves only the configured course, week and G1, opens the existing session and renders the QR/live list. OAuth preserves week/kind. Opening records a system-generated audit reason; corrections/cancellation still require an explanation. Concurrent/repeated launches return the same session and deadline. Closed, expired, cancelled or archived sessions cannot restart. GET rendering does not mutate attendance. Routine setup no longer deletes archived pilot records.

Student identity, roster validation, short-lived rotating tokens, per-session deduplication and server-side expiry remain in force. The initial roster still needs real student IDs/names; those cannot be inferred from the calendar. The schedule currently uses Thursday 16:30 lectures and 18:30 labs in G1; this change does not claim independent confirmation of holiday exceptions or lab time. A QR screenshot relayed immediately can still allow remote check-in; the live count/list supports an in-room audit but is not proof of physical location.

## Assignment audit

Inspected `arbenl-mobile-assignments-2025/scripts/auto-grade-submissions.js`, daily merge/grading workflow, and the Mobile portal rubric.

- Existing grader consumes `SUBMISSIONS_2026.md` and writes `EVALUATIONS_2026.md` for **Cloud/MCC**, not these Mobile weekly projects.
- It scores public repository metadata, README length/keywords, file presence, demo reachability and commit count. It labels scores preliminary. It does not execute or verify application behavior; those scores must not become Mobile grades.
- Mobile portal promises 10 assignments × 3 points but has no active per-week official grading/submission pipeline or personal grade integration. Keep this status explicit.
- Existing daily workflow scans open PRs and metadata periodically; doing this for every mobile push would create unnecessary work. Leave the existing MCC workflow and instructor-managed grades unchanged.

## Proposed low-quota assessment contract

Use ordinary GitHub Actions with instructor-owned behavioral tests; no LLM API calls for routine submissions. Tests should exercise equivalent business capabilities, not require a restaurant domain from every student. Publish exact routes/selectors or a small adapter interface before each assignment.

For each of the 10 assignments publish three observable criteria worth one point each, test cases, fixtures, due time, retry policy and rubric version. The existing course plan assigns tasks to weeks 2, 3, 4, 5, 6, 8, 9, 10, 12 and 14; task numbers differ from week numbers. PRD/business fit and oral understanding require human judgment and should remain in the existing project/defense assessment, rather than fake keyword-based automatic grading.

One repository per student, one PR per assignment. Once registered, store the immutable GitHub user ID ↔ roster mapping privately. Accept submissions through an authenticated course form (assignment + PR URL); check repository ownership/access and pin the actual commit SHA. Do not use student-supplied names or arbitrary public score JSON as authority.

Run fast input/contract checks first. Run behavioral tests only for valid new submissions. Cache dependencies by lockfile, cancel superseded runs, set runner/time limits, and deduplicate by `(student, assignment, commit SHA, rubric version)`. Exclude attendance credentials and production data; run untrusted student code in a disposable runner with no write token or application secrets. Never use `pull_request_target` to execute student code with privileged credentials. Instructor-owned tests and score aggregation must be outside student write control. A test failure earns the criterion's defined score; installation outages/timeouts require an infrastructure-error result and retry, not an automatic zero.

Output: per-criterion earned/max points, failing expectation, actionable Albanian feedback, commit SHA, rubric version and timestamp. A separate trusted job validates results and writes them to private storage after verifying the run/repository/commit. Do not trust a student-modifiable workflow's success or score artifact for official marks. Expose each student's grades only to that student and staff. Deduplicate retries; sum one accepted result per assignment. Publish the cumulative total after the agreed deadline, not from a public CSV containing identities.

## Scope delivered vs remaining

Delivered: direct attendance QR flow, course-page links, administration folding, regression tests, and student instructions at `materials/mobile-submission-guide.md`.

Remaining before official Mobile grading can be advertised as active: publish 10 assignment contracts/tests against actual starter apps; configure an instructor-controlled runner/repository and submission identity flow; agree deadlines/retries; store verified results and show the personal total. No student has been assigned or changed a grade by this audit. The attached guide marks future features explicitly.

References: [GitHub Actions security](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions), [autograding documentation](https://docs.github.com/en/education/manage-coursework-with-github-classroom/teach-with-github-classroom/use-autograding). The autograding documentation currently includes a Classroom retirement notice dated August 28, 2026; the proposed pipeline therefore does not depend on Classroom availability.

## Kalendari i 10 detyrave nga plani ekzistues

| Detyra | Java | Data e orës | Tema |
|---|---:|---|---|
| 01 | 2 | 2026-09-24 | Intervistat, PRD, repo dhe publikimi i parë i aplikacionit të biznesit |
| 02 | 3 | 2026-10-01 | Navigimi dhe rrugët e aplikacionit |
| 03 | 4 | 2026-10-08 | Modeli i pronësisë dhe qasja në të dhëna |
| 04 | 5 | 2026-10-15 | Vendimet e qasjes për përdorues të identifikuar |
| 05 | 6 | 2026-10-22 | Politika e cache-it për kërkesat e aplikacionit |
| 06 | 8 | 2026-11-05 | Vendndodhja me leje të përdoruesit |
| 07 | 9 | 2026-11-12 | Përditësimi dhe rikthimi i listës së preferuar |
| 08 | 10 | 2026-11-19 | Zbatimi idempotent i ngjarjeve të databazës |
| 09 | 12 | 2026-12-03 | Validimi i rezervimit pa besuar të dhënat e klientit |
| 10 | 14 | 2026-12-17 | Kushtet e publikimit të versionit |

Data e orës nuk është afati i dorëzimit. Në `grading/course-plan.json`, e diela 23:59 mbetet `proposed`; pushimet institucionale presin konfirmim.

## Candidate behavioral rubric (proposal, not active grades)

Each cell is one point only after passing its published test. Run against the actual app; do not accept disconnected toy functions as proof of integration.

| Task | Criterion 1 | Criterion 2 | Criterion 3 |
|---|---|---|---|
| 01 | Business home loads from clean setup | Main service/item route is reachable | Main action works at 320px without overflow |
| 02 | List → detail navigation works | Unknown item shows a useful not-found state | Back/direct-link navigation preserves expected context |
| 03 | Owner reads their records | Other account cannot read them | Forged ownership on write is rejected |
| 04 | Signed-in user accesses protected feature | Anonymous API access denied | Logout revokes access as specified |
| 05 | Valid install manifest and required assets | Previously cached public route works offline | Private authenticated responses excluded from cache |
| 06 | Granted location updates intended UI | Denied permission has usable fallback | Unavailable location does not break main flow |
| 07 | Optimistic change renders immediately | Server rejection rolls it back | Rapid repeated action stays consistent |
| 08 | New event updates intended record | Duplicate event has no duplicate effect | Out-of-order event respects published version rules |
| 09 | Valid business transaction succeeds | Missing/invalid fields rejected on server | Tampered price/owner/status rejected |
| 10 | Published app acceptance suite passes | Failed tests block configured release path | Release version identifies tested commit |

Infrastructure gates (dependency installation, database fixture setup) are separate from earned points. For task 01, assess PRD/business fit in class; automation cannot judge it honestly. Provide an example passing and failing implementation for each contract before students start. Use shared fixture data without production secrets. Security and cross-user cases use two synthetic test accounts.

Quota estimate: routine scoring uses zero LLM tokens. At N students, R submitted revisions and T runner-minutes per submission, budget N × R × T Actions minutes; this is a planning formula, not a claim of unlimited free hosting. Cancel old revisions and run local checks before submitting. AI may help author tests once, but should not read every repository every week.
