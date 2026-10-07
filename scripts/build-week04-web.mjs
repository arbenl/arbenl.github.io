// Browser projector decks and PowerPoint share the same slide content JSON.
import {readFile,writeFile} from 'node:fs/promises';
const dir='materials/week-04';
const e=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
for(const kind of ['lecture','lab']){
 const slides=JSON.parse(await readFile(`${dir}/${kind}-slides.json`,'utf8'));
 const label=kind==='lecture'?'Ligjërata':'Ushtrimet';
 const sections=slides.map((d,i)=>{
  let content=`<p class="eyebrow">${e(d.kicker)} · ${String(i+1).padStart(2,'0')} / ${slides.length}</p>`;
  if(i===0)content+='<img class="slide-logo" src="/img/aab_logo_white.png" alt="Kolegji AAB">';
  content+=`<h2>${e(d.title)}</h2>`;
  if(d.openingImage)content+=`<figure class="opening-illustration"><a href="${e(d.openingImage)}" target="_blank" rel="noopener"><img src="${e(d.openingImage)}" alt="${e(d.openingAlt)}"></a></figure>`;
  if(d.diagram)content+=`<figure class="ecosystem"><a href="${e(d.diagram)}" target="_blank" rel="noopener"><img src="${e(d.diagram)}" alt="${e(d.diagramAlt)}"></a><figcaption>Hape ilustrimin për ta zmadhuar ↗</figcaption></figure>`;
  if(d.table)content+='<div class="table-scroll"><table><thead><tr>'+d.table[0].map(c=>`<th scope="col">${e(c)}</th>`).join('')+'</tr></thead><tbody>'+d.table.slice(1).map((r,j)=>'<tr'+(d.selectRow===j+1?' class="choose-row"':'')+'>'+r.map((c,k)=>`<td>${d.selectRow===j+1&&k===0?`<button class="choose-trip" aria-pressed="false" type="button">${e(c)} · Zgjidh</button>`:e(c)}</td>`).join('')+'</tr>').join('')+'</tbody></table></div>';
  content+='<div class="explanations">'+d.body.map(p=>`<p>${e(p)}</p>`).join('')+'</div>';
  if(d.code)content+=`<pre><code>${e(d.code)}</code></pre>`;
  if(d.answer)content+=`<button class="reveal" aria-expanded="false" aria-controls="answer-${i}">Zbulo përgjigjen</button><p class="answer" id="answer-${i}" hidden>${e(d.answer)}</p>`;
  if(d.quiz){const q=d.quiz;content+=`<fieldset class="quiz"><legend>${e(q.question)}</legend>`+q.options.map((o,j)=>`<button type="button" data-correct="${j===q.correct}" aria-pressed="false">${String.fromCharCode(65+j)} · ${e(o)}</button>`).join('')+`<p class="vote-status" role="status" aria-live="polite">Votoni A, B ose C. Diskutoni 30 sekonda në çift para përgjigjes.</p><div class="quiz-actions"><button class="quiz-reveal" type="button" aria-expanded="false" aria-controls="quiz-answer-${i}" disabled>Zbulo përgjigjen pas diskutimit</button><button class="quiz-reset" type="button">Voto përsëri</button></div><p class="quiz-answer" id="quiz-answer-${i}" role="status" aria-live="polite" data-explanation="${e(q.explanation)}" hidden></p></fieldset>`;}
  if(d.checklist)content+=`<fieldset class="readiness" data-complete="${e(d.checklistComplete)}"><legend>Kontrolloni projektin së bashku</legend>`+d.checklist.map((item,j)=>`<label><input type="checkbox" id="ready-${i}-${j}"><span>${e(item)}</span></label>`).join('')+`<p class="readiness-status" role="status" aria-live="polite">0 / ${d.checklist.length} kontrolle. Nëse diçka mungon, rregullojeni para se të vazhdoni.</p></fieldset>`;
  if(d.href)content+=`<p><a class="story-cta" href="${e(d.href)}" target="_blank" rel="noopener"${d.href.endsWith('.md')?' download="java-04.md"':''}>${e(d.link)}</a></p>`;
  if(d.sources)content+='<details class="sources"><summary>Burime zyrtare</summary>'+d.sources.map(u=>`<a href="${e(u)}" target="_blank" rel="noopener">${e(new URL(u).hostname)}</a>`).join(' · ')+'</details>';
  return `<section class="step"${d.openingImage?' data-opening="true"':''} aria-label="Slajdi ${i+1}">${content}</section>`;
 });
 const header=`<!doctype html><html lang="sq"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${label} 4 · RideShare, Neon dhe PostgreSQL</title><link rel="stylesheet" href="../java-02/week.css"><link rel="stylesheet" href="../java-02/projector.css"><link rel="stylesheet" href="../java-02/lecture.css"><link rel="stylesheet" href="../java-03/week-03.css"><link rel="stylesheet" href="week-04.css"></head><body data-start-projector="true"><main><nav aria-label="Navigimi"><a href="./">← Java 4</a><a href="ushtrimet.html">Hapat dhe kodi</a><button id="mode" type="button">Hap në projektor</button></nav><h1>${label} 4 · RideShare dhe Neon</h1><p class="intro">08.10.2026 · ${kind==='lecture'?'45 minuta për grup · G1 16:30 · G2 17:15':'90 minuta · G1 14:45 · G2 18:15'} · Shigjetat ← → kalojnë slajdet; Esc kthen pamjen e plotë.</p>`;
 const footer='<div id="controls" hidden><button id="prev" type="button">← Para</button><span id="counter" aria-live="polite"></span><button id="next" type="button">Tjetri →</button><button id="exit" type="button">Mbyll pamjen e projektorit</button></div></main><script src="../java-02/projector.js"></script><script src="../java-03/lecture-story.js"></script><script src="week-04.js"></script></body></html>';
 await writeFile(`${dir}/prezantimi-${kind==='lecture'?'ligjerates':'ushtrimeve'}.html`,header+sections.join('\n')+footer);
}
