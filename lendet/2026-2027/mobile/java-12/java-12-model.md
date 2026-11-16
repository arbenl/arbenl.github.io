# RideShare — Java 12 · Validimi dhe siguria mobile

## Çfarë ndërtova
[PLOTËSO] Çfarë ndryshove te pranimi ekzistues në server? Pse fshehja e butonit nuk mjafton?

## Përgatitja
[PLOTËSO] ID fiktive, vendet fillestare, shoferi pronar, dy udhëtarët dhe sesionet e ndara. Mos publiko kredenciale, cookies, token-e ose të dhëna reale.

## Provat që bëra
### Rasti 1 · Pranimi i vlefshëm
- ID e udhëtimit dhe kërkesës, vendet para/pas: [PLOTËSO]
- Veprimi, përgjigjja reale dhe gjendja e ruajtur: [PLOTËSO]
- Çfarë pa udhëtari pas rileximit: [PLOTËSO]
- Përsëritja me të njëjtën ID dhe numri i vendeve: [PLOTËSO]

### Rasti 2 · Serveri refuzon veprimin e palejuar
- Si e thirre veprimin nga sesioni i udhëtarit në projektin tënd: [PLOTËSO]
- Kodi/mesazhi real, statusi dhe vendet e pandryshuara: [PLOTËSO]
- Prova pa sesion dhe me ID të pavlefshme; çfarë ndryshove: [PLOTËSO]

### Rasti 3 · Vendi i fundit, vetëm një fitues
- Udhëtim i ri me 1 vend dhe dy ID kërkesash në pritje: [PLOTËSO]
- Si nise dy thirrje pa pritur përfundimin e së parës dhe ku verifikove mbivendosjen: [PLOTËSO]
- Dy përgjigjet reale, kërkesat e pranuara dhe vendet e ruajtura: [PLOTËSO]
- Çfarë panë të dy udhëtarët pas rileximit; prova me rend të kundërt: [PLOTËSO]

## Ku gjendet puna
[PLOTËSO] Rrugët e skedarëve të serverit, leximi i sesionit, kontrolli i pronarit, skema/migrimi dhe testi. Përshkruaj si lidhen statusi dhe vendet në një operacion të mbrojtur. Vendos linkun e aplikacionit nëse e ke publikuar.

## Prova me kolegun
[PLOTËSO] ID/rendi i ri i zgjedhur nga kolegu, parashikimi yt, rezultati dhe funksioni që e shpjegon.

## Kufizimi dhe përmirësimi
[PLOTËSO] Çfarë nuk punoi ose nuk u provua ende? Raportoje ndershmërisht. Pamja e demonstrimit nuk është provë e serverit tënd.

## Ndihma nga AI (Artificial Intelligence – inteligjencë artificiale)
[PLOTËSO] Çfarë ndihme more dhe si e verifikove vetë, ose: Nuk përdora AI.

## Pas dorëzimit të parë
Ky seksion mund të mbetet kështu fillimisht. Më pas shto linkun e Issue-t, commit-in e kontrolluar dhe çfarë përmirësove. Përgjigjja 2/2 kontrollon strukturën e raportit dhe package.json; nuk teston automatikisht sigurinë, databazën apo garën mes shkrimeve dhe nuk është notë.
