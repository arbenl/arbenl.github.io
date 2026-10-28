# Mobile Colloquium Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver professor-started10-minute mobile colloquium and replace demo20% with two10-point colloquia.
**Architecture:** Next.js/NextAuth classroom identity, PostgreSQL persistent rooms/attempts, server-only question bank and scoring, independent registration lobby. Existing attendance stays unchanged.
**Tech Stack:** TypeScript, Next.js, React, Drizzle, PostgreSQL, Vitest, Playwright; Python DOCX/PDF.
**Spec:** docs/superpowers/specs/2026-10-28-mobile-colloquium-design.md

## Global Constraints
Professor opens separately for G1/G2 and explicitly starts common600s clock. Student entry without GitHub/password/OTP/attendance expiry. Existing profiles direct; inline signup for others.10 questions x3answers x1correct x1point; random persisted options. Only weeks1–6. No answer keys sent to clients. One scored attempt/student/week across groups. Server auto-finalization regardless browser; no late changes or early scores. Alphabetic names+scores after deadline, no email/index. Additive DB, staff-only setup, preserve existing identities/attendance/private materials. Never start production test or add fake production students.

## Chunk 1: backend
### Task 1: Server assessment and registration
**Own:** attendance-app/lib/colloquium/**; additive drizzle0003; schema.ts additions; lib/auth/options.ts new quiz Credentials provider; shared classroom-registration factor if needed; app/api/colloquium/** and app/api/staff/colloquium/**; integration/unit tests for these; setup invocation in attendance service if needed.
- [ ] Read actual weeks1–6 materials; author10 clear Albanian questions (not week7) with source pointers, correct option semanticID.
- [ ] Add failing unit/SQL tests for room lifecycle, common timer, enrollment, stable shuffle, scoring, results, duplicate/crossgroup/deadline/concurrency/staff protections.
- [ ] Implement additive idempotent migration run only via existing professor setup or authenticated staff quiz endpoint.
- [ ] Implement staff open lobby/start; no reset/deletion of live attempts. Tokenhash, origin check; obtain current course semester from existing setup.
- [ ] Implement quiz credentials: reuse canonical identity matching safely without60s attendance check; no attendance written. No new professor identity or conflicting profile overwrite. Existing browser session skips enrollment.
- [ ] Implement student state/join/save/submit/results with unambiguous API types exported from lib/colloquium/types.ts, exact routes documented in report for UI implementer. Use server deadline and persist random optionIDs; grade server only. Save per-question (not full snapshot race); concurrent deadline recheck after lock.
- [ ] Run focused integration/unit, tsc/lint; self-review and commit own files. Report API contract and verification evidence.

## Chunk 2: browser experience
### Task 2: Professor and student UI plus real browser verification
**Own:** attendance-app/components/colloquium/**; app/colloquium/**; app/staff/colloquium/**; staff/page.tsx and student/page.tsx entrylinks; globals.css scoped additions; tests/ui/colloquium* and tests/e2e/colloquium*.
- [ ] Read backend report/types. Add failing UI and E2E for new+remembered profile joining, lobby, shared start, autosave, refresh, submit, expiry and alphabetic score table.
- [ ] Implement teacher groupcards, prepare lobby, QR/copyablelink, joinednames/count, explicitStart,600s countdown/results. Prevent doubleclicks and no background start.
- [ ] Student /colloquium landing and roomlink: inline enrollment, direct remembered entry, waiting poll, quiz10 large radio-choicequestions, answeredcount, timer, reliable save/retry indicator, earlysubmit confirmation. Restore on refresh. No OTP/Github or extra QR gate. Preserve unsaved choices on fetch failures and don't falsely claim saved.
- [ ] Deadline view publishes names+points from API; access on same entry; no answer review. Validate375/320/430px no horizontaloverflow.
- [ ] Run UI/E2E locally against isolatedDB (never prod), capture no-PII screenshot; self-review, commit ownfiles and report.

## Chunk 3: syllabus and delivery
### Task 3: Course documents and published entry
**Own:** scripts/build-syllabus.mjs, scripts/build-catalog.mjs, grading/course-plan.json, current syllabus.html, generated current coursepages; syllabus PDF/DOCX; document generation source script; tests covering grading and navigation.
- [ ] Inspect actual current Word/PDF and source generators. Read document/PDF skills. Preserve official schedule/content/layout and replace only20-pointdemo with10+10colloquia, week7/14 plan and explanatory rules. Keep totals100 and other weights.
- [ ] Add homepage studentcolloquium action in existing course area plus week7entry, preserve existing private week7lab controls. Change source generators and rebuild.
- [ ] Rebuild PDF/DOCX reproducibly, inspect rendered pages for legibility and validate text weighs10+10.
- [ ] Run portal checks/build and focused tests, commit ownfiles and report.

### Task 4: Seventy-student live-duration rehearsal
**Own:** attendance-app/scripts/test-colloquium-load.* and isolated test fixtures as needed; loadtest report under docs/reviews.
- [ ] Start isolated app/PostgreSQL;70distinct testidentities sign in/join through real endpoints (no production).
- [ ] Professor opens lobby and starts common600s;70clients receive stable shuffled choices, answer with deterministic varying correctness, autosave concurrently, verify persisted across reload.
- [ ] Keep real600second server deadline; assert no early results. On expiry poll, verify automaticfinalization even clients gone; exact70unique names alphabetic and everyexpectedscore. No teacher publish/manual grading dependency.
- [ ] Capture timing, request failures, scores, list evidence and anonymized screenshot/report; cleanup only isolated environment.

## Completion
- [ ] Reviewed taskdiffs and wholebranch. Integrate newmain preserving unrelated concurrent updates.
- [ ] Full appropriate app and portal checks; reviewed PR attach and merge within owner publication authorization. Deploy exact mergedmain, no secret exports.
- [ ] Verify authenticated teacher panel and readiness/migration, student landing, public syllabus/PDF. Do not open/start productionrooms or add students. Report direct teacher/student links and exact operation steps.
