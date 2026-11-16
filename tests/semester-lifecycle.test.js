import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read=p=>readFile(p,'utf8');
test('the course hub describes published week 6–10 presentations truthfully',async()=>{
 const html=await read('lendet/2026-2027/mobile/index.html');
 for(const week of [6,7,8,9,10]){
  const article=html.split(`id="week-${week}"`)[1].split('</article>')[0];
  assert.ok(!article.includes('prezantimi do të shtohet'),`Week ${week}: published presentation described as missing`);
 }
 assert.ok(!html.includes('Prezantime: javët 1–5'));
});
test('first entry instructions distinguish in-class QR registration from optional GitHub setup',async()=>{
 const html=await read('lendet/2026-2027/mobile/index.html');
 assert.ok(!html.includes('student/activate">Si regjistrohem me QR?'),'QR instructions must not lead into the GitHub-only form');
});
test('publicly served authoring pages resolve links against their published course location',async()=>{
 const {readdir}=await import('node:fs/promises');
 for(const directory of await readdir('materials',{withFileTypes:true})){
  if(!directory.isDirectory()||!/^week-\d{2}$/.test(directory.name))continue;
  for(const file of await readdir('materials/'+directory.name)){
   if(!file.endsWith('.html'))continue;
   const html=await read('materials/'+directory.name+'/'+file);
   if(!/<head[\s>]/i.test(html))continue;
   const week=directory.name.slice(-2);
   assert.ok(html.includes(`<base href="/lendet/2026-2027/mobile/java-${week}/`),`Direct source page ${directory.name}/${file} has broken relative resources`);
  }
 }
});
test('all complete site documents have valid resources, fragments and unique IDs',async()=>{
 const {execFileSync}=await import('node:child_process');
 const report=JSON.parse(execFileSync('python3',['scripts/audit-site-links.py'],{encoding:'utf8'}));
 assert.ok(report.pages>=100);
 assert.deepEqual(report.findings,[]);
});
