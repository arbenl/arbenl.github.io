# Nga skica te tri faqe që punojnë

![Kolegji AAB](img/aab_logo_white.png){width=1.8in}

Programimi për Pajisje Mobile · 01.10.2026

I njëjti prezantim 45-minutësh për G1 dhe G2

# Çfarë sollëm nga Java 2?

- Problemi: Arta kërkon një vend për në AAB.
- Skica: lista, detajet, kërkesa në pritje.
- PRD (Product Requirements Document): çfarë duhet të ndodhë.
- Sot: secili ekran merr vendin e vet në aplikacion.

# Pyetja e Artës

“Pashë nisjen në 08:00. Ku i gjej vendtakimin dhe vendet e lira?”

Nga lista duhet të hapet udhëtimi që Arta zgjodhi.

# Tri adresa, tri detyra

| Adresa | Çfarë sheh Arta? |
|---|---|
| `/` | Lista e nisjeve |
| `/udhetimi/1` | Detajet e udhëtimit 1 |
| `/udhetimi/1/kerkesa` | Simulim: Në pritje |

# Dosjet bëhen adresa

```text
src/app/page.tsx                       → /
src/app/udhetimi/[id]/page.tsx         → /udhetimi/1
src/app/udhetimi/[id]/kerkesa/page.tsx → /udhetimi/1/kerkesa
```

App Router i Next.js lidh dosjet me adresat.

# Faqe apo komponent?

- Faqja ka adresën e vet, për shembull `/udhetimi/1`.
- Komponenti është pjesë e ripërdorshme e pamjes.
- `KartaUdhetimi` shfaqet tri herë në të njëjtën listë.

# Një burim për tri karta

```ts
const udhetimet = [
  { id: "1", nisja: "Prishtinë", ora: "08:00", vende: 2 },
  { id: "2", nisja: "Fushë Kosovë", ora: "08:15", vende: 1 },
  { id: "3", nisja: "Lipjan", ora: "07:45", vende: 0 }
];
```

Fillojmë me të dhëna fiktive. Në Javën 4 vjen baza e të dhënave.

# Lidhja ruan zgjedhjen

```tsx
<Link href={`/udhetimi/${udhetim.id}`}>
  Shiko detajet
</Link>
```

Karta me ID `2` hap `/udhetimi/2`.

# Detajet lexojnë ID-në

```ts
const { id } = await params;
const udhetim = udhetimet.find((u) => u.id === id);
```

Në versionet aktuale të Next.js, `params` pritet me `await`.

# Kur ID nuk ekziston

Nëse dikush hap `/udhetimi/99`, shfaqim 404 me `notFound()`.

Nuk tregojmë detajet e një udhëtimi tjetër.

# “Në pritje” sot është simulim

- Klikimi hap një ekran demonstrimi.
- Asgjë nuk i dërgohet shoferit.
- Rezervimin dhe konfirmimin real i shtojmë më vonë.

# Prova në telefon

- Lista lexohet pa lëvizje horizontale.
- Prekja e kartës hap udhëtimin e duhur.
- “Kthehu te lista” të kthen te zgjedhjet.
- ID e panjohur jep përgjigje të qartë.

# Demonstrimi i profesorit

1. Hapim listën e tri udhëtimeve.
2. Zgjedhim një udhëtim dhe kontrollojmë detajet.
3. Kalojmë te “Simulim: Në pritje”.
4. Ndryshojmë ID në adresë dhe shohim 404.

[Hap demonstrimin e Javës 3](https://arbenl.github.io/lendet/2026-2027/mobile/java-03/demo/)

# Tani kalojmë në ushtrime

- Një grup të dhënash fiktive.
- Tri faqe të lidhura.
- Një komponent i ripërdorshëm.
- Tri prova të shkruara në `java-03.md`.

Të njëjtën rrjedhë mund ta përdorësh për shërbimet e biznesit tënd.
