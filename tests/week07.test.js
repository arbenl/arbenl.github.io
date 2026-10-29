import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {personalCase,demoState,runtimeSteps,offlineSteps} from '../materials/week-07/week-07-model.mjs';
test('week 7 personal cases are stable, safe and leave room for changed-input testing',()=>{
 assert.deepEqual(personalCase(' Arta '),personalCase('arta'));assert.equal(personalCase('arta').code,'P7-974');
 for(const name of ['arta','dritoni','dreni','test-student','a']){const c=personalCase(name);assert.match(c.code,/^P7-\d{3}$/);assert.ok(c.seats>=1&&c.seats<=3);assert.notEqual(c.time,c.newTime);assert.match(c.newTime,/^\d{2}:[0-5]\d$/);}
 for(const name of ['','https://github.com/arta','arta@gmail.com','<script>','a'.repeat(40)])assert.throws(()=>personalCase(name));
});
test('week 7 demo handles normal, no seats, missing id and a stale offline list honestly',()=>{
 const normal=demoState('normal');assert.equal(normal.trip.driver,'Dritoni');assert.equal(normal.trip.seats,2);assert.equal(normal.disabled,false);
 assert.equal(demoState('normal',1).trip.driver,'Dreni');assert.equal(demoState('normal',3).trip.id,3);
 assert.equal(demoState('pa-vende').trip.seats,0);assert.equal(demoState('pa-vende').disabled,true);
 for(const id of [1,3]){assert.equal(demoState('pa-vende',id).trip.id,2);assert.equal(demoState('pa-vende',id).disabled,true);assert.equal(demoState('rikthimi',id).trip.seats,0);}
 assert.equal(demoState('id-gabuar').trip,null);assert.match(demoState('id-gabuar').message,/nuk u gjet/);
 assert.equal(demoState('offline').trip.seats,1);assert.equal(demoState('offline').disabled,true);assert.match(demoState('offline').source,/vjetër/);
 assert.equal(demoState('rikthimi').trip.seats,0);assert.equal(demoState('rikthimi').trip.time,'08:25');assert.equal(demoState('rikthimi').disabled,true);
 assert.throws(()=>demoState('invented'));assert.equal(runtimeSteps.length,6);assert.equal(offlineSteps.length,3);
});
test('week 7 lecture votes have explanations and lab asks for genuine work rather than a full solution',async()=>{
 const lecture=JSON.parse(await readFile('materials/week-07/lecture-slides.json','utf8'));assert.equal(lecture.length,18);assert.equal(lecture.filter(s=>s.quiz).length,4);
 for(const s of lecture){if(s.quiz){assert.ok(s.quiz.options[s.quiz.correct]);assert.ok(s.quiz.explanation.length>30);assert.ok(s.quiz.question.endsWith('?'));}if(s.answer)assert.ok(s.question.endsWith('?'));}
 const publication=JSON.parse(await readFile('materials/week-07/publication.json','utf8'));
 const guide=await readFile('lendet/2026-2027/mobile/java-07/ushtrimet.html','utf8');
 if(!publication.labsPublished){assert.ok(guide.includes('29.10.2026, ora 14:40'));assert.ok(!guide.includes('case-form'));return;}
 for(const word of ['Parashiko','Skedari:','Para:','Pas:','Prova','rikontrollo','Ndryshimi i ri','pa pikë shtesë','gjatë javës'])assert.ok(guide.includes(word),word);
 for(const id of ['pergatitja','parashikimi','korrigjimi','provat','versionet','dorezimi']){const section=guide.split('id="'+id+'"')[1].split('</section><section class="card"')[0];assert.ok(section.includes('class="screen-checkpoint'),'role illustration after '+id);assert.ok(section.includes('Ekrani i shoferit'));assert.ok(section.includes('Ekrani i udhëtarit'));}
 assert.ok(!guide.includes('data-example-file'));assert.ok(!guide.includes('<pre><code>'));assert.ok(guide.includes('nuk provon autorësinë'));
 const report=await readFile('materials/week-07/java-07-model.md','utf8');
 for(const title of ['Rasti im','Parashikimi','Dy probleme','Korrigjimi','Versionet','Ndryshimi i ri','Ndihma nga AI'])assert.ok(report.includes('## '+title));
 for(let n=1;n<=3;n++)assert.ok(report.includes('### Prova '+n));
});
test('week 7 student downloads match final slides, links and manifest without speaker notes',async()=>{
 const {createHash}=await import('node:crypto');const {execFileSync}=await import('node:child_process');const manifest=JSON.parse(await readFile('materials/manifest.json','utf8'));
 const publication=JSON.parse(await readFile('materials/week-07/publication.json','utf8'));
 const decks=[['lecture7','ligjerates',18],...(publication.labsPublished?[['lab7','ushtrimeve',12]]:[])];
 if(!publication.labsPublished)assert.equal(manifest.lab7,undefined);
 for(const[key,kind,count]of decks){
  const item=manifest[key];assert.equal(item.slides,count);assert.equal(createHash('sha256').update(await readFile(item.file)).digest('hex'),item.sha256);
  const names=execFileSync('unzip',['-Z1',item.file],{encoding:'utf8'}).split('\n');assert.equal(names.filter(n=>/^ppt\/slides\/slide\d+\.xml$/.test(n)).length,count);assert.ok(!names.some(n=>/^ppt\/notes(?:Slides|Masters)\//.test(n)));
  const html=await readFile(`lendet/2026-2027/mobile/java-07/prezantimi-${kind}.html`,'utf8');assert.equal((html.match(/<section class="step/g)||[]).length,count);
  const hub=await readFile('lendet/2026-2027/mobile/java-07/index.html','utf8');assert.ok(hub.includes(item.file.split('/').at(-1)));
 }
});
test('week 7 phone scenes share one deterministic view for the demo and teaching material',async()=>{
 const {renderPhoneSvg,renderPhonePair,PHONE_HITS}=await import('../materials/week-07/phone-ui.mjs');
 const normal=renderPhoneSvg('passenger');assert.equal(normal,renderPhoneSvg('passenger','normal'));assert.ok(normal.includes('Dritoni'));assert.ok(normal.includes('08:15'));assert.ok(normal.includes('Provo kërkesën'));
 assert.ok(renderPhoneSvg('passenger','mismatch').includes('08:40'));
 assert.ok(renderPhoneSvg('passenger','pa-vende').includes('Nuk ka vende të lira'));
 assert.ok(renderPhoneSvg('passenger','id-gabuar').includes('Udhëtimi nuk u gjet'));
 assert.ok(renderPhoneSvg('passenger','offline').includes('Kopja mund të jetë e vjetër'));
 assert.ok(renderPhoneSvg('passenger','pending').includes('Pa rezervim real ose njoftim te shoferi'));
 assert.throws(()=>renderPhoneSvg('unknown'));assert.equal(PHONE_HITS.trips.length,3);
 const pair=renderPhonePair({scene:'normal',caption:'Ekranet',rule:'Krahaso'});assert.ok(pair.includes(renderPhoneSvg('driver')));assert.ok(pair.includes(normal));
 const renderer=await readFile('scripts/build-week07-presentations.mjs','utf8');assert.ok(renderer.includes('renderPhoneSvg(role,d.screens.scene'));
});
