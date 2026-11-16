import {readFile,writeFile,mkdir,rm} from 'node:fs/promises';
const publication=JSON.parse(await readFile('materials/week-12/publication.json','utf8'));
if(publication.published!==false)throw new Error('Week 12 requires the owner-authorized private release package; this builder never publishes it automatically.');
const dir='lendet/2026-2027/mobile/java-12';
// Remove previous generated assets as well as pages: hiding links is not privacy.
await rm(dir,{recursive:true,force:true});
await mkdir(dir+'/demo',{recursive:true});
const page='<!doctype html><html lang="sq"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Java 12 · Mobile 2026/2027</title><link rel="stylesheet" href="/assets/catalog.css"><link rel="stylesheet" href="/assets/week-colors.css"></head><body data-week="12"><main id="main"><nav class="crumb"><a href="/lendet/2026-2027/mobile/">← Materialet e lëndës</a></nav><p class="eyebrow">Programimi për Pajisje Mobile · 2026/2027</p><h1>Java 12</h1><section class="notice" data-publication="unpublished"><h2>Materialet ende nuk janë publikuar</h2><p>Ligjërata, ushtrimet dhe demonstrimi do të hapen kur të vijë radha e kësaj jave.</p></section><div class="grid"><section class="card"><h2>1. Ligjërata</h2><p>Së shpejti.</p></section><section class="card"><h2>2. Ushtrimet</h2><p>Së shpejti.</p></section><section class="card"><h2>3. Dorëzimi</h2><p>Udhëzimet do të shfaqen bashkë me ushtrimet.</p></section></div><p><a href="/lendet/2026-2027/mobile/">Kthehu te lënda →</a></p></main></body></html>';
for(const name of ['index.html','ushtrimet.html','prezantimi-ligjerates.html','prezantimi-ushtrimeve.html','demo/index.html'])await writeFile(dir+'/'+name,page);
console.log('Week 12 remains private: public pages contain only an unavailable notice.');
