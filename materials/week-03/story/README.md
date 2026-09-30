# Ligjërata 3: shpjegim dhe pjesëmarrje

Prezantimi ka 18 slajde për të njëjtën ligjëratë 45-minutëshe. Përmbajtja bazë mbetet: komponenti i kartës, të dhënat fiktive, App Router, ruajtja e ID-së, `notFound()`, zero vende dhe kërkesa e simuluar.

Hapja lidh problemin e Artës me një situatë të njohur. Tre pyetje zbulojnë përgjigjen pasi klasa të parashikojë rezultatin. Rrjedhat dhe kartat janë elemente HTML dhe forma të redaktueshme në PowerPoint. Një ilustrim përdoret në hapje.

Frymëzimi për strukturën:

- [Duarte: Storytelling framework](https://www.duarte.com/resources/storytelling-framework/) — nga gjendja aktuale te një mundësi që audienca mund ta kuptojë.
- [Penn State: Assertion–Evidence](https://writing.engr.psu.edu/assertion_evidence_EA.html) — një mesazh i qartë, i mbështetur nga shembull ose shpjegim vizual.

## Skedarët dhe eksporti

- Prezantimi: `lendet/2026-2027/mobile/java-03/prezantimi-ligjerates.html`.
- Ilustrimi: `lendet/2026-2027/mobile/java-03/story/arta-mengjes.jpg`.
- Eksporti: `python3 scripts/build-week03-lecture.py` (Python me lxml dhe Pandoc të instaluar).
- Skripti lexon HTML-në, përditëson Markdown-in, krijon PowerPoint-in v3 me tekst të redaktueshëm dhe përditëson hash-in në manifest. Pastaj `npm run build` përditëson faqet e gjeneruara.
- Pyetjet në HTML kanë përgjigje që zbulohen me klikim. Në PowerPoint përgjigjet janë të dukshme në të njëjtin slajd. Për pyetjet me zbulim përdoret prezantimi online.

## Prejardhja e ilustrimit

Mjeti: built-in `imagegen`. Personazhi dhe situata janë fiktivë. Imazhi i gjeneruar është kthyer në JPEG 1600 px për shkarkim më të shpejtë; nuk përmban të dhëna studentësh.

Prompti i përdorur:

> Use case: illustration-story. Asset type: wide hero illustration for an Albanian university lecture about a fictional RideShare app. Create an evocative cinematic editorial illustration of Arta, a fictional 20-year-old Albanian student with a backpack and dark hair, at an ordinary bus stop in Kosovo in the morning, holding her smartphone and looking thoughtfully toward the road. A few distant cars and a university-like building create context. The story is about uncertainty before choosing a ride to campus, then agency through a simple app. Landscape 16:9 composition, Arta on the right half; left half has spacious dark navy morning atmosphere for separately added lecture title. Rich navy, warm sunrise coral and restrained turquoise highlights, textured painterly graphic-novel illustration, sophisticated and inviting for university students, believable proportions. No rendered text, no logos, no UI close-up, no diagrams, no watermarks, no branded campus architecture. This is a fictional teaching illustration, not a photograph.
