# Analiza e arbenl.github.io — 17 shtator 2026

U kontrolluan faqja publike, HTML/JavaScript lokal dhe pamjet në desktop 1280 px e telefon 390 px. Qëllimi: studenti të gjejë materialet dhe detyrat shpejt, ndërsa evidenca e pjesëmarrjes të ketë identitet dhe kohë të verifikuar në server.

| Prioriteti | Gjetja e verifikuar | Përmirësimi i implementuar |
|---|---|---|
| Kritik | Fjalëkalimet e pedagogut dhe PIN-i ishin në JavaScript publik; pranoheshin edhe nga shfletuesi i studentit. | U hoqën. Roli i stafit caktohet në server dhe kontrollohet në çdo kërkesë. |
| Kritik | Regjistrimi ruhej vetëm në localStorage; afishohej sukses edhe kur ruajtja në server dështonte ose mungonte. | Evidenca ruhet vetëm në databazë; pa konfigurim shfaqet “ende nuk është aktivizuar”. |
| Lartë | Studentët zgjidhnin javën/llojin dhe identitetin vetë; duplikatet kontrolloheshin vetëm në pajisjen lokale. | Identiteti lidhet me emailin e verifikuar dhe regjistrin; sesionin e cakton stafi; çelësi unik në DB ndalon dyfishimin. |
| Lartë | Tekstet thoshin gjithmonë “HAPUR”, pa lidhje me sesion real. | U hoq statusi fiktiv. Hapja/mbyllja dhe skadimi kontrollohen në server. |
| Lartë | Emrat shfaqeshin me innerHTML pa sanitizim. | Të dhënat shfaqen me textContent dhe elemente DOM. CSV neutralizon formula. |
| Mesatar | Veprimet praktike humbnin poshtë prezantimit të gjatë; telefoni kërkonte shumë lëvizje. | Tri hyrje të drejtpërdrejta sipër: vijueshmëria, materialet, dorëzimet. Zgjedhës i javës. |
| Mesatar | Java “aktuale” dhe afati i së premtes ishin statikë, pa data të verifikuara. | U emërtua si udhëzues i fillimit të kursit; afatet lidhen me njoftimin e pedagogut. |
| Mesatar | Nisja e faqes mbishkruante fragmentin e URL-së, duke prishur lidhjet direkte. | Hash-i ruhet në ngarkimin fillestar; zgjedhësi hap dhe fokuson javën e saktë. |
| Mesatar | Hapja e javëve përdorte vetëm klikim në div. | Mbështetje Enter/Space, fokus i dukshëm dhe aria-expanded. |
| Përmbajtje | Përfitimi studentor quhej “Copilot Pro” në materialet e orientimit. | U përditësua në Copilot Student me verifikim GitHub Education. |

Përmbajtja e 15 javëve, shabllonet dhe profili u ruajtën. Ndryshimet e hyrjes janë në shqip; pjesë të faqes së vjetër vijojnë me kaluesin SQ/EN. Përkthimi i plotë i modulit të ri në anglisht nuk është përfshirë në këtë version.

## Zgjidhja për praninë në sallë

GitHub Pages shërben vetëm ndërfaqen statike. Supabase ruan regjistrin privat, sesionet, sfidat QR dhe historikun e verifikimeve. QR rrotullohet çdo 25 sekonda dhe skadon pas 40 sekondash në server. Përcjellja e një fotografie brenda afatit mbetet e mundshme; prandaj skanimi është vetëm kërkesë `pending`. Vetëm kontrolli fizik i identitetit nga pedagogu e bën `present`. Nuk pretendohet se GPS, QR ose Wi-Fi të vetëm provojnë praninë.

Raporti ndan ligjëratat/ushtrimet, përjashton sesionet e anuluara dhe para regjistrimit të studentit, dhe lejon eksport CSV. Studenti sheh vetëm historikun e vet; pedagogu të gjithë semestrin. Paneli i projektorit nuk shfaq regjistrin me emra. Para kthimit në regjistër, pedagogu duhet të ndalë ndarjen e ekranit.

## Verifikimi

- Build i paketës browser me varësi të fiksuara; auditimi npm pa cenueshmëri të raportuara në instalim.
- Teste JavaScript: denominatorë, grupe, përjashtime, formula/thonjëza në CSV dhe importi i regjistrit.
- PostgreSQL i izoluar: skanimi krijon pending, duplikimi është idempotent, studenti sheh vetëm veten, nuk ka administrim nga studenti ose qasje direkte në tabela, QR i gabuar/i skaduar/i mbyllur refuzohet, grupi i gabuar refuzohet, emaili i paverifikuar dhe anonimi refuzohen, stafi verifikon me audit dhe pending bllokon përfundimin.
- Supabase lokal + shfletues: hyrje OTP e pedagogut dhe studentit përmes Mailpit lokal, krijim semestri, import i dy identiteteve sintetike, hapje sesioni, QR projektori, skanim si student dhe konfirmim nga pedagogu.
- Pamje në 390 px dhe 1280 px; navigim i javës dhe gjendje pa konfigurim. Nuk është kryer audit i plotë WCAG ose test fizik në projektorin e sallës.

## Çfarë mbetet për aktivizim

Zgjedhja/aktivizimi i projektit Supabase, SMTP institucional ose dërguesi i autorizuar, llogaria e pedagogut dhe regjistri real i studentëve. Publikimi në `main` dhe testi pilot real bëhen pasi të jenë gati këto. Nuk u ndryshua asnjë projekt Supabase në cloud dhe nuk u transferuan të dhëna reale studentësh.

Shih [udhëzimin e aktivizimit](attendance-deployment.md).

Burim i përmbajtjes së përditësuar: [GitHub: Copilot për studentë të verifikuar](https://docs.github.com/en/copilot/how-tos/copilot-on-github/set-up-copilot/enable-copilot/set-up-for-students).
