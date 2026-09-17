# Mobile dhe regjistrimi automatik — 17 shtator 2026

## Rezultati

Pedagogu shfaq QR në mes të ligjëratës/ushtrimeve. Hapet një dritare 2-minutëshe në server. Studenti që ka hyrë paraprakisht skanon QR dhe hap lidhjen; pa shtypur ndonjë buton tjetër, prania ruhet si `present` për atë sesion. Nuk ka miratim të detyrueshëm nga pedagogu. Pa identifikim, studenti duhet të verifikojë emailin; nëse QR skadon gjatë hyrjes, e skanon sërish.

QR rrotullohet çdo 25 sekonda dhe vlen deri në 40 sekonda, por nuk tejkalon afatin dyminutësh. Hapja e përsëritur e projektorit nuk e zgjat dritaren. Serveri refuzon skanimet jashtë afatit; raporti e shënon sesionin të përfunduar në leximin e radhës. Lidhja mund të përcillet brenda afatit: ky mekanizëm kufizon abuzimin, nuk është provë absolute e vendndodhjes.

## Kontrolli me Swift në Mac

U përdor Apple Swift 6.4 me `WKWebView` dhe `WKSnapshotConfiguration`, jo një fotografi e modeluar. Skripti i riprodhueshëm është `scripts/mobile-audit.swift`:

```sh
xcrun swift scripts/mobile-audit.swift https://arbenl.github.io /tmp/before-390 390 844
python3 -m http.server 8765 --bind 127.0.0.1
xcrun swift scripts/mobile-audit.swift http://127.0.0.1:8765 /tmp/after-390 390 844
```

Skripti përdor sesion WebKit pa ruajtje të përhershme, gjeneron PNG dhe JSON me përmasat, elementet e dukshme më të vogla se 44 px dhe burimet e ngarkuara. Nuk lexon profile, cookies apo llogari të shfletuesit të përdoruesit.

U kontrolluan gjerësitë **320, 390, 430, 768 dhe 1280 px** dhe lidhja direkte `#week-7`. Nuk u gjet dalje horizontale e dokumentit. Në pamjet fillestare 320/390/430 px, pas përmirësimit nuk kishte kontrolle të dukshme më të vogla se 44 px. Java e lidhur direkt hapej e zgjeruar. Tabelat e gjera kanë lëvizje brenda komponentit; kjo nuk nënkupton dalje horizontale të gjithë faqes.

Ky është WebKit në macOS me madhësi dhe user-agent telefoni; **nuk është test në iPhone fizik**, dhe nuk simulon plotësisht tastierën iOS, VoiceOver, safe-area ose rrjetin celular. Duhet ende një provë në telefon dhe në projektorin e sallës.

## Çfarë u përmirësua

- Menyja në telefon u reduktua në Kursi, Javët, Detyrat dhe Prania, me zona prekjeje ≥44 px. Skedat e studentit/profilit nuk priten më; kontrollet native `select` morën lartësi të shprehur për WebKit.
- Hyrjet kryesore dhe zgjedhësi i javës shfaqen përpara përshkrimit të gjatë të kursit. Fokusimi me tastierë dhe lidhjet direkte ruhen.
- U hoq varësia nga Google Fonts. Faqja përdor fontet e sistemit dhe nuk kërkon font nga palë të treta.
- Fotografia e profilit tani ngarkohet vetëm kur nevojitet. Në auditin e faqes publike ajo shkarkonte rreth **140 KB**, edhe pse pamja e profilit nuk ishte hapur; në pamjen studentore të versionit të ri nuk u kërkua fare.
- CSS/JavaScript u minifikuan. JavaScript i portalit është skedar i jashtëm me `defer`, i ripërdorshëm nga cache. Versionet sipas përmbajtjes shmangin përzierjen e HTML-së së re me skripte të vjetra.
- U hoqën eventet JavaScript inline dhe u shtua Content Security Policy me `script-src 'self'`, pa `unsafe-inline`/`unsafe-eval` për skripte. Faqja e vijueshmërisë kufizon lidhjet në serverët e parashikuar dhe nuk dërgon token QR te shërbime të jashtme.

Matjet e kohës në JSON janë diagnostike: faqja publike dhe serveri lokal nuk kanë të njëjtin rrjet, kompresim ose cache. Prandaj nuk pretendohet një përqindje përshpejtimi nga krahasimi i kohëve. Ulja e varësive dhe heqja e kërkesës së fotografisë janë ndryshime të verifikuara.

## Testet funksionale

- `npm run build` dhe `npm test` kaluan.
- `npm run test:db`: 17 kontrolle PostgreSQL për izolimin e studentëve, autentikimin, mosdyfishimin, QR të gabuar/skaduar, grupin, dritaren që nuk zgjatet dhe përfundimin automatik.
- Supabase lokal, vetëm llogari sintetike: krijim i sesionit të ri të ushtrimeve, zgjedhje e saktë e tij, shfaqje QR, hyrje në lidhjen e QR si student pa klikim konfirmimi, ruajtje `present`, mbyllje nga projektori dhe përditësim i raportit në 1/1.
- Navigimi te java 10, kthimi në Kursi dhe ndërrimi SQ/EN funksionuan me CSP aktive; nuk u raportuan gabime JavaScript në këtë rrjedhë.

## Publikimi

Ndryshimet janë në PR #2; nuk është bërë merge në faqen aktive. Konfigurimi publik mbetet bosh deri në zgjedhjen/aktivizimin e Supabase dhe SMTP-së së kursit. Pas vendosjes së URL/çelësit publik në `attendance-config.js`, ekzekuto `npm run build` për versionimin e saktë të konfigurimit. Asnjë e dhënë reale studentësh nuk u përdor gjatë testimit.

Referencë për metodën: [Apple — WKSnapshotConfiguration](https://developer.apple.com/documentation/webkit/wksnapshotconfiguration).
