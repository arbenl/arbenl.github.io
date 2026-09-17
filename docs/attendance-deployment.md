# Vijueshmëria: udhëzuesi i publikimit dhe përdorimit

## Sistemi aktiv

Vijueshmëria është një aplikacion Next.js i publikuar në Vercel:

- aplikacioni: [https://aab-mobile-attendance.vercel.app](https://aab-mobile-attendance.vercel.app);
- hyrja nga Student Zone: [https://arbenl.github.io/attendance.html](https://arbenl.github.io/attendance.html);
- databaza: PostgreSQL i dedikuar në Neon;
- identifikimi: GitHub OAuth për profesorin dhe studentët;
- kodi: `attendance-app/` në këtë repository.

GitHub Pages shërben vetëm si hyrje nga Student Zone. Formularët, autorizimi, QR-ja dhe evidenca ekzekutohen në Vercel dhe ruhen në Neon. Migrimet historike në `supabase/` nuk përdoren nga sistemi aktiv. Nuk ka OTP me email, SMTP, konfigurim `attendance-config.js` ose ruajtje zyrtare në browser.

## Konfigurimi i prodhimit

Projekti Vercel është `aab-mobile-attendance`. Integrimi Neon duhet të jetë i lidhur vetëm me këtë projekt dhe `DATABASE_URL` duhet të jetë aktiv për Production; Preview përdoret vetëm kur është konfiguruar dhe testuar veçmas. Skema krijohet duke aplikuar një herë, pa ndryshime, migrimin [`attendance-app/drizzle/0000_live_attendance.sql`](../attendance-app/drizzle/0000_live_attendance.sql) në databazën e dedikuar.

GitHub OAuth App përdor:

```text
Homepage URL: https://aab-mobile-attendance.vercel.app
Authorization callback URL: https://aab-mobile-attendance.vercel.app/api/auth/callback/github
```

Këto emra duhet të ekzistojnë si Vercel Production environment variables:

```text
DATABASE_URL
NEXTAUTH_URL
NEXTAUTH_SECRET
GITHUB_ID
GITHUB_SECRET
PROFESSOR_GITHUB_ID
RATE_LIMIT_SECRET
```

`NEXTAUTH_URL` duhet të jetë URL-ja stabile e prodhimit. `PROFESSOR_GITHUB_ID` është GitHub user ID numerik i profesorit, jo username-i ose emaili. `GITHUB_ID` është Client ID i OAuth App; `GITHUB_SECRET` është Client secret tjetër. `NEXTAUTH_SECRET`, `GITHUB_SECRET`, `RATE_LIMIT_SECRET` dhe kredencialet e databazës trajtohen si sekrete. Asnjë vlerë reale nuk vendoset në Git, `.env.example`, dokumentacion, screenshot ose chat. Asnjë sekret nuk duhet të ketë prefiksin `NEXT_PUBLIC_`.

Në një instalim të ri, profesori hyn fillimisht me llogarinë GitHub që përputhet me `PROFESSOR_GITHUB_ID`, pastaj thërret një herë `POST /api/admin/bootstrap` nga sesioni i autentikuar. Ky veprim krijon anëtarësinë e parë të stafit dhe një shenjë të përhershme se bootstrap-i është kryer. Përsëritja nuk krijon staf të ri. Pas bootstrap-it, autorizimi lexohet nga tabela `staff`; ndryshimi i username-it ose i një fushe në browser nuk jep rol stafi.

## Përgatitja e semestrit

Kur profesori hap `/staff`, sistemi sinkronizon automatikisht semestrin **Programimi për Pajisje Mobile · Semestri Dimëror 2026/27** dhe 29 sesionet e grupit `G1`. Java 1 ka vetëm ligjëratë më 17 shtator. Javët 2–15 kanë ligjëratë në 16:30 dhe ushtrime në 18:30 çdo të enjte, deri më 24 dhjetor 2026. Sinkronizimi është idempotent: hapja e përsëritur e panelit nuk krijon dublikatë. Semestrat e arkivuar me prefiksin e rezervuar `[PILOT SYNTHETIC]` pastrohen nga databaza gjatë këtij sinkronizimi.

Ligji i Kosovës për festat zyrtare nuk ka festë zyrtare të enjten brenda kësaj periudhe; Krishtlindjet Katolike janë të premten, 25 dhjetor. Nëse AAB shpall ndryshim të veçantë akademik, anulo sesionin përkatës ose krijo një orë zëvendësuese nga seksioni **Ndryshime manuale**.

Për përgatitjen operative:

1. Hyr në `/staff` me llogarinë GitHub të autorizuar; kalendari krijohet vetë.
2. Importo listën zyrtare para orës së parë, duke përdorur grupin `G1`.
3. Kontrollo listën e sesioneve dhe përdor **Ndryshime manuale** vetëm për orë shtesë, zëvendësime ose një semestër tjetër.
4. Në fund të semestrit, eksporto evidencën dhe arkivoje me arsye.

Lista pranon 1–2,000 rreshta për kërkesë. Formati aktual është me presje ose tab, me një student në secilin rresht:

```text
Student ID, Full Name, Group
22010045, Agon Krasniqi, G1
22010046, Arta Kola, G1
22010071, Besa Dema, G2
```

Header-i `Student ID, Full Name, Group` është opsional. Mos përdor pikëpresje. Fushat janë Student ID, emri i plotë dhe grupi; emaili nuk importohet. Importi është shtues dhe atomik: nëse një rresht është i pavlefshëm ose Student ID përsëritet brenda të njëjtit semestër, asnjë rresht i asaj kërkese nuk ruhet. Korrigjo burimin dhe importo përsëri vetëm rreshtat që mungojnë. Mos vendos lista reale në repository ose në skedarë testimi.

Emri i grupit përputhet **saktësisht** pas heqjes së hapësirave në fillim dhe fund. `G1`, `g1` dhe `Grupi 1` janë grupe të ndryshme. Kur krijon sesionin, kopjo të njëjtën vlerë që përdoret në listë. Nuk ka grup special `*`; për disa grupe krijo sesionin përkatës për secilin grup.

Semestri kalon vetëm `draft → active → archived`. Një semestër i arkivuar nuk riaktivizohet nga paneli. Sesioni kalon vetëm `draft → open → closed`, ose në `cancelled` nga `draft`/`open`. Një sesion i mbyllur ose anuluar nuk rihapet; në rast gabimi krijo një sesion zëvendësues me titull dhe arsye të qartë.

## Përvoja e studentit

Studenti ka nevojë për llogari GitHub. Herën e parë:

1. hap Student Zone ose skanon QR-në;
2. hyn me GitHub;
3. zgjedh semestrin aktiv;
4. shkruan emrin, mbiemrin dhe Student ID saktësisht si në listën zyrtare;
5. aktivizon profilin.

Emri krahasohet pa dalluar shkronjat e mëdha/vogla dhe duke normalizuar hapësirat; Student ID duhet të përputhet saktësisht. Një llogari GitHub lidhet me vetëm një rresht të listës në atë semestër. Në orët pasuese studenti vetëm skanon QR-në. Nëse sesioni GitHub ka skaduar, hyn sërish, por nuk riaktivizon profilin.

Faqja `/student` i tregon studentit vetëm historikun e vet. Aplikacioni ruan GitHub user ID, username-in dhe lidhjen me rreshtin zyrtar; nuk ruan OAuth access token. Evidenca ruhet në Neon, jo në `localStorage`.

## Rrjedha në çdo ligjëratë ose ushtrim

1. Në `/staff`, zgjidh sesionin e datës së sotme nga kalendari i krijuar automatikisht dhe shtyp **Menaxho**.
2. Hape pamjen **Hap projektorin** ndërsa sesioni është ende `draft`. Vetëm stafi i autentikuar mund ta hapë QR-në dhe listën live.
3. Në momentin e zgjedhur gjatë orës, shkruaj arsyen dhe hape sesionin nga paneli privat. **Aty nis afati dyminutësh sipas orës së serverit.** Mos e hap sesionin para se projektori dhe studentët të jenë gati.
4. Projektori krijon QR të ri çdo 25 sekonda. Secili QR vlen deri në 40 sekonda dhe asnjëherë pas fundit të afatit dyminutësh.
5. Studenti skanon dhe check-in përfundon menjëherë. Përsëritja e të njëjtit check-in kthen rezultatin ekzistues dhe nuk shton rresht të dytë.
6. Projektori paraqet studentët sipas radhës së regjistrimit, me emër të maskuar, kohën dhe totalin live. Paneli privat mban emrin e plotë, Student ID, GitHub username dhe statusin.
7. Afati refuzohet nga serveri edhe kur projektori mbyllet ose ora e telefonit është e gabuar. Mbylle sesionin nga paneli pas kontrollit; mund ta mbyllësh edhe para përfundimit të dy minutave.

QR-ja vendos tokenin e përkohshëm në fragmentin `#token=...`. Faqja e heq menjëherë nga shiriti i adresës dhe e mban përkohësisht vetëm në `sessionStorage` të atij tab-i kur kërkohet hyrje me GitHub. Serveri ruan vetëm hash-in e tokenit.

Lista live dhe totali e bëjnë të dukshme një hyrje të dyshimtë, por QR-ja nuk është provë absolute e vendndodhjes: një student mund ta fotografojë dhe ta përcjellë gjatë afatit të shkurtër. Nëse totali ose emrat nuk përputhen me klasën, mbylle menjëherë sesionin, kontrollo evidencën private dhe shëno korrigjimet me arsye. Mos publiko screenshot të listës.

## Korrigjimet dhe eksporti

Nga paneli privat, stafi mund të krijojë një evidencë manuale për një student ose të ndryshojë një evidencë ekzistuese në:

- `present` — i pranishëm;
- `excused` — i arsyetuar;
- `rejected` — regjistrim i refuzuar.

Çdo shtim ose korrigjim manual kërkon arsye. Sistemi ruan aktorin, kohën, veprimin dhe arsyen në `audit_log`. Mos korrigjo direkt tabelat e databazës gjatë përdorimit normal. Për student pa telefon ose për një problem teknik, verifiko identitetin dhe praninë para se të bësh shtimin manual.

**Eksporto CSV** është funksion vetëm për staf dhe regjistron veprimin në audit. Eksporti përmban nga një rresht për çdo student të grupit në çdo sesion të mbyllur të semestrit, përfshirë `absent` kur nuk ka evidencë. Sesionet `draft`, `open` dhe `cancelled` nuk përfshihen. Kolonat janë:

```text
Student ID, Full Name, Group, Session, Week, Kind, Status, Recorded At, Reason
```

Fushat që mund të interpretohen si formula nga spreadsheet-et neutralizohen. CSV-ja përmban të dhëna personale: ruaje në hapësirë institucionale me qasje të kufizuar dhe mos e publiko në GitHub. CSV-ja është raport operacional, jo backup i plotë i databazës ose i auditit.

## Kontrollet e sigurisë

- Paneli, projektori, importi, sesionet, korrigjimet dhe eksporti kërkojnë rol në tabelën `staff`.
- Studenti lexon vetëm historikun e lidhur me GitHub user ID-në e vet.
- Cookie e prodhimit është `HttpOnly`, `Secure` dhe `SameSite=Lax`.
- Tokeni QR nuk vendoset në query string dhe tokeni i papërpunuar nuk ruhet në databazë.
- Rate limiting në Neon lejon fillimisht: 5 tentativa aktivizimi në 10 minuta, 10 check-in në minutë, 10 krijime QR në minutë dhe 90 lexime live në minutë për identitet/sesion. IP-ja e papërpunuar nuk ruhet në tabelën e kufizimeve.
- Mos shto rrugë testimi, identitete sintetike ose sekrete në prodhim. `/api/test/session` duhet të kthejë `404` në Vercel.
- Ndalo ndarjen e ekranit para se të kalosh nga projektori te paneli privat.

## Publikimi dhe verifikimi

Komandat Vercel ekzekutohen nga `attendance-app/`. `.vercel/`, `.env*` reale, `.next/`, raportet Playwright dhe cache-t nuk commit-ohen ose ngarkohen si burim publik.

```sh
cd attendance-app
npm ci
npm run lint
npm test
npm run test:integration
npm run test:db
npm run build
npm run test:e2e

vercel whoami
vercel env ls production
vercel --prod
```

`vercel env ls production` përdoret vetëm për të verifikuar emrat dhe target-et; mos printo ose tërhiq vlerat në një skedar të gjurmuar. Pas publikimit:

1. kontrollo që deployment-i është `READY` dhe domain-i stabil hapet;
2. kontrollo hyrjen GitHub, `/student`, `/staff` dhe kthimin nga OAuth callback;
3. verifiko që një kërkesë `POST` te `/api/test/session` kthen `404`;
4. bëj pilot me 2–5 identitete sintetike: aktivizim, QR, check-in, duplikat, emër të maskuar, total live, skadim dhe mbyllje;
5. arkivo semestrin sintetik dhe konfirmo që nuk shfaqet te zgjedhjet aktive;
6. verifiko pamjen mobile në 320×700, 375×812 dhe 430×932 pa scroll horizontal;
7. vetëm pas pilotit ngarko listën reale dhe përditëso lidhjen e Student Zone.

Migrimi i prodhimit nuk duhet të ekzekutohet automatikisht në çdo build. Ndryshimet e ardhshme të skemës kërkojnë migrim të ri të rishikuar, backup dhe provë rikthimi para aplikimit.

## Backup dhe incidente

Pas çdo jave dhe në fund të semestrit, eksporto CSV-në dhe ruaje në dosjen institucionale të kursit me qasje të kufizuar. Për backup të plotë përdor mjetet e Neon ose `pg_dump` me një lidhje të përkohshme që nuk ruhet në shell history, repository ose logje. Disponueshmëria dhe periudha e rikthimit varen nga plani aktual i Neon; verifikoji në panel para semestrit. Provo rikthimin në një branch ose databazë të veçantë, kurrë drejtpërdrejt mbi prodhim.

Në incident:

1. mbyll sesionin e hapur; nëse shërbimi nuk përgjigjet, mos premto evidencë dhe përsërit check-in me sesion të ri pasi të rikthehet;
2. shëno URL-në e deployment-it, session ID-në, orën dhe simptomën pa kopjuar token QR ose të dhëna të panevojshme studentësh;
3. eksporto evidencën e paprekur dhe ruaj logjet për hetim;
4. përdor korrigjime me arsye, jo fshirje direkte, që auditimi të mbetet i plotë;
5. në rrjedhje kredencialesh, rrotullo sekretin përkatës në ofrues dhe Vercel, pastaj redeploy. Rrotullimi i `NEXTAUTH_SECRET` çaktivizon sesionet ekzistuese; rrotullimi i GitHub secret kërkon përditësimin e `GITHUB_SECRET`; kredencialet e databazës rrotullohen në Neon dhe rilidhen në Vercel;
6. pas rikthimit, provo hyrjen, autorizimin e stafit, një check-in sintetik dhe eksportin para se të vazhdosh me studentët.

Mos fshi të vetmin rresht të stafit: bootstrap-i fillestar është njëherësh dhe nuk e rikrijon automatikisht. Ndryshimi i stafit duhet të bëhet si operacion i kontrolluar në databazë, me backup dhe gjurmë të dokumentuar.

## Kufijtë e sistemit

Sistemi siguron identitet GitHub, përputhje me listën, grup të saktë, afat të serverit, një evidencë për student/sesion dhe audit për ndryshimet administrative. Nuk përdor GPS, Wi-Fi të kampusit ose verifikim biometrik. Ai nuk vendos automatikisht notë ose të drejtë provimi; rregullat akademike zbatohen mbi eksportin e verifikuar sipas politikës së institucionit.
