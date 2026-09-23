# Ushtrimet 2: kontrolli i mjeteve dhe skicimi i idesë

24 shtator 2026. Qëllimi: të verifikosh ambientin e punës dhe të përgatitësh një plan të vogël për aplikacionin tënd.

## 0. Kontrolli praktik i mjeteve — 20 minuta

Hap [fletën e kontrollit](kontrolli-mjeteve.html). Kryej çdo provë para se ta shënosh “Punon”:

- Hape VS Code, krijo një skedar dhe ruaje.
- Në terminal provo `git --version`, `node --version`, `npm --version`. Shëno versionet. Përdor Node.js 24 LTS për kursin.
- Hyr në GitHub, krijo repository ose përdor atë që ke, dhe ruaj një ndryshim në README.
- Hyr në Vercel. Kontrollo nëse e sheh repository-n tënd për import.
- Hape një faqe tënden të publikuar nga Vercel. Nëse nuk e ke, ndiq provën e vogël te fleta e kontrollit.
- Hape faqen nga telefoni.

Statuset janë **Punon / Ka problem / Mungon / Ende pa provuar**. Raporti është vetëdeklarim pas provës; profesori e verifikon në ekran. Copilot është opsional. Databazën do ta konfigurojmë kur ta përdorim në ushtrime.

Nëse të mungon një mjet, shëno gabimin pa fjalëkalime dhe kërko ndihmë. Mund ta vazhdosh skicimin në letër. Nëse instalimi ose publikimi merr më gjatë, përdor 30 minutat shtesë të një blloku 120-minutësh ose mbështetjen pas ushtrimit. Mos shëno “Punon” pa provë.

## 1. Problemi — 10 minuta

Plotëso: “[Përdoruesi] ka nevojë të [veprimi], sepse sot [pengesa].”

Së bashku bëjmë shembullin RideShare. Pastaj ti zgjedh një nevojë të vogël të biznesit tënd, p.sh. kërkesë termini te berberi ose porosi në një lokal.

## 2. Skica — 15 minuta

Në një fletë vizato tri ekrane telefoni: lista e shërbimeve, detajet dhe rezultati i veprimit. Emërto ekranet dhe butonat. Lidhi me shigjeta. Shëno edhe çfarë ndodh nëse veprimi nuk lejohet. Fotografoje si `skica.jpg` ose `skica.png`.

## 3. PRD-ja — 15 minuta

Shkarko [modelin e gatshëm](java-02-model.md), riemërtoje `java-02.md` dhe plotësoje. Mjafton afërsisht një faqe: problemi, përdoruesi, rrjedha, deri në tri veçori, çfarë shtyn për më vonë dhe si do ta provosh suksesin. [Shembulli RideShare](shembull-rideshare.md) të tregon nivelin e hollësisë.

## 4. Prova në çift — 10 minuta

Jepi kolegut një detyrë, p.sh. “Gjej një termin dhe kërko rezervim”. Lëre ta ndjekë skicën pa i treguar ku të shtypë. Shëno ku u ndal dhe përmirëso një gjë. Ndërroni rolet.

## 5. GitHub nga shfletuesi — 15 minuta

1. Hyr në GitHub. Nëse ke repository për projektin, hape atë. Përndryshe hap [New repository](https://github.com/new?name=mobile-biznesi-im&visibility=public), vendos emrin e projektit dhe krijoje me README.
2. Në repository zgjidh **Add file → Upload files**.
3. Ngarko `java-02.md` dhe `skica.jpg`/`skica.png`. Nëse e ke shkarkuar modelin si ZIP, hape fillimisht dhe ngarko skedarët brenda, jo ZIP-in.
4. Shkruaj mesazhin “Shto ushtrimet e javës 2” dhe ruaji në `main` të repository-t tënd personal. Për këtë ushtrim nuk kërkohet degë ose Pull Request.
5. Kontrollo që të dy skedarët hapen. Mund ta korrigjosh tekstin me ikonën e lapsit dhe ta ruash përsëri.

Nëse repository është privat, jepi qasje profesorit `arbenl` nga Settings → Collaborators. Në skedarë publikë përdor vetëm informacionin e projektit, pa Student ID, fjalëkalime ose të dhëna klientësh.

## 6. Dorëzimi — 5 minuta

Hap [formularin e dorëzimit](https://github.com/arbenl/arbenl-mobile-assignments-2025/issues/new?template=mobile-java-02.yml), vendos linkun e repository-t dhe përfundo formularin. Kjo krijon një issue me numër, që shërben si evidencë e dorëzimit. Llogaria jote GitHub identifikon dorëzimin. Nëse ke dorëzuar më parë, përditëso të njëjtin issue.

Kontrolli i mjeteve ka [formular të veçantë](https://github.com/arbenl/arbenl-mobile-assignments-2025/issues/new?template=mobile-tools.yml). Nëse nuk arrin të hysh në GitHub, tregoji profesorit raportin në ekran ose kopjen e shkarkuar.

## Kontrolli i punës — maksimumi 3 pikë

- **1 pikë:** problemi dhe përdoruesi janë të qartë dhe lidhen me një nevojë konkrete.
- **1 pikë:** tri ekranet tregojnë rrjedhën dhe rezultatin e veprimit.
- **1 pikë:** PRD-ja ka kufijtë, kriteret e pranimit dhe një përmirësim nga prova me kolegun.

Këto kritere i kontrollon profesori. Notimi automatik i skicës dhe i idesë nuk është aktiv. Instalimi i mjeteve është kontroll gatishmërie, jo test me pikë. Afatin përfundimtar e njofton profesori.

Burime për hapat GitHub: [krijimi i repository-t](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-new-repository), [ngarkimi i skedarëve](https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository).
