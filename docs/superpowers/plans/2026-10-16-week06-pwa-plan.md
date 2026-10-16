# Week 6 PWA Implementation Plan

> **For agentic workers:** Implement inline with superpowers:executing-plans. Steps use checkbox syntax for tracking. Continue the owner's authorized creation and publication workflow.

**Goal:** Publish clear week 6 lecture, 90-minute lab and infrastructure animation at the existing course URL.
**Architecture:** Authored slide JSON generates browser/PPTX decks. A standalone accessible animation illustrates deployment and runtime separately. Complete lab snippets form a real, narrowly cached Next.js offline reader. The existing submission bot performs deterministic file/report checks.
**Tech Stack:** HTML/CSS/JavaScript/SVG, Next.js App Router, service worker Cache API, artifact-tool, Playwright, Node test runner.

## Chunk 1: Create, prove and publish the week

- [x] Write an actual-example test harness at attendance-app/scripts/test-week06-example.mjs. Extract snippets, build disposable Next.js app, serve public fixtures with changeable trips, verify offline reload/missing snapshot/reconnection and no private caching. First run must fail while example source is absent.
- [x] Create materials/week-06/example-files.json with manifest, public JSON route using existing lexoUdhetimet, Pwa component, root layout, public/sw.js and public/offline.html. Generate supplied PNG icons. No library/secret changes.
- [x] Create lecture-slides.json (about 20 slides) and lab-slides.json (about 14). Lecture teaches decisions through prediction and infrastructure; lab gives observable checkpoints and submission by minute 65.
- [x] Create infrastructure.html, infrastructure.js, week-06.css and an infrastructure.svg. Three selectable scenarios, explicit simulation label, pause/next/reset, readable explanations and reduced motion.
- [x] Generate guide/index/projector HTML from sources using scripts/build-week06-web.mjs; include code explanations, A–F handoffs, three tests, report and GitHub feedback. Extend build-weekly-guides.mjs and build.mjs to preserve canonical generated pages.
- [x] Extend submission checker for week 6 with tests in assignments repository: 5 checks, one tree read, bounded API calls, empty/missing report feedback, repeat-commit cache, no student code execution.
- [x] Build two student PPTX decks with scripts/build-week06-presentations.mjs. Validate and render all slides; copy validated output and hash/count metadata into materials/manifest.json.
- [x] Run actual example harness, browser animation/projector/navigation checks at phone and projector widths, full portal and submission suites; prove build output is stable.
- [ ] Review complete branch, fix material issues, publish both repos with attached PRs and green checks, verify all live week 6 links and deck hashes.
