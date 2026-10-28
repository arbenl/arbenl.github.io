# Private professor colloquium trial

Owner explicitly approved privateprofessortrial on2026-10-28 after choosing: actualquestions, anytrialindex, Restartbutton, no effects onG1/G2/studentgrades. ExistingliveG1lobbyhas0participants and iswaiting; do notstart/reset it.

## Behavior
Protected /staff/colloquium/preview letsauthorizedprofessor fill anytrialindex (default PROVE-001, arbitrarynonemptytext up to100chars, no roster/realindexvalidation), explicitlyStart a private600secondquiz withtheactualencryptedweek1–6bank.10questions,3persisted-shuffledchoicesA/B/C,onecorrect,1point each. Servergrades on Finish or timerexpiry; displaysprivatepoints/10. Obviousprivate-testbanner andindexlabel. Rifillo provën startsfreshprivatequestions/order/time andclearsoldanswers/result. No officialrecord orpublicresults. Add linkintheprofessorcolloquiumpanel.

## Boundaries
Reuse existing requireCurrentStaff/requireStaff andcanonicalOrigin+Host checks. EverypreviewAPIactionmustverifyactualprofessorsession; anonymous401/student403. No studentauthbypass, no change toexistingstudententryredirect. No inserts/updates/deletes to rosters/users/rooms/attempts/attendance/audit/marks. Do not modifyofficialassessmentservice/schema/bankversion/productionroomstate. Preview isnotactualstudentregistration; clearlypresenttheindexasprivate-testlabel.

## Stateless server design
POST /api/staff/colloquium/preview withactionstart+studentId returnsprivatepublicquestionDTOs,deadline=serverstart+600000,serverTime,andopaqueencryptedproof. Proofcontainspurpose/version,staffuserId,frozenbankversion,trialindex,start/deadline,randomquestionorder; AES256GCM withrandomnonce andpurpose-separatedkeyderivedfromNEXTAUTH_SECRET. Never returnsemanticmapping/answerkey separately orplaceproofinURL/logs. POSTsameendpoint withactiongrade+proof+answers validatesproof/purpose/version/staffbinding/bounds,usesactualserverbankandscoreAnswers andreturnsscore/maxScore10/trialindex/privateflag. Proofmaxage1hour allowsresultsafter10minutes;serverauthstillrequiredon everyrequest. Previewgrade isadvisoryonly,neverofficial; UIlockschoicesafter600s. Nonewsecrets/config/DBmigration.

## Browser behavior
Useexistingquizstyles/Timer,largeradiocontrols,relativeA/B/C labels. Keeptrialstateinmemoryonly;refreshreturnsstartform. No autosave/DBhistory claim. Finish/restartbuttonsdisabledwhileworking,lockinflightrequests topreventstalerunresults. Automaticdeadlinegradeonce;networkerrorvisiblewithmanualretry,nospamloop. Restartclearsoldrunbeforestartingnewone;do notstartofficialG1/G2.

## Verification
TDDunitrealcrypto+stubsyntheticbankonly,token tamper/wrongstaff/wrongpurpose/expired/unknownchoices/bankfailure. MeaningfulUIstart-anyindex/finish/restart/deadline. Disposablebrowser375px actualauthorizedprofessor+anonymous/studentdenial,trialindex GABIM accepted,30radios,scorevisible,Restart10minfresh. Snapshotallofficialtable rowcounts before/after;mustunchanged. Existingstudentflowregression. Neverreal productionstudent/grade creation. Rootlivecheckprivatepreviewonly(noofficialexam).
