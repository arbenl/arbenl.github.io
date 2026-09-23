'use strict';
const checks = [
 ['git','Git lokal','Hap terminalin dhe ekzekuto git --version. Duhet të shfaqë një version.'],
 ['node','Node.js','Ekzekuto node --version. Ambienti i kursit përdor Node.js 24 LTS.'],
 ['npm','npm','Ekzekuto npm --version. Duhet të shfaqë një version. npm vjen me Node.js.'],
 ['editor','VS Code','Hap një dosje, ndrysho një skedar dhe ruaje.'],
 ['github','GitHub','Hyr dhe ruaj një ndryshim në README të repository-t tënd.'],
 ['vercel','Vercel dhe lidhja me GitHub','Hyr në Vercel dhe kontrollo që repository yt shfaqet për import.'],
 ['deploy','Publikimi në Vercel','Hap URL-në e faqes sate dhe shiko ndryshimin që ke publikuar.'],
 ['phone','Prova në telefon','Hap URL-në e publikuar nga telefoni dhe kontrollo që lexohet.']
];
const states=['Ende pa provuar','Punon','Ka problem','Mungon'];
const byId=id=>document.getElementById(id);
for(const [id,title,instruction] of checks){
 const section=document.createElement('section');
 const label=document.createElement('label');label.htmlFor=id;label.textContent=title;
 const p=document.createElement('p');p.textContent=instruction;
 const select=document.createElement('select');select.id=id;
 for(const state of states){const o=document.createElement('option');o.value=state;o.textContent=state;select.append(o);}
 section.append(label,p,select);byId('checks').append(section);
 select.addEventListener('change',()=>{byId('summary').textContent=`${checks.filter(([id])=>byId(id).value==='Punon').length}/8 prova të konfirmuara`;byId('result').hidden=true;});
}
byId('tools').addEventListener('input',()=>{
 byId('result').hidden=true;
 byId('demo-url').required=byId('deploy').value==='Punon';
 byId('versions').required=['git','node','npm'].some(id=>byId(id).value==='Punon');
});
let report='';
byId('tools').addEventListener('submit',event=>{
 event.preventDefault();const count=checks.filter(([id])=>byId(id).value==='Punon').length;
 report=['# Kontrolli i mjeteve — Java 02',`GitHub: ${byId('username').value.trim()||'Nuk kam hyrë ende'}`,`Kompjuteri: ${byId('os').value}`,`Rezultati: ${count}/8 prova të kryera me sukses. Vetëdeklarim, në pritje të verifikimit në klasë.`,'',...checks.map(([id,title])=>`${title}: ${byId(id).value}`),'','Versionet:',byId('versions').value,'','Faqja e publikuar:',byId('demo-url').value||'Ende pa link','','Ndihma e nevojshme:',byId('blocker').value||'Nuk shënova problem.'].join('\n');
 byId('report').value=report;
 const url=new URL('https://github.com/arbenl/arbenl-mobile-assignments-2025/issues/new');
 url.searchParams.set('title',`[MJETET] ${count}/8 — ${byId('username').value.trim()||'Java 02'}`);url.searchParams.set('body',report);
 byId('send').href=url.toString();byId('result').hidden=false;byId('result').scrollIntoView({behavior:'smooth'});
});
byId('download').addEventListener('click',()=>{const u=URL.createObjectURL(new Blob([report],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=u;a.download='kontrolli-mjeteve.txt';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);});
