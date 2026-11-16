# Course calendar and navigation

`grading/course-plan.json` owns the 15 teaching dates and course timezone. Run the complete root `npm run build` after changing calendar, weekly materials or course generators.

The final build stages preserve canonical resource bases for complete teaching-source HTML pages, then generate `assets/course-schedule.json` and the identical deployable copy under `attendance-app/lib/attendance/`. The shared date function comes from `shared/course-lifecycle.mjs`; its public and deployable copies must match. Do not edit generated copies directly.

The next scheduled teaching date (including today) is the default focus. An open session takes priority in the professor's QR section. After the final date, the overview explains that the scheduled semester ended while reports and historical materials remain accessible. An already open class links to its projector; a closed class links to its register. Starting a class remains an explicit professor action.

Published presentation labels come from existing web presentations or verified download packages. A generated week plan alone is not advertised as a published presentation. Week 7's lab publication control remains authoritative. The second colloquium is identified as a syllabus plan until an exam implementation is supplied; this change does not create or reset any exam.

Keep older weeks and assessments in labelled history/calendar sections. Do not pin a numbered week or old assessment as the permanent primary action. In-class email/QR registration and optional GitHub preparation must be labelled distinctly.

Verification:

- Root `npm run build && npm test`; generated files must reproduce with `git diff --exit-code` after committing them.
- `python3 scripts/audit-site-links.py` checks complete HTML documents, canonical source bases, local resources, fragment targets, duplicate IDs, language, title and image labels. Email templates and document fragments are not standalone pages.
- Attendance app unit/integration/browser suites cover identity separation, registration, QR, reports and exams.
- Browser `portal-audit.spec.ts` covers the professor overview, historical access, padded action overlap, phone layouts, course discovery, publication status, semester completion and calendar-load failure.
- Browser `direct-materials.spec.ts` checks direct authoring-source entry points without missing styles/scripts.

These checks do not guarantee every external service or personal production login. Use disposable accounts/databases for write flows; do not create test students or start production classes to verify a website change.
