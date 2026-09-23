# Course and academic-year navigation

## Structure

- `/`: searchable course catalogue, year filter, links to year pages.
- `/vitet/YYYY-YYYY/`: courses belonging to one academic year.
- `/lendet/2026-2027/mobile/`: published Mobile materials and 15-week navigation.
- `/lendet/2026-2027/mobile/java-02/`: week 2 lecture/exercise landing page.
- `/lendet/2026-2027/mobile/lectures/`: student PowerPoints without private notes.
- `/lendet/2026-2027/mobile/templates/`: course-specific templates.
- `/lendet/2026-2027/mobile/demo/`: teaching prototypes.
- `/lendet/2026-2027/mobile/syllabus.html`: preserved complete course content and profile.
- `/lendet/2025-2026/mccc/`: links to existing MCC 2026 source pages. The syllabus explicitly identifies academic year 2025/2026.
- `/lendet/2026-2027/mccc/`: reserved, clearly unpublished new-year course. No Mobile content or prior-year submissions are relabelled as MCC 2026/2027.
- `/mccc2026-2027/`: short alias for the new MCC space requested by the instructor.
- `/profesor.html`: public navigation to authenticated staff QR endpoints, not a staff authorization boundary.
- `/profili.html`: professor profile entry point.

## Findings and scope

The previous 1,390-line homepage combined a professor profile, one complete Mobile course, downloads, setup, 15 weeks, rules and staff links. There was no academic-year selector. MCC appeared only as an archive link to another repository. Week pages under `/materials/java-02/` had no course/year in their URLs. Lecture slides and practical activities were difficult to distinguish at the catalogue level. New navigation provides explicit year/course context and separate lecture, exercise and staff actions.

This is a structural review of the public portal, Mobile material pages and MCC course entry points. No historical student submissions, grades, or attendance records are migrated or modified. MCC source pages remain in their existing repository, preserving reservation and grading workflows.

## Authoring and builds

Edit canonical files under `lendet/<academic-year>/<course>/`; never add private teacher notes to this public repository. `scripts/build-catalog.mjs` generates the catalogue, year pages, course landing pages and staff link list. Course definitions are in its `courses` array; Mobile week metadata comes from `grading/course-plan.json`, and presentation paths/hashes from `materials/manifest.json`. Run `npm run build` after changes. Add the next year as new paths; do not overwrite prior-year cohorts. Only mark materials published when actual files exist.

`docs/legacy-material-routes.json` records migration routes. Old HTML pages are small redirects with a clickable fallback; JavaScript preserves query and hash before the delayed meta-refresh fallback. Old PPTX, Markdown, image and ZIP downloads are retained for links already shared. When replacing a download, update its canonical file and any compatibility copy deliberately, then update its manifest hash. Old homepage anchors route to the preserved syllabus (profile to the profile page).

## Verification

`npm test` checks presentation hashes, absence of notes for lecture 1, all generated local links/assets/anchors, old week-2 redirect, MCC separation, and all 43 staff session links. Browser verification covers catalogue search/year selection, week-2 navigation, old URL redirects and responsive layout. Attendance authentication remains enforced by the existing Vercel application; no real check-in session should be opened during UI verification.
