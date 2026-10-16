# Java 6 · RideShare si PWA dhe lexim pa internet

Continue the established, owner-approved weekly format and canonical URL /lendet/2026-2027/mobile/java-06/. Date 22.10.2026. Lecture 45 minutes per group; lab 90 minutes, with submission begun at minute 65 and 25 minutes for feedback/corrections. Rose accent already assigned to week 6; keep navigation identical to weeks 4–5. Student materials contain no private professor notes.

## Teaching outcome
Students distinguish installation metadata, a service worker, a cached public snapshot and the authoritative Neon/PostgreSQL data. They can explain a cached list's timestamp and why seeing a ride offline cannot confirm a booking. Reuse week 5 identity/permissions unchanged; booking stays simulated, not a new database feature.

## Deliverables
Two browser projector decks and two editable PPTX decks; a guided lab with complete copyable code, explanation before each snippet and explicit A→B handoffs; a populated-report template; a professional infrastructure illustration; an interactive, keyboard-usable animation embedded in both decks and the lab, with play/pause, step/reset, online/offline/reconnected scenarios and reduced-motion support. Label simulation clearly. Separate GitHub→Vercel deployment from Phone→Service Worker→Vercel/Next.js→Neon/PostgreSQL runtime; browser cache belongs on the phone.

## Real lab implementation
Use existing Next.js src/ layout and public trip helper lexoUdhetimet(). Add a public JSON GET route selecting the already-public ride fields, app manifest, two PNG icons, a small client registration component and a standalone offline.html. A scoped root service worker pre-caches only that offline document/icons, uses network-first for the exact public JSON route, records saved time and labels fallback cached responses. Failed navigation to / or /offline.html can return the offline document. Never cache auth, panel, credentials, POST/actions, arbitrary responses or Next.js authenticated HTML. Never claim booking success offline; the offline reader has an explicitly disabled booking control and a manual refresh when connection returns. Support first visit without cached data, database outage and actual offline reload. No new dependencies or credentials; localhost or HTTPS required. Warn that online indicators are only hints, caches can be evicted, first visit needs internet, install UX varies by browser and device.

## Submission
Same personal repository, java-06.md at root, application code in existing application folder. Same issue form selecting Java 6, Commit→Push, read bot comment, fix→Push→rikontrollo on same issue. Extend existing deterministic checker to validate report sections and PWA file paths using a single recursive tree read; no AI, cloud credentials or student-code execution. Label technical checks separately from academic points (up to 3).

## Verification
Run actual supplied code in a disposable Next.js fixture with mocked public trips (no live credentials), production build, real service worker in Chromium: online warm, offline reload with saved timestamp, empty cache, stale data recovery, no writes/auth caching and mobile widths. Test animation scenarios, play/pause/reset, projector keyboard controls, copy buttons and responsive overflow. Validate PPTX packages, slide count, fonts and all renders; preserve AAB logo. Build twice to prove generated files stable, run portal tests and checker tests, publish with GitHub checks and verify live links/hashes.
