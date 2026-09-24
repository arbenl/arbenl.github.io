# Week 2 classroom flow audit — 24 September 2026

Verdict: teaching materials usable; full classroom workflow is not flawless.

## Verified
- Week landing page exposes lecture viewer, exercise viewer, and submission guide.
- Browser viewers: 22 lecture slides and 12 lab slides; all traversed at 1280×800 and 375×812, no horizontal overflow; desktop slide content fits above controls.
- Lecture viewer opens immediately, keeps PPTX download secondary, excludes speaker notes.
- Exercises now open in projector mode, mention QR confirmation, require all eight template sections including AI declaration, and identify completion as an issue plus feedback.
- Lab is a self-contained RideShare walkthrough, so G1 can attend before the shared lecture. Lecture conclusion explicitly addresses G1 reflection and G2 preparation.
- Website build and 10 tests pass, including local links/assets and note-free student PPTX.
- Attendance: 58 unit/UI, 32 database integration, 3 end-to-end tests pass. E2E covers projected QR contents, activation of imported identities, duplicate scan, expiration, staff authorization, live list and total, correction audit, and history at 320/375/430px widths. Authentication is synthetic in these local tests; actual GitHub login/camera scanning by a new student is not covered.
- Submission validator: 4 tests pass. Two latest production workflow runs completed successfully. No new public test submission was created during this audit.
- Production staff panel loaded using existing signed-in session; existing sessions inspected without opening attendance windows.

## Remaining findings, in priority order
1. **Blocker for today's G1 lab:** production week 2 G1 session already closed. UI and API prohibit reopening closed sessions; launch returns session_finished. Labeling every link QR does not fix this. A staff-only, reason-audited reopening flow is needed, preserving records and invalidating old challenges. No production session state changed during audit.
2. **First scan timing:** two-minute attendance window and short-lived QR can expire during first GitHub login/profile entry. Ten-minute profile permit allows setup completion, but does not itself record attendance after the window closes. Repeat scanning/reopening needs a clear assisted path. Test with a genuinely new account and phone camera before claiming classroom readiness.
3. **Presence assurance:** a fresh QR shared live can still be scanned remotely. Token expiry and the visible count/list deter misuse but do not prove physical presence. Professor visual reconciliation remains necessary.
4. **Grading gap:** GitHub checks ownership, required files, sizes and basic text completeness. It does not grade reasoning/sketch quality or publish weekly accumulated points. Existing student wording correctly calls this a technical check, not a grade. No AI quota is used by this deterministic check.
5. **Identity linkage:** submissions are authored by GitHub account, but the technical report is not automatically joined to the private attendance roster/gradebook.
6. **Teaching duration:** lab's nominal activities fill all 90 minutes without a dedicated first-registration buffer. New students may need assisted completion. Lecture has no paced 90-minute facilitator run sheet; actual delivery duration remains untested.
7. **Version consistency:** HTML lecture has updated group-aware closing questions; downloadable PPTX still retains its original final slide. The conceptual content of the first 21 slides is retained.

## Practical sequence
Professor opens week 2 materials, then lab viewer. Students prepare GitHub/editor/paper, watch demonstration, write plan, sketch, test with a peer, upload two files, submit one issue, read feedback. In the middle of the class professor separately opens the correct group's attendance QR, students confirm success. Shared lecture uses the browser lecture viewer; final questions connect G1's completed work and G2's upcoming practice. Closing attendance does not submit assignments; submitting an issue does not mark attendance.
