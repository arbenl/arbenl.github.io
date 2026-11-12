# Auditimi i Mobile 2026/2027

Skripti lexon një kopje të autorizuar të regjistrit. Nuk ndryshon llogaritë, pjesëmarrjen, testet apo dorëzimet. Nuk përdor AI dhe nuk harxhon kuotë AI.

1. Profesori hyn në `/progress` dhe zgjedh **Shkarko të dhënat për auditimin e gjithë klasës**. Vetëm stafi i autorizuar mund ta shkarkojë këtë kopje; përmban të dhëna personale, prandaj ruaje privatisht dhe mos e shto në Git.
2. Nga dosja `attendance-app`, ekzekuto:

```sh
node --import tsx scripts/audit-mobile-course.mts --snapshot /private/path/mobile-2026-course-audit.json --out /private/path/audit-result.json --verify-github
```

`--verify-github` është opsional: përdor vetëm kërkesa leximi në API të GitHub-it përmes `gh` të kyçur. Nuk lexon ose eksporton kredenciale. Kontrollon që ID-ja e llogarisë përputhet me emrin e ruajtur. Dështimi i API-së shënohet si i panjohur, jo si mungesë llogarie. Ky kontroll nuk mund të dëshmojë që studenti mban kredencialet: kjo konfirmohet gjatë hyrjes me OAuth.

3. Hap raportin privat `audit-result.html`, kërko emrin ose zgjidh **Vetëm për verifikim**. Të dy rezultatet JSON/HTML ruhen me leje 0600.

Kontrollet përfshijnë pjesëmarrjet e konfirmuara sipas seancës (edhe kur studenti ndërron grup), pikët e testeve të publikuara, javët unike të dorëzuara (përfshirë Issues të mbyllura), llogaritë alternative të verifikuara, identifikuesit/email-et/emrat e përsëritur dhe GitHub-in e palidhur ose të pagjetur.

Përqindja tregon dorëzimin e javëve të zhvilluara, jo notën ose rezultatin GREEN të kontrolluesit. Zero check-in-e do të thotë se nuk ka regjistrime të konfirmuara; nuk dëshmon mungesë fizike.

## Si korrigjohen gjetjet

- **Dorëzime nga llogari tjetër:** profesori hap kartën përkatëse, verifikon identitetin dhe një Issue të studentit, pastaj përdor **Verifiko llogarinë e dorëzimeve**. Burimi ruhet me arsyen dhe autorin në regjistrin e auditimit. Kjo nuk i jep llogarisë së dorëzimit të drejtë hyrjeje dhe nuk ndryshon pikë/pjesëmarrje.
- **Hyrje nga pajisje tjetër:** studenti lidh/konfirmon vetë GitHub-in nga karta në pajisjen ku është tashmë i kyçur. Lidhja refuzohet nëse llogaria i përket një përdoruesi tjetër; kërko verifikim nga profesori.
- **Profile ose identifikues të dyfishuar:** verifiko me studentin përpara çdo bashkimi. Emri i njëjtë dhe llogaritë me emra të ngjashëm janë sinjale për rishikim, jo prova identiteti. Skripti nuk bashkon dhe nuk transferon profile.

Kopjet e të dhënave dhe rezultatet reale nuk duhen publikuar në GitHub. Mobile 2025 dhe lëndët e tjera janë jashtë këtij kontrolli.
