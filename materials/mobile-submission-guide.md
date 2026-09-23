# Dorëzimi i detyrave — Programimi për Pajisje Mobile 2026/27

Çdo student ndërton një aplikacion Next.js për një biznes real të zgjedhur prej tij. Shembulli i porosive të ushqimit në ligjërata shpjegon konceptet; nuk është projekt i detyrueshëm për të gjithë.

## Çfarë është aktive sot?

Materialet dhe vijueshmëria janë të publikuara. Notimi automatik i 10 detyrave Mobile dhe totali personal **nuk janë ende të aktivizuar**. Mos përdorni `SUBMISSIONS_2026.md` ose rezultatet MCC për këtë lëndë: ato i përkasin Cloud/MCC. Para çdo detyre do të publikohet lidhja e dorëzimit, afati, rubrika me 3 pikë dhe testet përkatëse. Një kontroll i gjelbër i build-it nuk është vetvetiu nota e detyrës.

## Java 2 — rruga e thjeshtuar

Filloni me [kontrollin e mjeteve](java-02/kontrolli-mjeteve.html). Për skicën dhe PRD-në ndiqni [ushtrimet e javës 2](java-02/ushtrimet.html): ngarkim nga shfletuesi dhe dorëzim i linkut në formularin GitHub, pa Pull Request. Udhëzimet më poshtë janë për detyrat e aplikacionit.

## Si ta përgatitni dorëzimin

1. Mbajeni aplikacionin në një repository GitHub gjatë gjithë semestrit. README-ja përmban biznesin, problemin që zgjidhni, udhëzimet e instalimit dhe lidhjen e demonstrimit.
2. Për detyrën hapni një degë të re, p.sh. `detyra-01` (ndërroni numrin çdo herë).
3. Ndryshoni aplikacionin tuaj sipas kërkesave. Shtoni në `docs/detyra-01.md`: çfarë ndërtuat, si ta provojë dikush tjetër dhe çfarë mbetet për përmirësim. Shtoni shënimin e përdorimit/verifikimit të AI-së, kur e përdorni.
4. Provoni aplikacionin në telefon. Mos ngarkoni `.env`, fjalëkalime, çelësa API ose të dhëna reale të klientëve.
5. Ruani ndryshimet dhe hapni një Pull Request nga dega juaj te `main` i repository-t tuaj. Titulli: `Detyra 01 — emri i biznesit`. Vendosni lidhjen e demos dhe hapat e provës në përshkrim.
6. Dorëzoni lidhjen e këtij PR-je te lidhja zyrtare e detyrës **kur ajo publikohet**. Hapja e PR-së vetëm në repository-n tuaj nuk e njofton automatikisht profesorin dhe ende nuk përbën dorëzim zyrtar.

Në terminal (nga dosja e aplikacionit):

```sh
git switch -c detyra-01
npm ci
npm run build
git status
# Zëvendësoni shtigjet me skedarët që ndryshuat; mos shtoni sekrete.
git add app docs/detyra-01.md
git commit -m "Përfundo detyrën 01"
git push -u origin detyra-01
```

`npm ci` kërkon `package-lock.json` të ruajtur në Git. Nëse përdorni pnpm, ndiqni komandat e publikuara për atë projekt. Në GitHub hapni **Compare & pull request**. Mund të përdorni edhe GitHub Desktop: **New branch → Commit → Publish branch → Create Pull Request**.

## Si do të lexohen pikët dhe feedback-u

Pas aktivizimit të workflow-t zyrtar: hapni PR → **Checks** → **Mobile / Detyra NN** → **Details**. Raporti do të përmbajë kriterin, pikët e fituara/maksimale, testin që dështoi dhe çfarë të përmirësoni. `Pending`, gabimi i shërbimit ose mungesa e testit nuk do të quhen nota 0.

Shembull ilustrues, jo rezultat real:

| Kriteri | Pikët | Feedback |
|---|---:|---|
| Rrjedha kryesore funksionon | 1/1 | Kaloi testi i krijimit të porosisë |
| Validimi i inputit | 0/1 | Shporta bosh pranohet; bllokojeni dhe tregoni mesazhin |
| Përdorimi në telefon | 1/1 | Kaluan kriteret mobile të publikuara |
| Gjithsej | 2/3 | Korrigjoni validimin dhe bëni push në të njëjtën degë |

Pas korrigjimit bëni commit dhe push në të njëjtën degë. Mos hapni një PR të ri për çdo tentim. Rezultati lidhet me commit-in e kontrolluar; rregulli për afatin dhe ridorëzimet publikohet bashkë me detyrën. Totali i 10 detyrave do të jetë deri në 30 pikë; nuk do të mblidhen shumëfish tentimet e së njëjtës detyrë.

## Kalendari i 10 detyrave nga plani ekzistues

| Detyra | Java | Data e orës | Tema |
|---|---:|---|---|
| 01 | 2 | 2026-09-24 | Intervistat, PRD, repo dhe publikimi i parë i aplikacionit të biznesit |
| 02 | 3 | 2026-10-01 | Navigimi dhe rrugët e aplikacionit |
| 03 | 4 | 2026-10-08 | Modeli i pronësisë dhe qasja në të dhëna |
| 04 | 5 | 2026-10-15 | Vendimet e qasjes për përdorues të identifikuar |
| 05 | 6 | 2026-10-22 | Politika e cache-it për kërkesat e aplikacionit |
| 06 | 8 | 2026-11-05 | Vendndodhja me leje të përdoruesit |
| 07 | 9 | 2026-11-12 | Përditësimi dhe rikthimi i listës së preferuar |
| 08 | 10 | 2026-11-19 | Zbatimi idempotent i ngjarjeve të databazës |
| 09 | 12 | 2026-12-03 | Validimi i rezervimit pa besuar të dhënat e klientit |
| 10 | 14 | 2026-12-17 | Kushtet e publikimit të versionit |

Data e orës nuk është afati i dorëzimit. Në `grading/course-plan.json`, e diela 23:59 mbetet `proposed`; pushimet institucionale presin konfirmim.
