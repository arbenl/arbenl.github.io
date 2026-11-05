import {labSlides,guide8} from '../materials/week-08/lab.mjs';
import {lesson} from '../materials/week-08/lesson.mjs';
import {readFile,writeFile} from 'node:fs/promises';
const dir='lendet/2026-2027/mobile/java-08';
for(const [file,title,steps] of [['prezantimi-ligjerates','Ligjërata 8 · Sensorët dhe vendndodhja',lesson],['prezantimi-ushtrimeve','Ushtrimet 8 · Vendtakimi në RideShare',labSlides]]){
 await writeFile(dir+'/'+file+'.html','<!doctype html><html lang="sq"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+title+'</title><link rel="stylesheet" href="../java-02/week.css"><link rel="stylesheet" href="../java-02/projector.css"><link rel="stylesheet" href="/assets/week-colors.css"><link rel="stylesheet" href="classroom.css"><style>.step p,.step summary{font-size:clamp(19px,2vw,27px);line-height:1.4}summary{cursor:pointer}</style><body data-week="8" data-lab="'+String(file==='prezantimi-ushtrimeve')+'" data-start-projector="true"><main><nav><a href="./">← Java 8</a><button id="mode">Hap në projektor</button></nav><h1>'+title+'</h1>'+steps+'<div id="controls" hidden><button id="prev">← Para</button><span id="counter"></span><button id="next">Tjetri →</button><button id="exit">Mbyll projektorin</button></div></main><script type="module" src="classroom.mjs"></script><script src="../java-02/projector.js"></script></body></html>');
}
let hub=await readFile(dir+'/index.html','utf8');
hub=hub.replace('<p>Prezantimi i ligjëratës do të publikohet para orës.</p>','<p><a class="button" href="prezantimi-ligjerates.html">Hap ligjëratën · 45 minuta</a></p>').replace('href="#hapat">Shiko hapat në këtë faqe','href="prezantimi-ushtrimeve.html">Fillo ushtrimet · 90 minuta');
hub=hub.replace('Fillo ushtrimet · 90 minuta</a>','Fillo ushtrimet · 90 minuta</a><p><a href="#hapat">Shiko hapat në këtë faqe</a> · <a href="ushtrimet.html">Udhëzimi i ushtrimeve</a></p>');
await writeFile(dir+'/index.html',hub);
await writeFile(dir+'/ushtrimet.html',guide8);

for(const asset of ['classroom.css','classroom.mjs']) await writeFile(dir+'/'+asset,await readFile('materials/week-08/'+asset));
