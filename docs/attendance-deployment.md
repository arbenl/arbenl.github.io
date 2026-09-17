# Aktivizimi dhe përdorimi i vijueshmërisë

## Gjendja e dorëzimit

Portali dhe moduli janë implementuar lokalisht në degën `codex/student-portal-attendance`.
Konfigurimi publik është bosh me qëllim: pa serverin e aktivizuar faqja shfaq qartë se nuk pranon regjistrime. Nuk ka regjistrim zyrtar në localStorage, fjalëkalim pedagogu në JavaScript ose sukses të simuluar.

## Aktivizimi (një herë)

1. Zgjidh projektin Supabase të kursit. Mos përdor projekte të tjera pa konfirmuar pronësinë dhe qëllimin. `ai-mobile-lila` u gjet joaktiv gjatë auditimit; nuk u ndryshua.
2. Apliko të dy migrimet në `supabase/migrations/`, sipas rendit të emrit në projektin e zgjedhur. Migrimi krijon vetëm skemën e re `attendance_private` dhe funksionin `public.attendance_api`; nuk prek tabelat ekzistuese të aplikacioneve të tjera. Kontrollo paraprakisht mungesën e emrave konfliktues. Konfigurimi lokal `supabase/config.toml` nuk duhet shtyrë verbërisht te një projekt ekzistues.
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
7. Testo një sesion pilot me dy llogari të kontrolluara: hyrje me email, skanim automatik, skadim të dritares, raport dhe eksport. Kontrollo QR në projektorin real nga rreshti i fundit. Përcakto me institucionin periudhën e ruajtjes, qasjen e stafit dhe procedurën e korrigjimit.

## Përpara semestrit

Krijo semestrin / kursin, zakonisht 15 javë. Shto regjistrin zyrtar në panelin privat:

```text
numri-i-studentit; Emri Mbiemri; emaili-i-verifikuar; G1
```

Një rresht për student, pa header. Pranohen 1–500 rreshta për import. Importi është atomik: një gabim/duplikat e anulon të gjithë importin; korrigjo rreshtat dhe provo përsëri. Numri dhe emaili janë unikë brenda semestrit. Emaili i listës, jo zgjedhja arbitrare e domenit nga studenti, përcakton qasjen. Mos vendos lista reale në GitHub, dokumentacion ose skedarë testimi.

Shto listën **përpara** hapjes së orës. Studentët e shtuar më vonë nuk penalizohen për sesionet e mëparshme. Ndryshimi i emailit, grupit ose datës së regjistrimit historik kërkon ndërhyrje të kontrolluar administrative në databazë; nuk ofrohet redaktim arbitrar nga studenti.

## Në çdo ligjëratë ose ushtrim

1. Zgjidh semestrin, javën, llojin dhe grupin (`*` për të gjithë; `G1` vetëm atë grup). Vendos titullin dhe krijo sesionin. Krijimi i sesionit nuk nis ende afatin e skanimit.
2. Në mes të orës, shfaq QR në projektor. Shfaqja e parë hap një dritare **2-minutëshe** sipas orës së serverit. Rihapja/rifreskimi i projektorit nuk e zgjat afatin.
3. Studenti i identifikuar skanon me kamerën e telefonit dhe hap lidhjen. Faqja e regjistron menjëherë si `present`, pa buton konfirmimi dhe pa miratim nga pedagogu. Nëse nuk ka hyrë ende, fillimisht verifikon emailin; nëse QR skadon ndërkohë, duhet të skanojë QR aktual përsëri.
4. QR ndryshon çdo 25 sekonda dhe vlen deri në 40 sekonda, gjithmonë brenda dritares së përgjithshme. Pas 2 minutash serveri refuzon çdo skanim, edhe nëse pedagogu e ka mbyllur shfletuesin ose pajisja humbet internetin. Raporti e përfundon automatikisht sesionin kur lexohet pas afatit. Nuk kërkohet kontroll manual i listës.
5. Mund ta mbyllësh edhe më herët me **Mbyll regjistrimin tani** në pamjen e projektorit ose **Mbyll dhe përfundo** në panel. Projektori mbetet në pamjen publike; nuk shfaq emrat e studentëve.
6. Regjistrimi manual / arsyetimi përdoret vetëm për përjashtime dhe korrigjime (p.sh. student pa telefon), me arsye dhe gjurmë auditimi. Ora që nuk u mbajt mund të anulohet përpara përfundimit. Përpara kthimit në regjistrin privat, ndalo ndarjen e ekranit.

## Kufiri i provës së pranisë

Ky version zbaton kërkesën e pedagogut: **skano dhe përfundo**. QR i shkurtër dhe emaili i verifikuar zvogëlojnë abuzimin, por një student mund ta përcjellë lidhjen brenda afatit. Nuk pretendohet provë absolute e pranisë fizike dhe nuk ka konfirmim manual të detyrueshëm. Wi-Fi institucional / GPS nuk janë implementuar. Regjistrimi lidhet me identitetin e listës së kursit, sesionin e hapur dhe kohën e serverit.

## Raporti dhe korrigjimet

Për çdo student shfaqen orët e ligjëratave dhe ushtrimeve veçmas, me status për secilin sesion. Prania e regjistruar / orët e përfunduara të grupit pas hyrjes në listë jep përqindjen. Orët e arsyetuara, të anuluara dhe ende në proces nuk futen në emërues. `0/0` shfaqet si `—`, jo 0%. Refuzimi i skanimit në një orë të përfunduar llogaritet si mosprani. Ky është rregulli i implementuar; konfirmoje kundrejt rregullores së kursit para përdorimit zyrtar. Nuk vendos automatikisht notë ose të drejtë provimi.

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

CSP: faqja e vijueshmërisë lejon lidhje me domenet standarde `*.supabase.co` dhe portin lokal të testit. Nëse përdor domen personal Supabase, shtoje shprehimisht te `connect-src` në `attendance.html`. Mos shto `unsafe-inline` ose `unsafe-eval` për JavaScript.
