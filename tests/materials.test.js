import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
test('every lecture download points to the validated current presentation',async()=>{
 const html=await readFile('index.html','utf8');
 const {lecture1}=JSON.parse(await readFile('materials/manifest.json','utf8'));
 const links=[...html.matchAll(/href="([^"]+\.pptx)"/g)].map(m=>m[1]);
 assert.equal(links.length,2);
 assert.ok(links.every(p=>p===lecture1.file));
 assert.equal(createHash('sha256').update(await readFile(lecture1.file)).digest('hex'),lecture1.sha256);
 assert.equal(lecture1.slides,29);
 assert.ok(!html.includes('21 Slajde'));
});
test('the semester has fifteen Thursdays and ten graded labs after the first week',async()=>{
 const plan=JSON.parse(await readFile('grading/course-plan.json','utf8'));
 assert.equal(plan.weeks.length,15);
 assert.equal(plan.weeks.filter(w=>w.graded).length*3,30);
 assert.equal(plan.weeks.reduce((n,w)=>n+w.labHours,0),28);
 assert.equal(plan.weeks[0].graded,false);
 for(const w of plan.weeks)assert.equal(new Date(w.date+'T12:00:00Z').getUTCDay(),4);
});
test('the restaurant demo discloses its purpose and exposes the complete order flow',async()=>{
 const html=await readFile('demo/restaurant/index.html','utf8');
 assert.ok(html.includes('Demo — nuk regjistron pjesëmarrjen'));
 for(const state of ['menu','cart','order','ready']){
  assert.ok(html.includes(`data-flow-state="${state}"`),`missing ${state} flow state`);
 }
});
