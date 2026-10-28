# Private Professor Trial Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development.

**Goal:** LetArben privatelytry/restartrealquizwithanyindexwithouttouchingofficialgroups/grades.
**Architecture:** Staff-onlystatelessencryptedrunproof andservergrading;memory-onlyReactUI.
**Tech Stack:** Next.js/NextAuth/TypeScript,nodecrypto,Vitest/Playwright.
**Spec:** docs/superpowers/specs/2026-10-28-colloquium-private-trial-design.md

## Global Constraints
Actualquestionsonlyteacher-authorized. Anystudentindexisprivate-testlabel.10questions3A/B/C1correct1point;600s;earlyfinishandautomaticfinish. Restartprivateonly. NoofficialDBwrites,authbypass,newsecretorplaintextbank/keyinpublicsource. Proofencryptedandteacherbound,namespace-separatedfromauth. Everyendpointstaff+originchecks. No productionexamstart/reset.

## Chunk1 private trial
### Task 1: Implementprotectedtrialandregressions
**Own:** lib/colloquium/preview.ts; app/api/staff/colloquium/preview/route.ts; app/staff/colloquium/preview/page.tsx; components/colloquium/preview.tsx; staff.tsx smallentrylink; types.ts newpreviewDTOsonlyifneeded; tests/colloquium/preview.test.ts;tests/ui/colloquium-preview.test.tsx;tests/e2e/colloquium-preview.spec.ts. Noofficialservice/schema/bank/authchanges.
- [ ] Writeandobservefailingcrypto/service/UItests. Reuseexistingserverhelpers;newmodule mustnotimportDBclient/schema/officialserviceexceptcanonicalOriginroutewrapper(Errorclassimportunavoidablereadonly)).
- [ ] Implementstart/gradeencryptedproof,nodecryptoAESGCM,keyHMACnamespace,realopaqueorders,no semanticIDsorcorrectness inresponse. Boundproof/answers input andcheckstaff/purpose/time/version. Missingbank=>safe503.
- [ ] Implementteacher-onlypageAPI+entrylink;simpletrialindexformand600squiz,Finish+Rifillo,score/10,privatebanner,noofficialregistrationclaim. ReusesharedstylesandTimer,guardasyncstalerun/duplicateautosubmit,manualretryfailures. Memoryonly;donotaddserverstore/cookie/sessionoverride.
- [ ] AddrealdisposablemobileE2Ewithanonymous401,student403,professorstart GABIM indexandgrade/restart. SQLsnapshotallofficialtablesunchanged;professorstaffhelperqueriesallowedbutnoinsert/update. Previewtimerexpirybrowserclockmayadvance(syntheticfixture);neveradvancerealprodtime.
- [ ] RunfocusedtestsRED/GREEN,fullunit,lint/tsc/build,focusedE2E+existingcolloquiumregression. Self-review,commitownedfiles,writeTask1reportwithcommands/results/APIcontract.

## Delivery
- [ ] Reviewtaskandwholebranch,singleboundedfixwaveifneeded. PushPR/attach,CI,merge/deployexactmain,liveprofessorpreviewcheckwithnoofficialexamstart. Saveproofwithoutquestions/keysandgiveuserdirectlink+Restartinstructions.
