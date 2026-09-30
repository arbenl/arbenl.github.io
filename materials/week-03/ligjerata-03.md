# 07:42. Arta ka një problem.

Duhet të shkojë në AAB. Ka telefon. Ka pak kohë. Nuk e di cilin udhëtim të zgjedhë.

Sot, një skicë bëhet një rrugë që mund ta ndjekë.

# Sa mesazhe duhen për një përgjigje?

Arta 07:42 Niset dikush për AAB?

Një shofer 07:43 Po, në 08:15.

Arta 07:44 Ku takohemi? A ka ende vend?

Informacioni ekziston. Por Arta ende nuk mund të vendosë.

Aplikacioni e vendos orën, vendtakimin dhe vendet e lira në një rrjedhë të qartë.

✋ Kush ka pritur ndonjëherë një përgjigje të tillë?

# Arta ka 10 sekonda. Çfarë e ndihmon?

**Një bisedë e gjatë**

Ora diku më lart. Vendtakimi në mesazh tjetër. Vendet ende të paqarta.

**Tri karta të qarta**

Nga niset? Kur? Sa vende ka? Një veprim: “Shiko detajet”.

Zgjidh A ose B dhe thuaj pse.

B e ndihmon të krahasojë. Një kartë përmbledh zgjedhjen; detajet vijnë kur i duhen.

# Skica na tregoi çfarë. Sot e bëjmë të punojë.

Lista → Detajet → Kërkesa

PRD (Product Requirements Document – dokumenti i kërkesave të produktit) përcakton sjelljen.

**Një prekje hap udhëtimin e duhur.**

Ndërtojmë tri faqe, një model karte dhe përgjigje për rastet kur diçka mungon.

45 minuta: 5 historia · 20 sqarimet · 12 demonstrimi · 8 rikujtim dhe pyetje.

# Tri ekrane. Një zgjedhje që nuk humbet.

- 01 Lista / Arta krahason dhe zgjedh kartën 2. “Cilin udhëtim dua?”

- 02 Detajet /udhetimi/2 Lexon orën, vendtakimin dhe vendet. “A më përshtatet?”

- 03 Kërkesa /udhetimi/2/kerkesa Sheh “Simulim: Në pritje”. Asgjë nuk dërgohet. “Çfarë ndodh pas klikimit?”

ID (identifier – identifikuesi) 2 e mban të njëjtin udhëtim në të tri ekranet.

# Ndrysho një kartë. Përmirëso të tria.

FAQJA / · zgjedhjet e Artës

Prishtinë → AAB 08:00 · 2 vende KartaUdhetimi · ID 1

Fushë Kosovë → AAB 08:15 · 1 vend KartaUdhetimi · ID 2

Lipjan → AAB 07:45 · 0 vende KartaUdhetimi · ID 3

**Faqja është ekrani.**

Ka adresën e vet dhe vendos cilat pjesë shfaqen.

**Komponenti është modeli.**

KartaUdhetimi përdoret tri herë, me të dhëna të ndryshme.

Nëse zmadhojmë tekstin në komponent, të tri kartat bëhen më të lexueshme.

# Ora e kartës duhet të jetë edhe ora e detajeve.

```tsx
const udhetimet = [
  { id: "1", ora: "08:00", vende: 2 },
  { id: "2", ora: "08:15", vende: 1 },
  { id: "3", ora: "07:45", vende: 0 }
];
```

Fragment i thjeshtuar: objektet përmbajnë edhe nisjen dhe vendtakimin.

Karta 08:15

Detajet 08:15

Dy pamje lexojnë të njëjtin burim.

Të dhënat janë fiktive në Javën 3. Në Javën 4 i lidhim me bazën e të dhënave.

# Klikimi duhet të mbajë mend kartën 2.

Karta 2 → “Shiko detajet” → /udhetimi/ 2

```tsx
<Link href={`/udhetimi/${udhetim.id}`}>
  Shiko detajet
</Link>
```

udhetim.id vjen nga karta që u prek. href tregon adresën që do të hapet.

URL (Uniform Resource Locator – adresa e burimit) është si një adresë shtëpie: na çon te vendi i saktë.

# Një dosje [id] hap shumë udhëtime.

src/app/page.tsx → /

src/app/udhetimi/[id]/page.tsx → /udhetimi/2

src/app/udhetimi/[id]/kerkesa/page.tsx → /udhetimi/2/kerkesa

[id] është një vend që ndryshon: 1, 2, 3…

App Router i Next.js e kthen strukturën e dosjeve në adresa. I njëjti skedar detajesh hap udhëtimin e kërkuar.

Edhe po të kishim 100 udhëtime, nuk do të krijonim 100 faqe detajesh.

# Faqja pyet: “Cilin udhëtim kërkove?”

/udhetimi/2 → id = "2" → Objekti me ID 2

1. Lexo adresën. Marrim numrin e udhëtimit nga params . Në Next.js 16 e presim me await .

2. Gjej përputhjen. find kërkon në listë objektin që ka po atë ID.

Nuk marrim “kartën e dytë” sipas renditjes. Kërkojmë identitetin "2" .

# Po nëse dikush shkruan /udhetimi/99?

Nuk kemi udhëtim 99. Çfarë duhet të shohë Arta?

ID 2 ekziston Shfaq detajet e udhëtimit 2.

ID 99 mungon Shfaq udhëtimin 1? Ekran bosh? Apo përgjigje të qartë?

404 · Udhëtimi nuk u gjet. Shpjegojmë çfarë mungon dhe ofrojmë “Kthehu te lista”. Nuk shfaqim të dhënat e dikujt tjetër.

# Një buton është një premtim.

**07:45**

0 vende të lira

Nuk ka vende të lira

Arta ende mund të lexojë detajet.

Nëse nuk ka vend, nuk ofrojmë “Kërko vend”.

Butoni i çaktivizuar dhe shpjegimi tregojnë pse veprimi nuk mund të kryhet.

Çfarë do të mendonit për një aplikacion që premton një vend që nuk ekziston?

Kontrollojmë kushtin vende > 0 përpara se të ofrojmë veprimin.

# “Në pritje” nuk do të thotë “Vendi u rezervua”.

**Simulim: Në pritje**

Hapet ekrani pas klikimit. Nuk ruhet kërkesë. Shoferi nuk merr njoftim.

**Kërkesë e ruajtur**

Ruhet në bazë. Shoferi mund të përgjigjet. Statusi përditësohet.

Sot provojmë navigimin dhe kuptimin e ekranit. Rezervimi real kërkon hapa të tjerë.

# 20 sekonda: ndiqe zgjedhjen e Artës.

Arta zgjodhi kartën 2 dhe tani prek “Kërko vend”.

A /udhetimi/1/kerkesa

B /udhetimi/2/kerkesa

C /kerkesa

Cila adresë e ruan zgjedhjen? Shpjegoja personit pranë teje.

B. ID 2 mbetet në adresë. Pa të, nuk dimë për cilin udhëtim po bëhet kërkesa.

# Tani parashikojmë. Pastaj klikojmë.

**Karta 2**

A hap detajet e Fushë Kosovës?

**Kërko vend**

A e thotë qartë që është simulim?

**Zero vende**

A ndalet veprimi me shpjegim?

**ID 99**

A na ndihmon të kthehemi?

Para çdo klikimi: çfarë prisni të ndodhë dhe pse?

[Hap demonstrimin e Javës 3 ↗](https://arbenl.github.io/lendet/2026-2027/mobile/java-03/demo/)

Demonstrimi vizual përdor adresa të simuluara. Në ushtrime i ndërtojmë me App Router të Next.js.

# Prova e vërtetë e lexueshmërisë: telefoni.

**Fushë Kosovë → AAB**

08:15 · 1 vend

📍 Te stacioni kryesor

← Kthehu te lista

01 · Lexo. Teksti kuptohet pa zmadhim dhe pa lëvizje horizontale.

02 · Prek. Veprimi kryesor dallohet dhe hap udhëtimin e duhur.

03 · Kthehu. “Kthehu te lista” e rikthen Artën te zgjedhjet.

Pse ka rëndësi kthimi? Arta mund të ndryshojë mendim.

# Punë që mund ta mbyllni brenda ushtrimeve.

3 faqe të lidhura Lista · Detajet · Simulimi

1 komponent karte I ripërdorur për tri udhëtime

3 prova të dokumentuara ID 2 · zero vende · ID 99

Plotësoni java-03.md , dorëzoni në GitHub dhe lexoni raportin e kontrollit. Mbajmë kohë për korrigjime deri në fund të orës.

G1: lidhni këto sqarime me punën e bërë në 14:45. G2: i zbatoni hap pas hapi në ushtrimet e 18:15.

[Hap prezantimin e ushtrimeve →](https://arbenl.github.io/lendet/2026-2027/mobile/java-03/prezantimi-ushtrimeve.html)

# Një prekje. Tani e dini çfarë fshihet pas saj.

Problemi → Skica → Karta → Adresa → Përgjigjja

**Arta nuk mendon për komponentët. Ajo kupton ku të klikojë dhe çfarë ndodh.**

Ju tashmë mund ta shpjegoni dhe ta ndërtoni këtë rrugë.

E njëjta ide shërben për një termin, një shërbim ose një porosi në aplikacionin e biznesit tuaj.

Para se të mbyllim: çfarë i jep kuptim numrit 2 në adresë?

RideShare është shembulli ynë i përbashkët në ushtrime. Projekti juaj përfundimtar i shërben një biznesi real.
