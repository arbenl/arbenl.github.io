# Vijueshmëria live në Vercel dhe Neon — dizajni

**Data:** 17 shtator 2026
**Statusi:** Miratuar nga profesori
**Zëvendëson:** Pjesët e Supabase/OTP në `2026-09-17-lecture-story-live-attendance-design.md`

## Qëllimi

Sistemi regjistron pjesëmarrjen për çdo ligjëratë dhe ushtrim pa përdorur Supabase ose email OTP. Profesori krijon dhe projekton QR-në. Studentët identifikohen me GitHub, lidhen një herë me regjistrin zyrtar dhe më pas vetëm skanojnë. Projektori shfaq një listë të renditur dhe totalin live.

Prezantimi i Ligjëratës 1 mbetet sipas specifikimit ekzistues: historia e restorantit zëvendëson vetëm RideShare. Ky dokument ndryshon vetëm arkitekturën e vijueshmërisë.

## Arkitektura

Sistemi përdor katër pjesë:

1. **GitHub Pages** vazhdon të shërbejë portalin e kursit në `arbenl.github.io` dhe lidhet me aplikacionin e vijueshmërisë.
2. **Next.js në Vercel** shërben ndërfaqen, autentikimin dhe Route Handlers. Sekretet ekzistojnë vetëm si Vercel environment variables.
3. **Auth.js me GitHub OAuth** identifikon profesorin dhe studentët. Auth.js përdor sesion JWT të nënshkruar në cookie `HttpOnly`; databaza nuk ruan OAuth token. Sistemi përdor GitHub user ID si identitet të qëndrueshëm dhe ruan username-in vetëm për auditim dhe paraqitje administrative.
4. **Neon Postgres** ruan regjistrin, lidhjet e llogarive, sesionet, QR-të e hash-uara, pjesëmarrjen dhe auditin.

Aplikacioni nuk e ekspozon databazën drejtpërdrejt në shfletues. Vetëm Route Handlers përdorin `DATABASE_URL`.

## Rolet dhe hyrja

### Profesori

Llogaria GitHub me username `arbenl` dhe GitHub user ID-në përkatëse regjistrohet si staf. `PROFESSOR_GITHUB_ID` vendoset në Vercel dhe përdoret vetëm nga endpoint-i njëherësh i bootstrap-it për ta shtuar përdoruesin e parë në `staff`. Çdo kontroll i mëvonshëm bëhet nga tabela `staff`; një fushë në shfletues nuk mund ta japë rolin. Vetëm stafi mund të:

- importojë regjistrin;
- krijojë sesione;
- krijojë dhe projektojë QR;
- lexojë listën live dhe identitetin e plotë;
- mbyllë, anulojë ose korrigjojë evidencën;
- eksportojë raportin.

Një profesor tjetër fiton qasje vetëm pasi një administrator e shton shprehimisht në `staff`.

### Studenti

Studenti hyn me GitHub. Herën e parë zgjedh semestrin dhe shkruan emrin, mbiemrin dhe Student ID-në. Serveri normalizon hapësirat dhe madhësinë e shkronjave, por kërkon të njëjtat shkronja diakritike dhe Student ID. Ai kërkon një rresht të palidhur në regjistrin zyrtar dhe e lidh me Auth.js user ID-në në një transaksion.

Lidhja është unike brenda semestrit. I njëjti përdorues mund të marrë pjesë në semestra të tjerë, por nuk mund të lidhet me dy studentë në të njëjtin semestër. Përgjigjja e gabimit nuk zbulon se cila fushë ishte e saktë.

Pas lidhjes, sistemi përdor vetëm user ID-në e sesionit. Studenti nuk plotëson më emrin ose Student ID-në.

## Modeli i të dhënave

- `users`: UUID i brendshëm, GitHub user ID unik, username, emri dhe timestamps. Login-i e krijon ose e përditëson këtë rresht pa ruajtur OAuth token.
- `staff`: UUID i brendshëm i përdoruesit, roli dhe data e shtimit.
- `semesters`: titulli, numri i javëve dhe statusi.
- `roster`: semestri, Student ID, emri i plotë, grupi, `user_id` nullable dhe koha e aktivizimit.
- `class_sessions`: semestri, java, `lecture|lab`, grupi, titulli, gjendja dhe fundi i dritares.
- `qr_challenges`: hash SHA-256 i tokenit, sesioni dhe skadimi.
- `attendance_records`: sesioni, studenti, statusi, koha e skanimit dhe të dhënat e korrigjimit.
- `audit_log`: aktori, veprimi, subjekti, arsyeja dhe koha.

Kufizimet kryesore janë unikësia e Student ID-së dhe `user_id` brenda semestrit, si dhe një rekord pjesëmarrjeje për student dhe sesion.

## QR dhe check-in-i

1. Profesori krijon sesionin pa nisur afatin.
2. Butoni **Shfaq QR në projektor** hap një dritare dyminutëshe sipas orës së databazës.
3. Serveri gjeneron një token me entropi të mjaftueshme, ruan vetëm SHA-256 dhe kthen lidhjen e skanimit.
4. Projektori kërkon token të ri çdo 25 sekonda. Tokeni vlen deri në 40 sekonda, por kurrë pas fundit të dritares.
5. Studenti i identifikuar hap lidhjen. Serveri verifikon sesionin Auth.js, lidhjen me regjistrin, grupin, tokenin dhe afatin në një transaksion.
6. `INSERT ... ON CONFLICT` e bën skanimin idempotent. Përgjigjja kthen vetëm rezultatin e studentit.
7. Pas dy minutash serveri refuzon çdo token, edhe nëse projektori ka mbetur i hapur.

URL-ja mund të hapet nga kushdo, por vetëm studenti i identifikuar dhe i lidhur me atë semestër mund të regjistrohet. Vetëm stafi mund të krijojë token.

QR-ja përdor fragmentin `https://APP/check-in#token=RAW_TOKEN`; shfletuesi nuk ia dërgon fragmentin Vercel-it, GitHub-it ose logjeve HTTP. Faqja lexon tokenin dhe e heq menjëherë nga shiriti me `history.replaceState`. Nëse studenti duhet të hyjë me GitHub, faqja e ruan tokenin në `sessionStorage` të të njëjtit tab me kohën e ruajtjes, pastaj nis hyrjen me një callback pa token (`/check-in`). Pas kthimit, faqja e lexon dhe e fshin vlerën para POST-it. Ajo refuzon çdo vlerë lokale më të vjetër se dy minuta. Pas suksesit ose gabimit përfundimtar, tokeni fshihet. `localStorage`, cookie dhe query string nuk përdoren për tokenin.

## Lista live në projektor

Projektori kërkon një snapshot çdo sekondë nga një Route Handler staff-only. Përgjigjja përmban:

```json
{
  "sessionId": "uuid",
  "state": "open",
  "serverTime": "2026-09-17T10:42:15Z",
  "checkinEndsAt": "2026-09-17T10:44:00Z",
  "entries": [
    {
      "rosterId": "uuid",
      "displayName": "Arta K.",
      "recordedAt": "2026-09-17T10:42:03Z"
    }
  ],
  "total": 1
}
```

Serveri rendit sipas `coalesce(scanned_at, verified_at)`, pastaj `roster_id`. Projektori shfaq numrin rendor, emrin e maskuar, kohën dhe totalin. Paneli privat shfaq emrin e plotë, Student ID-në dhe GitHub username-in.

Në dështim rrjeti, lista e fundit zbehet dhe etiketohet **“të dhënat mund të jenë të vjetruara”**. Klienti provon pas 1, 2, 4 dhe pastaj çdo 5 sekonda. Pas rikthimit, snapshot-i i plotë zëvendëson gjendjen lokale. Projektori nuk shfaq total përfundimtar pa një përgjigje të suksesshme pas mbylljes.

## Korrigjimet dhe abuzimi

Statuset janë `present`, `rejected` dhe `excused`. Një skanim krijon `present`. Profesori mund ta ndryshojë statusin me arsye të detyrueshme; sistemi ruan aktorin dhe kohën në audit.

Fotografia e QR-së mund t'i dërgohet një studenti tjetër gjatë afatit. Dizajni e kufizon dhe e bën të dukshëm këtë rrezik me token të shkurtër, dritare dyminutëshe, një rekord për student, listë live dhe total. GPS, Wi-Fi i kampusit, Bluetooth dhe njohja e fytyrës mbeten jashtë fushës.

## Siguria

- Auth.js përdor cookie sesioni `HttpOnly`, `Secure` dhe `SameSite=Lax` në prodhim.
- GitHub OAuth callback lejon vetëm origin-in e vendosur në `AUTH_URL`.
- Mutacionet kërkojnë sesion dhe kontroll roli në server.
- `DATABASE_URL`, `AUTH_SECRET` dhe GitHub client secret ruhen vetëm në Vercel.
- Tokeni i QR-së nuk ruhet në log dhe hiqet nga URL-ja e shfletuesit pas leximit.
- Të gjitha query-t përdorin parametra; importi i regjistrit ekzekutohet në transaksion.
- Përgjigjet e studentit përmbajnë vetëm të dhënat e tij.
- Route Handlers e QR-së dhe aktivizimit kanë rate limiting sipas user ID-së dhe IP-së.
- GitHub Pages nuk merr sekrete ose të dhëna studentësh.

Rate limiting ruhet në Neon, jo në memorien e Vercel Function. Tabela `request_limits` përdor `(action, key_hash, window_start)` dhe numërues atomik. `key_hash` është HMAC-SHA-256 i GitHub user ID-së dhe IP-së me `RATE_LIMIT_SECRET`; IP-ja e papërpunuar nuk ruhet. Kufijtë fillestarë janë: aktivizimi 5 tentativa në 10 minuta, check-in-i 10 tentativa në minutë, krijimi i challenge-it 10 në minutë dhe lista live 90 kërkesa në minutë për profesor/sesion. Përgjigjja 429 kthen `Retry-After`. Rreshtat më të vjetër se 24 orë pastrohen në mënyrë oportuniste gjatë mutacioneve të stafit.

## Gabimet

- Përdorues pa GitHub session ridrejtohet te hyrja dhe kthehet te tokeni pa e ruajtur në storage afatgjatë.
- Profil i palidhur hap formularin e aktivizimit; pas suksesit vazhdon check-in-in nëse tokeni vlen ende.
- Mospërputhja me regjistrin kthen një mesazh të përgjithshëm.
- Token i skaduar kërkon skanim të QR-së aktuale.
- Dështim i databazës nuk shfaq sukses të simuluar.
- Student pa telefon shtohet manualisht me arsye.
- Rifreskimi i projektorit rindërton listën nga databaza dhe nuk zgjat afatin.

## Testimi dhe kriteret e pranimit

Testet e njësive kontrollojnë normalizimin, token hashing, afatet, retry dhe maskimin e emrit. Testet e integrimit përdorin PostgreSQL të izoluar dhe provojnë rolet, aktivizimin, unikësinë, grupin, skadimin, idempotencën, renditjen live dhe auditin.

Testi end-to-end përdor GitHub OAuth të simuluar lokalisht dhe mbulon:

1. profesori hyn dhe krijon sesionin;
2. studenti aktivizon profilin;
3. profesori projekton QR;
4. studenti skanon;
5. emri shfaqet i pari dhe totali bëhet 1;
6. skanimi i dytë nuk krijon rekord tjetër;
7. tokeni i skaduar refuzohet;
8. studenti nuk mund të krijojë QR ose të lexojë listën e plotë;
9. ndërprerja dhe rikthimi i polling-ut pajtojnë listën;
10. korrigjimi ruhet në audit.

Pas testeve lokale, sistemi publikohet në Vercel dhe testohet me llogarinë GitHub `arbenl`. Testi real kontrollon hyrjen GitHub, krijimin e QR-së dhe pamjen live me të dhëna sintetike. Asnjë student real nuk ngarkohet para se piloti të kalojë.

## Publikimi

Aplikacioni vendoset në një nënfolder të repos dhe publikohet si projekt i veçantë Vercel. `arbenl.github.io/attendance.html` ridrejton te URL-ja Vercel pasi piloti kalon. Deri atëherë faqja vazhdon të dështojë mbyllur.

Neon krijohet përmes Vercel Marketplace në planin falas. Vercel Hobby dhe Neon Free mjaftojnë për pilotin mësimor; përdorimi institucional rishikon kushtet dhe kufijtë përpara zgjerimit.

## Jashtë fushës

- email OTP dhe SMTP;
- Supabase;
- GPS, Wi-Fi ose Bluetooth si provë vendndodhjeje;
- notimi automatik dhe publikimi i pikëve;
- të dhëna reale studentësh gjatë testimit;
- përdorim institucional përtej kursit pilot.
