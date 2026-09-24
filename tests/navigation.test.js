import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir, stat} from 'node:fs/promises';
import path from 'node:path';
const read=p=>readFile(p,'utf8');
async function walk(dir){const all=[];for(const entry of await readdir(dir,{withFileTypes:true})){const name=path.join(dir,entry.name);if(entry.isDirectory())all.push(...await walk(name));else all.push(name);}return all;}
test('every new page has valid local links, assets and fragment targets',async()=>{
 const files=['index.html','profesor.html','profili.html',...await walk('lendet'),...await walk('vitet')].filter(p=>p.endsWith('.html'));
 for(const file of files){const html=await read(file);for(const match of html.matchAll(/(?:href|src)="([^"]+)"/g)){
  const url=new URL(match[1].replaceAll('&amp;','&'),'https://arbenl.github.io/'+file);
  if(url.origin!=='https://arbenl.github.io'||url.pathname.startsWith('/arbenl-mobile-assignments-2025/'))continue;
  let target=decodeURIComponent(url.pathname).slice(1)||'index.html';
  let info;try{info=await stat(target);}catch{assert.fail(`${file}: missing ${target}`);}
  if(info.isDirectory())target=path.join(target,'index.html');
  if(url.hash&&target.endsWith('.html')){const body=await read(target);assert.ok(body.includes(`id="${url.hash.slice(1)}"`),`${file}: missing anchor ${url.href}`);}
 }
 }
});
test('week 2 old links redirect to Mobile and current materials stay out of MCC',async()=>{
 const old=await read('materials/java-02/prezantimi-ushtrimeve.html');
 assert.ok(old.includes('/lendet/2026-2027/mobile/java-02/prezantimi-ushtrimeve.html'));
 assert.ok((await read('lendet/2026-2027/mobile/java-02/prezantimi-ushtrimeve.html')).includes('Ushtrimet 2 · RideShare'));
 const mcc=await read('lendet/2026-2027/mccc/index.html');assert.ok(mcc.includes('ende nuk janë publikuar'));assert.ok(!mcc.includes('.pptx'));
});
test('professor navigation points only to the authenticated staff panel',async()=>{
 const html=await read('profesor.html');
 assert.ok(html.includes('https://aab-mobile-attendance.vercel.app/staff'));
 assert.ok(!html.includes('/staff/qr?'));
 const home=await read('index.html');
 assert.ok(home.includes('href="https://aab-mobile-attendance.vercel.app/staff">Jam profesor · Hap orën'));
 assert.ok(! (await read('lendet/2026-2027/mobile/index.html')).includes('/staff/qr'));
});

test('each of fifteen weeks has a home and a consistent submission path',async()=>{
 const hub=await read('lendet/2026-2027/mobile/index.html');
 for(let week=1;week<=15;week++){
  const n=String(week).padStart(2,'0');
  assert.ok(hub.includes(`/java-${n}/`));
  const page=await read(`lendet/2026-2027/mobile/java-${n}/index.html`);
  assert.ok(page.includes('dorezimet.html'));
  if(week>=2){
   for(const heading of ['1. Ligjërata','2. Ushtrimet','3. Dorëzimi'])assert.ok(page.includes(heading),`week ${week}: missing ${heading}`);
   assert.ok(page.includes('href="#hapat"'),`week ${week}: missing in-page exercise link`);
   assert.ok(page.includes('id="hapat"'),`week ${week}: missing exercise steps`);
   assert.ok(page.includes('4. Dorëzo para se të largohesh'),`week ${week}: missing final step`);
   assert.ok(page.includes('issues/new?template=mobile-submission.yml'),`week ${week}: missing direct submission`);
  }
  if(week>=3){
   assert.ok(page.includes(`java-${n}.md`));
   assert.ok((await read(`lendet/2026-2027/mobile/java-${n}/java-${n}-model.md`)).includes('Provat që bëra'));
   const exercises=await read(`lendet/2026-2027/mobile/java-${n}/ushtrimet.html`);
   assert.ok(exercises.includes('4. Dorëzo para se të largohesh'),`week ${week}: old exercise link stopped working`);
  }
 }
});

test('course abbreviations are explained in student pages and projector slides',async()=>{
 const checks={
  'java-01/index.html':['PWA (Progressive Web App','PRD-në (Product Requirements Document','MVP-së (Minimum Viable Product'],
  'java-02/prezantimi-ligjerates.html':['MVP-së (Minimum Viable Product','PRD (Product Requirements Document'],
  'java-02/prezantimi-ushtrimeve.html':['QR (Quick Response','AI (Artificial Intelligence'],
  'java-04/index.html':['RLS (Row Level Security'],
  'java-14/index.html':['CI/CD (Continuous Integration / Continuous Delivery']
 };
 for(const [file,terms] of Object.entries(checks)){
  const html=await read(`lendet/2026-2027/mobile/${file}`);
  for(const term of terms)assert.ok(html.includes(term),`${file}: missing ${term}`);
 }
});
