import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,access} from 'node:fs/promises';
test('week 12 stays unavailable at every former public entry point',async()=>{
 const policy=JSON.parse(await readFile('materials/week-12/publication.json','utf8'));
 assert.equal(policy.published,false);assert.equal(policy.publicationRequiresOwnerConfirmation,true);
 for(const path of ['index.html','ushtrimet.html','prezantimi-ligjerates.html','prezantimi-ushtrimeve.html','demo/index.html']){
  const page=await readFile('lendet/2026-2027/mobile/java-12/'+path,'utf8');
  assert.ok(page.includes('data-publication="unpublished"'));assert.ok(page.includes('Materialet ende nuk janë publikuar'));
  assert.doesNotMatch(page,/Prano K-42|scene:|data-case|issues\/new|week12\.js|java-12-model/);
 }
});
test('week 12 lesson sources, report and executable assets are absent from the public tree',async()=>{
 assert.deepEqual(await readdir('materials/week-12'),['publication.json']);
 for(const path of ['java-12-model.md','week12.css','week12.js','demo/demo.js'])await assert.rejects(access('lendet/2026-2027/mobile/java-12/'+path));
 const data=JSON.parse(await readFile('grading/weekly-assignments.json','utf8'));assert.deepEqual(data['12'].steps,[]);assert.deepEqual(data['12'].checks,[]);
});
