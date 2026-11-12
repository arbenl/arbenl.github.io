import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('week 9 teaches general theory and practice before the RideShare application',async()=>{
 const {lecture,lab}=JSON.parse(await readFile('materials/week-09/content.json','utf8'));
 const boundary=lecture.findIndex(s=>s.id==='kalimi-rideshare');
 assert.ok(boundary>=8);
 const intro=JSON.stringify(lecture.slice(0,boundary));
 assert.doesNotMatch(intro,/RideShare|Arta|Dritoni|Ferizaj/);
 for(const id of ['gjendja','dy-kujtesa','asinkron','dy-qasje','shembulli','praktika','persistence'])assert.ok(lecture.slice(0,boundary).some(s=>s.id===id));
 for(const id of ['infrastruktura','rasti-1','rasti-2','rasti-3'])assert.ok(lecture.slice(boundary).some(s=>s.id===id));
 assert.equal(lab.length,13);
});
