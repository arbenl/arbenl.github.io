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
 assert.ok((await read('lendet/2026-2027/mobile/java-02/prezantimi-ushtrimeve.html')).includes('Ushtrimet 2: RideShare në praktikë'));
 const mcc=await read('lendet/2026-2027/mccc/index.html');assert.ok(mcc.includes('ende nuk janë publikuar'));assert.ok(!mcc.includes('.pptx'));
});
test('professor navigation exposes exactly 15 shared lectures and 14 labs per group',async()=>{
 const html=await read('profesor.html');
 assert.equal((html.match(/kind=lecture/g)||[]).length,15);
 for(const group of ['G1','G2'])assert.equal((html.match(new RegExp(`kind=lab&amp;group=${group}`,'g'))||[]).length,14);
 assert.ok(! (await read('lendet/2026-2027/mobile/index.html')).includes('/staff/qr'));
});
