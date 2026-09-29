# Nga skica te tri faqe që punojnë

![Kolegji AAB](img/aab_logo_white.png){width=1.8in}

Programimi për Pajisje Mobile · 01.10.2026

I njëjti prezantim 45-minutësh për G1 dhe G2

# Çfarë sollëm nga Java 2?

- Problemi: Arta kërkon një vend për në AAB.
- Skica: lista, detajet, kërkesa në pritje.
- PRD (Product Requirements Document – dokumenti i kërkesave të produktit): çfarë duhet të ndodhë.
- Sot: secili ekran merr vendin e vet në aplikacion.

# Pyetja e Artës na tregon çfarë të ndërtojmë

“Pashë nisjen në 08:00. Ku i gjej vendtakimin dhe vendet e lira?”

Nevoja → Veprimi → Rezultati

- Arta kërkon më shumë hollësi për udhëtimin që pa.
- Ajo prek “Shiko detajet” te ajo kartë.
- Hapet faqja e **atij** udhëtimi, jo e një tjetri.

# Rruga e Artës: tri ekrane të lidhura

1. **Lista** `/` → Arta zgjedh kartën me ID 2.
2. **Detajet** `/udhetimi/2` → lexon orën dhe vendtakimin.
3. **Kërkesa** `/udhetimi/2/kerkesa` → sheh simulimin “Në pritje”.

ID 2 ruhet gjatë gjithë rrjedhës.

# Dosjet bëhen adresa

```text
src/app/page.tsx                       → /
src/app/udhetimi/[id]/page.tsx         → /udhetimi/1
src/app/udhetimi/[id]/kerkesa/page.tsx → /udhetimi/1/kerkesa
```

App Router i Next.js lidh dosjet me adresat. E njëjta dosje `[id]` hap udhëtimin 1, 2 ose 3; nuk krijojmë skedar të ri për secilin.

# Faqja dhe komponenti

- Faqja `/` ka adresën e vet dhe vendos çfarë shfaqet.
- Brenda saj, i njëjti komponent `KartaUdhetimi` shfaqet tri herë.
- Kartat kanë modelin e njëjtë, por të dhëna të ndryshme.

# Një burim për tri karta

```ts
const udhetimet = [
  { id: "1", nisja: "Prishtinë", ora: "08:00", vende: 2 },
  { id: "2", nisja: "Fushë Kosovë", ora: "08:15", vende: 1 },
  { id: "3", nisja: "Lipjan", ora: "07:45", vende: 0 }
];
```

Karta dhe faqja e detajeve lexojnë të njëjtën listë. Kështu ora e kartës nuk kundërshton orën te detajet. Në Javën 4 do t'i lexojmë të dhënat nga baza.

# Lidhja ruan zgjedhjen

```tsx
<Link href={`/udhetimi/${udhetim.id}`}>
  Shiko detajet
</Link>
```

Karta me ID `2` → klikimi → `/udhetimi/2`. Numri në adresë i tregon faqes cilat të dhëna të lexojë.

# Detajet lexojnë ID-në

```ts
const { id } = await params;
const udhetim = udhetimet.find((u) => u.id === id);
```

Në versionet aktuale të Next.js, `params` pritet me `await`.

`/udhetimi/2` → `id = "2"` → gjej udhëtimin 2.

# Kur ID nuk ekziston

Pyetja: a gjendet ID në listën e udhëtimeve?

- Po, ID 2 → shfaq detajet e udhëtimit 2.
- Jo, ID 99 → thirr `notFound()` dhe shfaq 404.

Nuk tregojmë detajet e një udhëtimi tjetër vetëm për të mbushur ekranin.

# “Në pritje” është simulim, jo rezervim

- Sot: klikimi shfaq “Simulim: Në pritje”; asgjë nuk ruhet dhe shoferi nuk merr njoftim.
- Më vonë: kërkesa do të ruhet, shoferi do të përgjigjet dhe statusi do të ndryshojë.
- Nëse udhëtimi ka zero vende, nuk ofrojmë butonin “Kërko vend”.

# Prova në telefon

- Lista lexohet pa lëvizje horizontale.
- Prekja e kartës hap udhëtimin e duhur.
- “Kthehu te lista” të kthen te zgjedhjet.
- ID e panjohur jep përgjigje të qartë.

# Parashiko, pastaj provo në demonstrim

1. Para klikimit të kartës 2: cila adresë duhet të hapet? `/udhetimi/2`.
2. Në detaje: nga vjen vendtakimi? Nga i njëjti objekt i udhëtimit.
3. Te karta me zero vende: a lejohet kërkesa? Jo.
4. Te ID `99`: a duhet të shfaqet udhëtimi 1? Jo, 404.

[Hap demonstrimin e Javës 3](https://arbenl.github.io/lendet/2026-2027/mobile/java-03/demo/)

# Tani kalojmë në ushtrime

- Një grup të dhënash fiktive.
- Tri faqe të lidhura.
- Një komponent i ripërdorshëm.
- Tri prova të shkruara në `java-03.md`.

Të njëjtën rrjedhë mund ta përdorësh për shërbimet e biznesit tënd.
