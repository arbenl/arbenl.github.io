import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const read=p=>readFile(p,'utf8');
const base='lendet/2026-2027/mobile/';
test('current assessment preserves labs and totals 100 with two separate colloquia',async()=>{
 const plan=JSON.parse(await read('grading/course-plan.json'));
 assert.deepEqual(plan.assessment.components.map(c=>[c.id,c.points]),[['attendance',10],['labs',30],['project',40],['colloquium1',10],['colloquium2',10]]);
 assert.equal(plan.assessment.totalPoints,100);
 assert.equal(plan.assessment.components.reduce((n,c)=>n+c.points,0),100);
 assert.deepEqual(plan.assessment.components.slice(3).map(c=>c.week),[7,14]);
 assert.deepEqual(plan.weeks.filter(w=>w.graded).map(w=>w.week),[2,3,4,5,6,8,9,10,12,14]);
});
test('all current syllabi publish the same grading and the official Word retains its template',async()=>{
 for(const name of ['syllabus.html','syllabusi-2026-2027.html']){
  const html=await read(base+name);
  assert.match(html,/Kolokviumi I/);assert.match(html,/Kolokviumi II/);
  assert.ok(!/20%|20 pikë|10 \/ 30 \/ 40 \/ 20/.test(html));
  assert.ok(html.includes('https://aab-mobile-attendance.vercel.app/colloquium'));
 }
 const {stdout:xml}=await promisify(execFile)('unzip',['-p',base+'Syllabusi-Programimi-per-Pajisje-Mobile-2026-2027.docx','word/document.xml'],{maxBuffer:2*1024*1024});
 assert.match(xml,/Kolokviumi I · Java 7/);assert.match(xml,/Kolokviumi II · Java 14/);
 assert.ok(!xml.includes('Demonstrimi dhe mbrojtja: 20'));
 assert.equal((xml.match(/<w:tbl>/g)||[]).length,4);
 const translations=await read('src/portal.js');
 assert.match(translations,/Colloquium I · Week 7/);assert.match(translations,/Colloquium II · Week 14/);
 assert.ok(!translations.includes('"rubric.r3Title": "Demo Day'));
});
test('student links survive generation while Week 7 private labs stay embargoed',async()=>{
 const url='https://aab-mobile-attendance.vercel.app/colloquium';
 for(const name of ['index.html',base+'index.html',base+'java-07/index.html']) assert.ok((await read(name)).includes(url),name);
 assert.ok((await read('profesor.html')).includes('https://aab-mobile-attendance.vercel.app/staff/colloquium'));
 const publication=JSON.parse(await read('materials/week-07/publication.json'));
 if(!publication.labsPublished){
  for(const prefix of ['materials/week-07/',base+'java-07/']){
   const page=await read(prefix+'ushtrimet.html');
   assert.ok(page.includes('29.10.2026, ora 14:40'));assert.ok(!page.includes('case-form'));
  }
 }
});
