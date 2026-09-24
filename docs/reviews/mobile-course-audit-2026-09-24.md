# Mobile 2026/2027 — course audit, 24 September 2026

Scope: the student course portal, weekly materials, submission instructions/checker, professor entry, registration and QR attendance. Tested with synthetic identities and disposable databases. No live classroom QR window was opened and no real attendance record was changed during this audit.

## Findings and corrections

1. **Weekly navigation stopped at week 2.** All 15 weeks now have a consistent home, with work outcomes, steps, checks and submission instructions. Weeks 3–15 are explicitly work plans; their lecture decks are not represented as finished. A week selector reduces scrolling and old homepage bookmarks lead to the current course pages.
2. **First-time registration was easy to miss.** Students can prepare their profile before class or during the first QR scan. Registration requires their signed-in GitHub account and does not record attendance. Later scans reuse the profile. The course and student-history pages explain this distinction.
3. **An open class could look like an absence.** Student history now shows an open registration window as pending, and excludes it from absence totals until it closes. Recorded attendance includes its timestamp. Network failures offer a retry action.
4. **Homework submission accepted only weeks 1–2.** The same form now accepts weeks 1–15. Students use their personal repository and one submission per week. Later weeks require a completed report and Next.js package metadata. Feedback tells students exactly what is missing and how to recheck their existing submission.
5. **Repeated checks wasted work.** Results for the same repository, week, commit and checker version are reused. New revisions invalidate the cache. The checker uses no AI calls and executes no student code. It checks ownership and rejects private repositories, arbitrary hosts and invalid paths.
6. **Older syllabus links contradicted the beginner workflow.** Removed current-course routes to the previous year's topic reservations and clarified optional templates, the AI note inside the weekly report, and the single three-step submission process.
7. **Projector mode was awkward for phone reading.** Lecture/exercise pages now open as readable full content on narrow screens and retain explicit projector controls. Desktop lecture progression was checked through all 22 slides and exercises through all 12 steps.
8. **The RideShare demonstration did not explain its state changes.** Rebuilt it around Arta the passenger and Dreni the driver, with three visible stages and a short explanation beside each screen. Pending, accepted, rejected and no-seat cases are explicit. Acceptance changes available seats from two to one; pending and rejection do not.
9. **Attendance checks were not reproducible in hosted CI.** Added the missing dependency lockfile and a bounded classroom CI workflow, including production-mode test-auth guards and disposable-database tests.

## Verified behavior

- Professor entry goes to the protected attendance application. Staff access requires both the configured professor GitHub ID and the database staff role; being able to click a public navigation link does not grant access.
- Student profiles are account-bound; students cannot request another student's history using query parameters.
- New registration is allowed only for the current active course; archived/unrelated semesters cannot be enrolled through the new preparation path.
- QR expiry is checked on the server; duplicate scans create one attendance record. A profile alone cannot check in.
- Students are denied staff pages and staff read/write APIs. Staff corrections retain an audit reason and actor.
- QR pixels are checked against the issued token in browser tests. Live counts recover after a polling failure.
- Presentation download links resolve to the expected files. The week-1 student deck contains no speaker-note parts.
- Course pages, guides and demo have no horizontal page overflow at the tested phone widths.

## Validation

- 11 portal/navigation/material checks.
- 60 attendance unit/UI tests.
- 36 database-backed attendance integration tests.
- 9 homework checker tests; repository CI and topic-claim checks passed before merge.
- Production attendance build and lint passed. Production-dependency audit reported zero advisories at the time of this check.
- Classroom/browser suite covers three attendance phone widths, four course viewport widths, and the demo on phone and desktop. Final hosted result and screenshot artifacts are linked with the release evidence.

Local Docker was unresponsive and the installed libpq tools lacked a PostgreSQL server, so the database and full browser suites ran on isolated GitHub runners. The in-app browser's phone screenshot scaling was unreliable; use the hosted Playwright screenshots for phone visual evidence. Desktop browser screenshots and DOM width measurements were also inspected.

## Remaining limits — do not describe these as complete

- The homework checker gives technical submission feedback, **not automatic quality grades**. It does not run student applications, assess originality, or produce the semester's accumulated gradebook. Weekly point publication still needs a defined rubric and grading implementation.
- Weeks 3–15 have work guides and templates, not completed lecture presentations.
- Institutional holiday dates and final correction deadlines require confirmation. The current dates remain the planned weekly calendar.
- Registration email is student-supplied, not ownership-verified. Saving it does not automatically grant Google Drive access.
- A rotating QR with a short window cannot prove physical presence if someone shares it live. The professor's displayed roster/count supports classroom verification; it is not a physical-location guarantee.
- Browser tests use synthetic authenticated sessions, not a fresh live GitHub OAuth consent flow for every student/device. No claim is made that every browser or campus network was tested.

## Release references

- Course change: https://github.com/arbenl/arbenl.github.io/pull/22
- Homework change: https://github.com/arbenl/arbenl-mobile-assignments-2025/pull/220 (merged as ae10d28b4892ce1db63a072cbfb62d4a7e3cb750).
- Course home: https://arbenl.github.io/lendet/2026-2027/mobile/
- Demonstration: https://arbenl.github.io/lendet/2026-2027/mobile/demo/rideshare/
- Professor: https://aab-mobile-attendance.vercel.app/staff
