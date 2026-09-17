# Ligjërata 1 dhe check-in-i live — dizajni

**Data:** 17 shtator 2026
**Statusi:** Dizajn i miratuar në bisedë; në pritje të rishikimit të dokumentit
**Fusha:** Ligjërata 1, regjistrimi fillestar i studentit dhe pamja live e pjesëmarrjes

## Qëllimi

Ligjërata e parë duhet t'i bindë studentët se brenda 15 javëve mund të ndërtojnë një aplikacion real për një biznes që e njohin. Gjatë çdo ligjërate dhe ushtrimi, profesori duhet të regjistrojë pjesëmarrjen me një QR të shkurtër dhe ta shohë klasën duke u plotësuar si listë e renditur në projektor.

Dizajni ka dy pjesë të ndara:

1. Historia e restorantit familjar zëvendëson vetëm shembullin RideShare në Ligjëratën 1. Temat teknike, plani 15-javor, ushtrimet dhe rregullat e kursit mbeten.
2. QR-ja e pjesëmarrjes shfaqet në mes të orës dhe regjistron praninë. QR-ja e demonstrimit në fund të Ligjëratës 1 hap aplikacionin shembull dhe nuk ndikon në pjesëmarrje.

## Vendimet e dizajnit

U shqyrtuan tri mënyra për të kufizuar check-in-et nga jashtë sallës:

- **QR i shkurtër dhe listë live — zgjedhja e miratuar.** Funksionon në çdo telefon, e bën numrin dhe emrat të dukshëm dhe nuk varet nga lejet e vendndodhjes ose rrjeti i kampusit. Nuk provon fizikisht vendndodhjen, por e bën abuzimin të dukshëm dhe të korrigjueshëm.
- **QR me GPS.** Ndal shumicën e studentëve që provojnë nga shtëpia, por kërkon leje të vendndodhjes, mund të japë rezultate të pasakta brenda ndërtesës dhe mund të manipulohet.
- **QR vetëm në Wi-Fi të sallës.** Jep sinjal më të fortë të pranisë, por kërkon infrastrukturë dhe koordinim me AAB-në; mund të përjashtojë telefona që përdorin internetin mobil.

Faza e parë përdor zgjedhjen e miratuar. GPS-i dhe kontrolli i Wi-Fi-t mbeten jashtë fushës derisa të dalë nevojë reale pas pilotit.

## Historia e Ligjëratës 1

### Premisa

Një restorant familjar pranon porosi me telefon dhe Instagram. Një porosi humbet, adresa mungon dhe klienti nuk e di kur ushqimi është gati. Studentët e njohin problemin përpara se të shohin teknologjinë.

### Harku narrativ 90-minutësh

1. **00–12 minuta — Mesazhi.** Një klient shkruan: “A mund të porosis?” Studenti mendon: “E njoh këtë problem.”
2. **12–30 minuta — Kaosi.** Shfaqen porosia e humbur, adresa e paplotë dhe mungesa e statusit. Studenti sheh koston e problemit.
3. **30–52 minuta — Vendimi.** Klasa e ndan zgjidhjen në menu, shportë, porosi dhe status. Studenti sheh se produkti ndërtohet hap pas hapi.
4. **52–75 minuta — Ndërtimi.** Next.js, Supabase, RLS, puna offline dhe testet lidhen me rrjedhën e porosisë.
5. **75–90 minuta — Prova live.** Studentët skanojnë QR-në e demonstrimit, bëjnë një porosi dhe shohin statusin “Gati”.

Ligjërata mbyllet me mesazhin: **“15 javë më vonë, këtë mund ta ndërtoni ju. Filloni me një biznes. Gjeni një problem. Ndërtoni një rrjedhë që funksionon.”**

Dy koncepte marrin shpjegim të shkurtër me shembullin e restorantit. **PRD** është dokumenti i shkurtër që përcakton përdoruesin, problemin, rrjedhën, kufijtë dhe kriteret e pranimit para kodimit. **PWA** është aplikacion web i përshtatur për telefon që hapet nga një link, mund të instalohet dhe mund të ketë sjellje të planifikuar offline.

RideShare hiqet si historia udhëheqëse. Nëse mbetet diku si ilustrim dytësor, etiketohet qartë “shembull” dhe jo “projekti i studentit”.

## Identiteti i studentit

### Regjistrimi i parë

Studenti hap faqen e check-in-it dhe verifikon emailin me OTP. Faqja kërkon emrin, mbiemrin dhe Student ID-në vetëm herën e parë. Veprimi RPC `activate_profile` merr `semester_id`, `first_name`, `last_name` dhe `student_number`. Serveri kërkon një rresht të listës zyrtare me emailin e verifikuar dhe Student ID-në e dhënë, pastaj e lidh atë rresht me `auth.uid()`.

Emaili normalizohet me shkronja të vogla dhe `trim`. Student ID-ja krahasohet pas `trim`, por ruhet në formën e listës zyrtare. Emri dhe mbiemri bashkohen me një hapësirë; krahasimi shpërfill madhësinë e shkronjave dhe hapësirat e shumëfishta, por ruan dhe kërkon të njëjtat shkronja diakritike. Përgjigjja kthen emrin kanonik nga lista, jo tekstin e studentit. Një mospërputhje kthen një gabim të përgjithshëm dhe nuk zbulon se cila fushë ishte gabim.

Tabela `roster` fiton fushat `user_id uuid references auth.users(id)` dhe `activated_at timestamptz`, plus kufizimin `unique (semester_id, user_id)`. Ato fillojnë `null` për rreshtat ekzistues; nuk ndryshohen emri, Student ID-ja, emaili ose evidenca historike. Aktivizimi vendos të dy fushat në një transaksion dhe refuzon një rresht të lidhur më parë ose një lidhje tjetër të të njëjtit përdorues brenda atij semestri. I njëjti `auth.users` mund të lidhet me nga një rresht në semestra të ndryshëm. Studenti nuk mund të krijojë vetë një identitet jashtë listës.

Pas aktivizimit, shfletuesi ruan sesionin e hyrjes. Veprimet `scan` dhe `report` kërkojnë `roster.user_id = auth.uid()` dhe nuk mbështeten më vetëm te emaili. `bootstrap` përdor emailin vetëm për të treguar titujt dhe ID-të e semestrave ku studenti mund të aktivizohet; pas aktivizimit e gjen semestrin edhe me `user_id`. Ai nuk kthen emër, Student ID ose të dhëna të studentëve të tjerë. Në orët e tjera studenti skanon QR-në dhe regjistrimi përfundon pa plotësuar përsëri formularin. Nëse sesioni i hyrjes ka skaduar, studenti verifikon sërish emailin; profili i kursit mbetet.

### Të dhënat

Lista zyrtare vazhdon të ruajë emailin, Student ID-në, emrin e plotë në fushën ekzistuese `name`, grupin dhe datën e pranimit në kurs. Fushat e reja `user_id` dhe `activated_at` regjistrojnë aktivizimin. Tabela e pjesëmarrjes ruan sesionin, studentin, statusin dhe kohën e serverit. Faqja publike dhe repoja nuk përmbajnë listën reale të studentëve.

## Rrjedha e check-in-it

1. Profesori krijon sesionin për javën, llojin e orës dhe grupin.
2. Në mes të orës zgjedh **Shfaq QR në projektor**.
3. Serveri hap një dritare dyminutëshe. Rifreskimi i faqes nuk e zgjat.
4. QR-ja ndryshon çdo 25 sekonda dhe çdo token vlen deri në 40 sekonda, pa kaluar fundin e dritares.
5. Studenti i identifikuar e skanon. Serveri e regjistron vetëm një herë për atë sesion dhe kthen konfirmimin **“U regjistrua”**.
6. Pamja e projektorit kërkon një pamje të plotë të listës nga serveri çdo sekondë dhe e zëvendëson listën lokale. Studenti i ri shfaqet në fund të renditjes.
7. Pas dy minutash, serveri mbyll skanimet. Lista ngrin dhe shfaq totalin përfundimtar.

Ora e serverit përcakton çdo afat. Telefoni i studentit dhe shfletuesi i projektorit nuk mund ta zgjasin sesionin.

## Pamja e projektorit

Pamja e projektorit bashkon QR-në dhe listën live pa zbuluar panelin privat të profesorit.

```text
CHECK-IN LIVE — Ligjërata 3

01. Arta K.       10:42:03  ✓
02. Leon B.       10:42:07  ✓
03. Diellza H.    10:42:11  ✓
04. Erion M.      10:42:15  ✓

TË PRANISHËM: 4
Koha e mbetur: 01:18
```

Renditja bazohet në `coalesce(scanned_at, verified_at)`, pastaj në `roster_id` si renditje dytësore. Hyrja e re shfaqet me një theksim të shkurtër dhe numri total rritet menjëherë. Në projektor shfaqen emri dhe iniciali i mbiemrit, të formuar nga serveri. Paneli privat ruan emrin e plotë, Student ID-në dhe kohën e saktë.

Kur dritarja mbyllet, klienti bën një kërkesë të fundit të suksesshme, ndal polling-un dhe shfaq: **“Check-in përfundoi — 42 të pranishëm.”** Kjo është pamja e konfirmuar në mbyllje; paneli privat mbetet evidenca zyrtare nëse profesori bën korrigjime më vonë. Pamja nuk shfaq email, Student ID, përqindje semestrale ose kontrolle administrative.

## Zbulimi dhe korrigjimi i abuzimit

QR-ja mund të fotografohet ose të dërgohet brenda afatit; sistemi nuk pretendon provë absolute të vendndodhjes. Dizajni e kufizon dhe e bën të dukshëm këtë rrezik:

- tokeni skadon shpejt dhe dritarja e përgjithshme zgjat dy minuta;
- çdo llogari mund të regjistrohet vetëm një herë;
- emri shfaqet menjëherë në renditje;
- totali krahasohet me numrin e studentëve në sallë;
- profesori mund ta mbyllë dritaren menjëherë;
- profesori mund ta ndryshojë një hyrje të dyshimtë në `rejected` nga paneli privat, me arsye dhe gjurmë auditimi.

Studentët e shohin këtë rregull para skanimit: **“Mos e shpërndani QR-në. Çdo hyrje shfaqet live dhe regjistrohet me kohën e serverit.”**

## Komponentët

### Faqja e studentit

Menaxhon OTP-në, aktivizimin e profilit, skanimin automatik dhe konfirmimin. Ajo shfaq gabime konkrete për profil të papërputhur, QR të skaduar, sesion të mbyllur dhe grup të gabuar.

### Pamja e projektorit

Shfaq QR-në aktuale, kohën e mbetur, renditjen dhe totalin. Ajo kërkon sesion të stafit dhe thërret `attendance_api('live', {'session_id': ...})` çdo sekondë. RPC-ja kthen një pamje të plotë:

```json
{
  "session_id": "uuid",
  "state": "open",
  "server_time": "2026-09-17T08:42:15Z",
  "checkin_ends_at": "2026-09-17T08:44:00Z",
  "entries": [
    {
      "roster_id": "uuid",
      "display_name": "Arta K.",
      "recorded_at": "2026-09-17T08:42:03Z"
    }
  ],
  "total": 1
}
```

Vetëm stafi mund ta thërrasë veprimin. `entries` përmban vetëm regjistrimet me status `present`; `total` është gjatësia e kësaj liste. Klienti përdor `roster_id` vetëm si çelës UI dhe nuk e shfaq.

### Paneli i profesorit

Krijon sesione, hap ose mbyll dritaren, sheh identitetin e plotë, korrigjon statuset me arsye dhe eksporton raportin e semestrit.

### API-ja dhe databaza

Funksioni i serverit kontrollon rolin, listën zyrtare, grupin, afatin dhe duplikatet. `activate_profile` lidh përdoruesin e verifikuar me një rresht të listës. `live` u kthen vetëm stafit kontratën minimale të mësipërme, të renditur sipas kohës së regjistrimit dhe `roster_id`. Tabelat private mbeten të paarritshme drejtpërdrejt nga shfletuesi; nuk aktivizohet Supabase Realtime për to.

Veprimi ekzistues `verify` mbetet mekanizmi i vetëm i korrigjimit. `present` shton studentin në listën live; `rejected` dhe `excused` e heqin. Nëse studenti ka skanuar më parë, rikthimi në `present` ruan pozicionin e kohës së skanimit. Një shtim manual pa skanim përdor `verified_at` dhe shfaqet në fund sipas kohës së verifikimit. Pas mbylljes, korrigjimet ndryshojnë raportin zyrtar; pamja e ngrirë e projektorit ndryshon vetëm nëse ringarkohet.

## Gabimet dhe përjashtimet

- **Studenti nuk gjendet në listë:** faqja nuk e aktivizon profilin dhe e udhëzon të kontaktojë profesorin.
- **Të dhënat nuk përputhen:** faqja nuk tregon se cila fushë e listës është e saktë; kjo shmang zbulimin e të dhënave të studentëve.
- **QR-ja skadon gjatë hyrjes:** studenti skanon QR-në aktuale në projektor.
- **Interneti ndërpritet:** serveri pranon vetëm kërkesat që mbërrijnë brenda afatit; faqja nuk simulon sukses.
- **Studenti i pranishëm nuk ka telefon:** profesori e shton nga paneli privat me arsye të detyrueshme.
- **Hyrje e dyshimtë:** profesori e kalon në `rejected` ose e rikthen në `present`; sistemi ruan aktorin, arsyen dhe kohën.
- **Projektori rifreskohet:** serveri vazhdon të njëjtën dritare dhe rindërton renditjen nga databaza.
- **Polling-u dështon:** lista e fundit mbetet e dukshme, zbehet dhe etiketohet **“Lidhja u ndërpre — të dhënat mund të jenë të vjetruara”**. Totali etiketohet **“i fundit i konfirmuar”** dhe nuk paraqitet si përfundimtar.
- **Rikthimi i lidhjes:** klienti provon pas 1, 2, 4 dhe pastaj çdo 5 sekonda. Përgjigjja e parë e suksesshme zëvendëson tërë listën dhe heq paralajmërimin.
- **Lidhja mungon në mbyllje:** projektori nuk shfaq total përfundimtar; shfaq **“Check-in u mbyll — rilidhu për totalin”** derisa të marrë pamjen e fundit nga serveri.

## Siguria dhe privatësia

OTP-ja, lista zyrtare dhe roli i stafit përcaktojnë qasjen. Faqja përdor vetëm çelësin publik të Supabase; sekretet nuk dalin në GitHub Pages. API-ja u kthen studentëve vetëm të dhënat e tyre. Pamja e projektorit tregon identitet minimal dhe hapet vetëm nga llogaria e profesorit.

Institucioni duhet të caktojë periudhën e ruajtjes, personat me qasje dhe procedurën e korrigjimit. Eksportet ruhen në hapësirë institucionale me qasje të kufizuar.

## Testimi

Testet e databazës duhet të provojnë:

- aktivizimin vetëm kur emaili, Student ID-ja dhe emri përputhen me listën;
- refuzimin e përdoruesit anonim, emailit të paverifikuar dhe grupit të gabuar;
- regjistrimin idempotent të një studenti për sesion;
- renditjen sipas kohës së serverit;
- renditjen dytësore sipas `roster_id` kur kohët janë të barabarta;
- qasjen e listës live vetëm nga stafi;
- skadimin e tokenit dhe të dritares dyminutëshe;
- pamundësinë e rifreskimit për ta zgjatur dritaren;
- auditimin e korrigjimeve.

Testi në shfletues duhet të mbulojë regjistrimin e parë, skanimin në një telefon të vogël, shtimin live në projektor, heqjen dhe rikthimin pas korrigjimit, rifreskimin e projektorit, mbylljen automatike, retry-n dhe reconciliation pas ndërprerjes së internetit. Piloti përdor vetëm llogari provë; lista reale ngarkohet pasi të miratohet ruajtja e të dhënave.

Prezantimi testohet veçmas: versioni i studentit nuk përmban speaker notes, versioni i profesorit i ruan ato dhe të dy versionet e bëjnë të qartë dallimin midis QR-së së pjesëmarrjes dhe QR-së së demonstrimit.

### Artefaktet e prezantimit

Versioni privat i profesorit është burimi kanonik i redaktueshëm:

`/Users/arbenlila/Documents/AAB/Programimi-Mobile-2026-2027/java-01/Ligjerata-01-PROFESORI-me-notes.pptx`

Ai ruhet edhe në dosjen private të kursit në Google Drive. Nuk publikohet në GitHub Pages. Versioni i studentit krijohet nga i njëjti deck duke hequr speaker notes dhe ruhet në:

`materials/lectures/ligjerata-01-aab-biznes-real-2026-v2.pptx`

Për përputhshmëri, i njëjti skedar studentor kopjohet edhe te alias-i publik:

`Jave1_Hyrje_Nextjs_PWA_Copilot_2026.pptx`

`materials/manifest.json` vazhdon të përshkruajë vetëm versionin publik të studentit me numrin e slajdeve, SHA-256, `audience: "student"` dhe `speakerNotes: false`. Gjenerimi kontrollon paketën PPTX për mungesën e `ppt/notesSlides` dhe lidhjeve të tyre, renderon të gjitha slajdet dhe kontrollon që dy rrugët publike kanë të njëjtin hash. Versioni i profesorit përditësohet në vend në Google Drive; faqja publike lidhet vetëm me versionin studentor.

## Dorëzimi

Puna ndahet në dy plane implementimi, sepse kanë artefakte, rreziqe dhe verifikim të ndryshëm:

1. **Plani i prezantimit:** përditësimi i burimit privat, krijimi i versionit studentor pa notes, sinkronizimi i dy rrugëve publike dhe Google Drive.
2. **Plani i vijueshmërisë:** migrimi i identitetit, veprimet `activate_profile` dhe `live`, pamja e projektorit, gabimet dhe testet.

Fillimisht sistemi testohet me 2–5 llogari sintetike në Supabase lokal. Pastaj zhvillohet një pilot në projektor me një grup të vogël. Aktivizimi për tërë klasën bëhet vetëm pasi profesori të verifikojë lexueshmërinë e QR-së, ritmin e listës dhe procedurën e korrigjimit.

## Jashtë fushës së kësaj faze

- GPS ose geofence;
- detyrim për Wi-Fi të AAB-së;
- Bluetooth ose pajisje fizike në sallë;
- njohje fytyre;
- vlerësim automatik i detyrave;
- publikim publik i emrit të plotë, Student ID-së ose pikëve.
