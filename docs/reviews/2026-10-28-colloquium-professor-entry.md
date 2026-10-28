# Professor entry regression

The live student route reproduced the owner report when opened with an authorized professor session: studentState correctly rejected staff with student_required, but the student interface showed a generic connection error and retained its initial loading text. The anonymous live state endpoint returned200, confirming this was role-specific rather than an outage.

The page now uses the existing verified staff authorization helper to route authorized professors to /staff/colloquium before rendering the student interface. Expected401/403 authorization errors retain the normal student/anonymous route. Unexpected authentication/database failures propagate rather than becoming a student identity. No API authorization, timer, grading, schema or student registration behavior changes. Initial fetch failures also stop displaying the loading status while preserving retry and recovery.

Red evidence: the new UI test failed because the status still showed loading after an error; the new isolated browser test failed because the professor stayed at /colloquium.

Green evidence:116unit/UItests,ESLint andproductionbuild/TypeScript pass. The four existing colloquium browser flows passed at320/375/430px plus remembered-profile handling. The new professor/anonymous browser regression passes separately after restricting application-alert checks to main, excluding Next.js accessibility announcements outside application content. It verifies professor redirect, available group controls, both test lobbies unstarted, and anonymous entry without errors/loading. The upcoming CI run repeats all cases together.

No production room was opened or started and no production student or grade was created during this fix.
