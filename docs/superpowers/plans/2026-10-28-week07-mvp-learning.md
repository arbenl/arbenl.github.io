# Week 7 MVP learning Implementation Plan

> **For agentic workers:** Follow the bounded spec and review the student journey before publication.

**Goal:** Publish interactive Week 7 lecture, understandable 90-minute independent lab and inexpensive technical feedback.

**Architecture:** Data-driven lecture/lab JSON generates the browser decks and two student PPTX files. A focused week module owns the simulated demo and personal case. Extend the existing GitHub checker only for Week 7.

**Tech Stack:** Static HTML/CSS/JS, Node.js builders/tests, Artifact Tool, GitHub Actions.

## Chunk 1: Course package
- [x] Author materials/week-07 lecture/lab JSON, report, guide, interactive simulator and case module.
- [x] Add scripts/build-week07-web.mjs and build-week07-presentations.mjs, integrate build.mjs and build-weekly-guides.mjs.
- [x] Export, inspect every slide and validate two PPTXs. Update materials/manifest.json.
- [x] Test variant determinism, negative demo states, controls, links, weekly policy and mobile/projector layout.

## Chunk 2: Feedback and delivery
- [x] Add Week 7 evidence checks and tests in scripts/check-mobile-submission.cjs and tests/mobile-submission.test.cjs. Keep other weeks and workflow settings intact.
- [ ] Exercise a synthetic valid submission and recheck. No real student submissions touched.
- [ ] Publish both repositories after review, confirm CI and live links/download hashes.
