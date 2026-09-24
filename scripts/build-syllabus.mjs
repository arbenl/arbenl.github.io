import {readFile, writeFile} from 'node:fs/promises';

const base='/lendet/2026-2027/mobile/';
const pdf=base+'Syllabusi-Programimi-per-Pajisje-Mobile-2026-2027.pdf';
const word=base+'Syllabusi-Programimi-per-Pajisje-Mobile-2026-2027.docx';
const plan=JSON.parse(await readFile('grading/course-plan.json','utf8'));
if(plan.weeks.length!==15)throw new Error('Expected a 15-week Mobile plan');
const gradedWeeks=plan.weeks.filter(w=>w.graded).map(w=>w.week);
if(gradedWeeks.length!==10)throw new Error('Expected ten graded labs');
const esc=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const sectionLink=(anchor,label)=>`<a href="#${anchor}">${label}</a>`;
const outcomes=[
 ['Njohuritë',[
  'Shpjegon dallimin mes aplikacionit web mobil, PWA-së dhe aplikacionit nativ dhe zgjedh një qasje për një problem të dhënë.',
  'Përshkruan rrjedhën nga kërkesa e përdoruesit te komponentët, të dhënat, autentifikimi dhe publikimi.',
  'Identifikon rreziqet e privatësisë, sigurisë dhe performancës në një rrjedhë mobile.',
  'Shpjegon kufijtë e MVP-së dhe kriteret e pranimit për një përdorues real.'
 ]],
 ['Shkathtësitë',[
  'Krijon skicë, PRD të shkurtër dhe rrjedhë funksionale për një shërbim.',
  'Implementon, teston dhe dokumenton funksionet kryesore të aplikacionit Next.js/PWA me të dhëna të mbrojtura.',
  'Provon ndërfaqen në telefon, përfshirë rastin offline, lejet dhe gabimet e zakonshme.'
 ]],
 ['Kompetencat',[
  'Arsyeton vendimet teknike me prova nga testet dhe feedback-u i përdoruesit.',
  'Publikon një aplikacion individual për një biznes real dhe demonstron rrjedhën kryesore.',
  'Dorëzon punën në GitHub me burimet e përdorura, kontributin personal dhe shënim të përdorimit të AI-së.'
 ]]
];
const outcomeNumbers=['1, 4','1, 5','2, 5','2, 6','2, 6','2, 7','1, 5, 8','2, 7','2, 7','2, 6','2, 7','3, 6, 8','3, 8','3, 8','3, 9, 10'];
const weekTitle=w=>w.week===2?'Nga problemi dhe skica te PRD-ja dhe MVP-ja':w.week===7?'MVP-ja dhe kontrolli i rrjedhës kryesore':w.week===15?'Demonstrimi, mbrojtja dhe reflektimi teknik':w.title;
const weeks=plan.weeks.map((w,i)=>`<article class="week" id="java-${w.week}" aria-labelledby="java-${w.week}-titulli"><div class="week-num">JAVA ${String(w.week).padStart(2,'0')}<br><time datetime="${w.date}">${w.date.split('-').reverse().join('.')}</time></div><div><h3 id="java-${w.week}-titulli">${esc(weekTitle(w))}</h3><p><strong>Rezultatet:</strong> ${outcomeNumbers[i]}</p><p><strong>${w.labHours?'Ushtrimet':'Orari'}:</strong> ${w.labHours?esc(w.lab):'Këtë javë ka vetëm ligjëratë.'}</p><a href="${base}java-${String(w.week).padStart(2,'0')}/">Materialet e javës ${w.week} →</a></div></article>`).join('\n');
const outcomeCards=outcomes.map(([title,items],groupIndex)=>`<article class="card"><h3>${title}</h3><ol start="${[1,5,8][groupIndex]}">${items.map(item=>`<li>${esc(item)}</li>`).join('')}</ol></article>`).join('');
const html=`<!doctype html>
<html lang="sq">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="Syllabusi i plotë i lëndës Programimi për Pajisje Mobile në Kolegjin AAB për vitin 2026/2027.">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self'; img-src 'self'; script-src 'none'; object-src 'none'; base-uri 'self'">
<title>Syllabusi · Programimi për Pajisje Mobile · 2026/2027</title>
<link rel="stylesheet" href="/assets/catalog.css">
</head>
<body>
<a class="skip" href="#main">Kalo te përmbajtja</a>
<header><div class="bar"><a class="brand" href="/"><img src="/img/aab_logo_white.png" alt="Kolegji AAB"><span>Arben Lila<br><small>Portali i lëndëve</small></span></a><nav aria-label="Navigimi kryesor"><a href="${base}">Lënda</a><a href="${base}dorezimet.html">Dorëzimet</a><a href="https://aab-mobile-attendance.vercel.app/student">Vijueshmëria ime</a></nav></div></header>
<main id="main">
<nav class="crumb" aria-label="Vendndodhja"><a href="/">Lëndët</a><span>/</span><a href="${base}">Programimi për Pajisje Mobile</a><span>/ Syllabusi</span></nav>
<p class="eyebrow">Kolegji AAB · Bachelor · Semestri V · 2026/2027</p>
<h1>Syllabusi i Programimit për Pajisje Mobile</h1>
<p class="lead">Nga një nevojë reale e një biznesi shërbimesh te një aplikacion mobil që përdoret në telefon. Kjo faqe përmbledh programin 15-javor, rezultatet e të nxënit dhe mënyrën e vlerësimit.</p>
<div class="actions"><a class="button" href="#programi">Shiko 15 javët</a><a class="button secondary" href="${pdf}">Hap PDF-në</a><a class="button secondary" href="${word}">Shkarko Word-in</a></div>
<p class="notice"><strong>Lënda:</strong> 6 ECTS · 2 orë ligjëratë dhe 2 orë ushtrime çdo javë, përveç javës 1 me vetëm ligjëratë. <strong>Pedagogu:</strong> Arben Lila · <a href="mailto:arben.lila@universitetiaab.com">arben.lila@universitetiaab.com</a>. Datat e planifikuara mund të përshtaten me kalendarin zyrtar të AAB-së.</p>
<nav class="week-picker" aria-label="Pjesët e syllabusit">${[['qellimi','Qëllimi'],['rezultatet','Rezultatet'],['programi','15 javët'],['metodologjia','Si zhvillohet lënda'],['vleresimi','Vlerësimi'],['burimet','Burimet'],['politikat','Rregullat']].map(([id,label])=>sectionLink(id,label)).join('')}</nav>
<section id="qellimi" class="section-head"><div><h2>Qëllimi i lëndës</h2><p>Lënda i aftëson studentët të kthejnë një nevojë reale të një biznesi shërbimesh në një aplikacion Next.js/PWA të përdorshëm. Studentët kalojnë nga intervista dhe skica te PRD-ja, MVP-ja, implementimi, testimi dhe publikimi.</p><p><strong>RideShare</strong> është shembulli i përbashkët që ndërtohet në ushtrime. <strong>Projekti individual</strong> është një aplikacion tjetër për një biznes real familjar ose lokal të zgjedhur nga studenti.</p></div></section>
<section id="rezultatet"><div class="section-head"><h2>Rezultatet e të nxënit</h2></div><div class="grid">${outcomeCards}</div></section>
<section id="programi"><div class="section-head"><h2>Programi 15-javor</h2><span class="muted">Ligjëratë dhe ushtrime sipas javës</span></div><p>Ligjërata shpjegon vendimet. Në ushtrime i zbaton në RideShare dhe përdor të njëjtën mënyrë pune për aplikacionin tënd individual.</p><div class="weeks">${weeks}</div></section>
<section id="metodologjia"><div class="section-head"><h2>Si zhvillohet lënda</h2></div><div class="grid"><article class="card"><h3>Ligjëratat</h3><p>Nisin nga një nevojë e biznesit. Profesori demonstron kalimin nga problemi te skica, kërkesa dhe implementimi; studentët krahasojnë alternativa dhe arsyetojnë zgjedhjet.</p></article><article class="card"><h3>Ushtrimet</h3><p>Kontroll i shkurtër i mjeteve, demonstrim në projektor, punë me hapa të vegjël, provë në telefon dhe dorëzim në GitHub. RideShare është projekti i përbashkët i laboratorit.</p></article></div><p class="notice"><strong>Vijueshmëria:</strong> studenti ruan profilin një herë; në çdo ligjëratë ose ushtrim skanon QR-në që hap profesori në projektor. QR-ja evidencon praninë, ndërsa puna në orë tregon angazhimin.</p><p><strong>Dorëzimi:</strong> dorëzo punën në secilën nga 15 javët; 10 ushtrime japin pikë laboratori dhe 5 janë formuese. Përdor repository-n personal dhe <a href="${base}dorezimet.html">udhëzimin me tri hapa</a>. Kontrolli automatik verifikon kërkesat teknike të deklaruara; pikët e cilësisë jepen sipas rubrikës së publikuar. Studenti sheh çfarë duhet përmirësuar.</p></section>
<section id="vleresimi"><div class="section-head"><h2>Vlerësimi</h2><span class="muted">Gjithsej 100 pikë</span></div><div class="grid"><article class="card"><span class="tag">10 pikë</span><h3>Vijueshmëria dhe angazhimi</h3><p>QR për praninë; punë aktive, exit ticket dhe zgjidhje e shpjeguar për angazhimin. Vetëm skanimi nuk provon kryerjen e detyrës.</p></article><article class="card"><span class="tag">30 pikë</span><h3>Ushtrimet RideShare</h3><p>${gradedWeeks.length} nga ${plan.weeks.length} dorëzimet javore vlerësohen × 3 pikë. Javët me pikë: ${gradedWeeks.join(', ')}. Javët e tjera janë për punë formuese, konsultim dhe demonstrim.</p></article><article class="card"><span class="tag">40 pikë</span><h3>Aplikacioni individual</h3><p>Funksionaliteti, përdorshmëria në telefon, siguria, testimi dhe publikimi i aplikacionit për biznes real shërbimesh.</p></article><article class="card"><span class="tag">20 pikë</span><h3>Demo dhe mbrojtja</h3><p>Rrjedha kryesore në telefon, arsyetimi teknik, testet dhe kufijtë e shpjeguar të zgjidhjes.</p></article></div><p>Kontrolli teknik i skedarëve nuk është notë automatike. Rubrika dhe afatet e çdo detyre publikohen në faqen e lëndës. Konvertimi i pikëve në notë bëhet sipas rregullores në fuqi të AAB-së.</p></section>
<section id="burimet"><div class="section-head"><h2>Literatura dhe burimet</h2></div><p>Burimet bazë janë materialet e javës dhe dokumentacioni zyrtar i Next.js për App Router. Sipas temës përdoren MDN Web Docs për PWA dhe Web APIs, dokumentacioni i Supabase për PostgreSQL dhe RLS, dokumentacioni i Vercel për publikim dhe udhëzimet e GitHub për dorëzime.</p></section>
<section id="politikat"><div class="section-head"><h2>Politikat akademike</h2></div><p>Studentët respektojnë orarin, njëri-tjetrin dhe afatet. Dorëzimi është punë e tyre: burimet, komponentët e huazuar dhe ndihma e AI-së shënohen qartë. Çdo student duhet të jetë në gjendje të shpjegojë kodin që dorëzon.</p><p>Ndarja e fotografisë së QR-së ose regjistrimi për dikë tjetër cenon besueshmërinë e evidencës. Historiku i vijueshmërisë është privat; pikët individuale komunikohen studentit përkatës dhe stafit të autorizuar. Politikat zyrtare të AAB-së kanë përparësi mbi këtë plan pune.</p></section>
<div class="actions"><a class="button" href="${base}">Kthehu te lënda</a><a class="button secondary" href="${pdf}">Hap PDF-në</a><a class="button secondary" href="${word}">Shkarko Word-in</a></div>
</main><footer><div>Kolegji AAB · Programimi për Pajisje Mobile · 2026/2027</div></footer>
</body></html>`;
await writeFile('lendet/2026-2027/mobile/syllabusi-2026-2027.html',html);
console.log('Built mobile syllabus web page.');
