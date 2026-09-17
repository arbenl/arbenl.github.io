# Aktivizimi dhe përdorimi i vijueshmërisë

## Gjendja e dorëzimit

Portali dhe moduli janë implementuar lokalisht në degën `codex/student-portal-attendance`.
Konfigurimi publik është bosh me qëllim: pa serverin e aktivizuar faqja shfaq qartë se nuk pranon regjistrime. Nuk ka regjistrim zyrtar në localStorage, fjalëkalim pedagogu në JavaScript ose sukses të simuluar.

## Aktivizimi (një herë)

1. Zgjidh projektin Supabase të kursit. Mos përdor projekte të tjera pa konfirmuar pronësinë dhe qëllimin. `ai-mobile-lila` u gjet joaktiv gjatë auditimit; nuk u ndryshua.
2. Apliko `supabase/migrations/20260917071851_attendance_portal.sql` në projektin e zgjedhur. Migrimi krijon vetëm skemën e re `attendance_private` dhe funksionin `public.attendance_api`; nuk prek tabelat ekzistuese të aplikacioneve të tjera. Kontrollo paraprakisht mungesën e emrave konfliktues. Konfigurimi lokal `supabase/config.toml` nuk duhet shtyrë verbërisht te një projekt ekzistues.
3. Në Auth, aktivizo konfirmimin e emailit. Konfiguro SMTP për dërgim real; shërbimi i parazgjedhur nuk është zgjidhje për një klasë të tërë. Vendos kufij dërgimi të përshtatshëm për numrin e studentëve. Për shabllonet **Magic Link** dhe **Confirm signup**, përdor `supabase/templates/otp.html` me `{{ .Token }}`. Faqja pret kodin, jo klikim në magic link. Site URL: `https://arbenl.github.io`; OTP rekomandohet 10 minuta, me kufizim të ridërgimit. Provo dërgimin dhe verifikimin në një adresë studentore para përdorimit në klasë.
4. Në `attendance-config.js`, vendos vetëm URL-në e projektit dhe çelësin **publishable** ose **anon**. Këto janë publike. Kurrë `service_role`, `sb_secret_...`, SMTP password ose database password.
5. Pedagogu hyn një herë me email të verifikuar. Nga SQL Editor i autorizuar cakto rolin me adresën e saktë:

   ```sql
   insert into attendance_private.staff(user_id)
   select id from auth.users
   where lower(email) = lower('EMAILI-I-PEDAGOGUT')
     and email_confirmed_at is not null
   on conflict do nothing;
   ```

   Verifiko që u shtua rreshti i duhur. Rihap faqen. Roli nuk merret nga fusha të modifikueshme të profilit. Stafi i autorizuar menaxhon të gjithë semestrat në këtë instalim; mos shto studentë si staf.
6. Publiko skedarët e gjeneruar, `attendance.html`, `attendance-config.js`, `assets/`, `index.html` dhe `styles.css` në GitHub Pages. Repo përdor `main` dhe rrënjën e projektit për publikim; ndryshimet në degë nuk dalin automatikisht online.
7. Testo një sesion pilot me dy llogari të kontrolluara: hyrje me email, skanim, konfirmim në sallë, mbyllje, raport dhe eksport. Kontrollo QR në projektorin real nga rreshti i fundit. Përcakto me institucionin periudhën e ruajtjes, qasjen e stafit dhe procedurën e korrigjimit.

## Përpara semestrit

Krijo semestrin / kursin, zakonisht 15 javë. Shto regjistrin zyrtar në panelin privat:

```text
numri-i-studentit; Emri Mbiemri; emaili-i-verifikuar; G1
```

Një rresht për student, pa header. Pranohen 1–500 rreshta për import. Importi është atomik: një gabim/duplikat e anulon të gjithë importin; korrigjo rreshtat dhe provo përsëri. Numri dhe emaili janë unikë brenda semestrit. Emaili i listës, jo zgjedhja arbitrare e domenit nga studenti, përcakton qasjen. Mos vendos lista reale në GitHub, dokumentacion ose skedarë testimi.

Shto listën **përpara** hapjes së orës. Studentët e shtuar më vonë nuk penalizohen për sesionet e mëparshme. Ndryshimi i emailit, grupit ose datës së regjistrimit historik kërkon ndërhyrje të kontrolluar administrative në databazë; nuk ofrohet redaktim arbitrar nga studenti.

## Në çdo ligjëratë ose ushtrim

1. Zgjidh semestrin, javën, llojin dhe grupin (`*` për të gjithë; `G1` vetëm atë grup). Vendos titull të dallueshëm dhe hap sesionin.
2. Shfaq QR. Pamja e projektorit fsheh emrat dhe raportet. QR prodhohet lokalisht në shfletues; nuk dërgohet në një shërbim të jashtëm QR.
3. Studentët hyjnë paraprakisht me email, skanojnë QR dhe konfirmojnë skanimin. QR ndryshon çdo 25 sekonda; serveri e pranon për 40 sekonda. Lidhja e skanuar hiqet nga historia e adresës dhe mbahet vetëm në memorie.
4. Ndalo ndarjen e ekranit të projektorit para hapjes së regjistrit me emra. Mbyll skanimet dhe rifresko listën. Kontrollo identitetin fizik / kartelën e studentit dhe konfirmo individualisht. Shëno arsyen e verifikimit. Për student pa telefon, përdor të njëjtin kontroll dhe regjistrim manual.
5. Refuzo skanimet pa prani fizike ose arsyeto mungesën sipas rregullave të institucionit. Nuk lejohet përfundimi ndërkohë që ka regjistrime në pritje.
6. Përfundo evidencën. Vetëm tani ora hyn në përqindjen e semestrit. Anulo një orë që nuk u mbajt; nuk llogaritet në emërues. Ora e përfunduar nuk rihapet për QR, por stafi mund të korrigjojë evidencën me arsye të audituar.

## Kufiri i provës së pranisë

Një QR mund të fotografohet ose të përcillet brenda afatit. QR dinamik dhe emaili i verifikuar kufizojnë abuzimin, por **nuk provojnë vetëm ata praninë fizike**. Garancia praktike e këtij versioni është që skanimi krijon vetëm `pending`; pjesëmarrja numërohet vetëm pasi pedagogu verifikon identitetin në sallë. Mos konfirmo mekanikisht listën e skanimeve. Kufizimi me Wi-Fi institucional mund të shtohet vetëm pasi IT të japë IP-të publike të sakta dhe politikat e rrjetit; nuk është implementuar dhe as ai nuk provon identitetin fizik.

## Raporti dhe korrigjimet

Për çdo student shfaqen orët e ligjëratave dhe ushtrimeve veçmas, me status për secilin sesion. Prania e konfirmuar / orët e përfunduara të grupit pas hyrjes në listë jep përqindjen. Orët e arsyetuara, të anuluara dhe ende në proces nuk futen në emërues. `0/0` shfaqet si `—`, jo 0%. Refuzimi i skanimit në një orë të përfunduar llogaritet si mosprani. Ky është rregulli i implementuar; konfirmoje kundrejt rregullores së kursit para përdorimit zyrtar. Nuk vendos automatikisht notë ose të drejtë provimi.

CSV përfshin matricën e sesioneve dhe dy përmbledhjet; fushat që mund të interpretohen si formula neutralizohen. Ruaje eksportin në hapësirë institucionale me qasje të kufizuar. `attendance_private.audit` ruan aktorin, veprimin, arsyen dhe kohën e ndryshimeve administrative. Nuk ka komandë publike për fshirjen e evidencës. Për backup dhe rikthim përdor procedurën e projektit Supabase, jo browser localStorage.

## Zhvillimi dhe testet

```sh
npm ci
npm run build
npm test
npm run test:db  # Docker; PostgreSQL i izoluar, fshihet pas testit
supabase start -x studio,realtime,storage-api,imgproxy,edge-runtime,logflare,vector,supavisor
python3 -m http.server 8765 --bind 127.0.0.1
```

Konfigurimi lokal përdor portet 56431–56434 për të mos prekur projektet e tjera. Mailpit lokal merr vetëm email provë. Vendos përkohësisht URL-në/çelësin publik lokal në konfigurim dhe rikthe konfigurimin para publikimit. `supabase stop` ndal vetëm këtë projekt lokal. Mos përdor të dhëna reale në test.

Testet SQL përdorin një fixture minimal të `auth.users` në PostgreSQL për kontrollin e lejeve dhe logjikës; testet manuale në Supabase lokal mbulojnë edhe hyrjen reale OTP. Shfletuesi ruan sesionin e autentikimit për hyrje të vazhduar; evidenca e pjesëmarrjes ruhet vetëm në databazë.

Burime teknike: [Supabase OTP](https://supabase.com/docs/reference/javascript/auth-signinwithotp), [verifikimi OTP](https://supabase.com/docs/reference/javascript/auth-verifyotp), [funksionet dhe privilegjet](https://supabase.com/docs/guides/database/functions), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security). Kontrolluar më 17 shtator 2026.
