import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
const runtime=process.env.RUNTIME_NODE_MODULES,skill=process.env.SKILL_DIR;
const {Presentation,PresentationFile,FileBlob}=await import(pathToFileURL(path.join(runtime,'@oai/artifact-tool/dist/artifact_tool.mjs')));
const {finalizePresentation}=await import(pathToFileURL(path.join(skill,'container_tools/artifact_tool_utils.mjs')));
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),work=process.env.WEEK05_BUILD_DIR;
if(!path.isAbsolute(work||''))throw Error('WEEK05_BUILD_DIR must be a fresh private directory.');
await fs.mkdir(work+'/output',{recursive:true});
// Inspect the course reference rather than replacing its design system.
const source=await PresentationFile.importPptx(await FileBlob.load(root+'/lendet/2026-2027/mobile/lectures/ligjerata-04-neon-postgresql-rideshare-2026.pptx'));
for(const i of [0,8]){const png=await source.export({slide:source.slides.items[i],format:'png',scale:1});await fs.writeFile(work+'/reference-'+(i+1)+'.png',new Uint8Array(await png.arrayBuffer()));}
const logo=await fs.readFile(root+'/img/aab_logo_white.png');
for(const kind of (process.env.WEEK05_KIND?[process.env.WEEK05_KIND]:['lecture','lab'])){
 const data=JSON.parse(await fs.readFile(root+'/materials/week-05/'+kind+'-slides.json','utf8'));
 const p=Presentation.create({slideSize:{width:1280,height:720}});
 function text(s,value,x,y,w,h,size=27,color='#eaf1ff',bold=false){const o=s.shapes.add({geometry:'textbox',position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});o.text=value;o.text.style={typeface:'Arial',fontSize:size,color,bold,autoFit:'none'};return o;}
 const tableOwners=[];
 for(const [i,d] of data.entries()){
  const s=p.slides.add();s.background.fill='#0b101b';
  text(s,d.kicker,64,30,1060,35,18,'#fcd34d',true);text(s,String(i+1).padStart(2,'0')+' / '+data.length,1135,30,100,35,18,'#b7c5db');
  if(i===0)s.images.add({blob:logo,contentType:'image/png',fit:'contain',alt:'Kolegji AAB',position:{left:1080,top:82,width:140,height:60}});
  text(s,d.title,64,95,i===0?1000:1150,95,43,'#ffffff',true);
  if(d.openingImage){
   const image=await fs.readFile(path.join(root,d.openingImage));
   s.images.add({blob:image,contentType:'image/png',fit:'contain',alt:d.openingAlt,position:{left:40,top:185,width:1200,height:420}});
   text(s,d.body.join('\n\n'),64,615,1150,85,22);
   continue;
  }
  let bodyY=205,bodyH=300;
  if(d.table){tableOwners.push(i+1);const t=s.tables.add({rows:d.table.length,columns:d.table[0].length,left:64,top:205,width:1150,height:245,columnWidths:[350,230,270,300],values:d.table});t.cells.block({row:0,column:0,rowCount:d.table.length,columnCount:4}).assign({fill:'#1e2632',textStyle:{typeface:'Arial',fontSize:24,color:'#eaf1ff'},margins:{left:14,right:14,top:10,bottom:10}});t.cells.block({row:0,column:0,rowCount:1,columnCount:4}).assign({textStyle:{typeface:'Arial',fontSize:24,color:'#fcd34d',bold:true}});bodyY=470;bodyH=80;}
  text(s,d.body.join('\n\n'),64,bodyY,1150,bodyH,d.table?24:27);
  if(d.flow){const gap=25,w=(1150-gap*(d.flow.length-1))/d.flow.length;for(const [j,label]of d.flow.entries()){text(s,label,64+j*(w+gap),455,w,85,26,'#fcd34d',true);if(j<d.flow.length-1)text(s,'→',64+j*(w+gap)+w,470,gap,45,25,'#fcd34d');}}
  if(d.comparison){const top=d.body.length>=3?450:365;const h=d.comparison.length===3?56:70;for(const [j,[label,value]]of d.comparison.entries()){text(s,label,64,top+j*h,450,h,25,'#fcd34d',true);text(s,value,545,top+j*h,670,h,25);}}
  if(d.code)text(s,d.code,64,400,1150,150,27,'#fcd34d');
  if(d.quiz){text(s,d.quiz.question,64,370,1150,45,25,'#fcd34d',true);text(s,d.quiz.options.map((o,j)=>String.fromCharCode(65+j)+' · '+o).join('\n\n'),64,425,1150,155,25);text(s,'Përgjigjja: '+d.quiz.explanation,64,600,1150,70,22,'#b8eddb');}
  if(d.checklist)text(s,d.checklist.map(x=>'□ '+x).join('\n\n'),64,420,1150,150,26,'#fcd34d');
  if(d.question)text(s,d.question,64,555,1150,40,23,'#fcd34d',true);
  if(d.answer)text(s,'Përgjigjja: '+d.answer,64,d.question?600:585,1150,d.question?65:70,d.question?21:22,'#b8eddb');
  if(d.href)text(s,'Në faqe: '+d.link,64,665,1150,30,18,'#fcd34d');
  if(d.sources)text(s,d.sources.join(' | '),64,697,1150,20,11,'#b7c5db');
 }
 const candidate=work+'/'+kind+'-candidate.pptx';await(await PresentationFile.exportPptx(p)).save(candidate);
 execFileSync(process.env.RUNTIME_PYTHON,[path.join(root,'scripts/strip-slide-notes.py'),candidate]);
 const name=kind==='lecture'?'ligjerata-05-hyrja-lejet-rideshare-2026.pptx':'ushtrimet-05-hyrja-lejet-rideshare-2026.pptx';
 const finalPath=work+'/output/'+name;
 await finalizePresentation({workspaceDir:work,candidatePath:candidate,finalPath,pythonExecutable:process.env.RUNTIME_PYTHON,integrityValidatorPath:skill+'/container_tools/inspect_presentation_package_integrity.py',layoutValidatorPath:skill+'/container_tools/inspect_presentation_layout_geometry.py',layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-heading-fit',...tableOwners.flatMap(n=>['--require-native-table-slide',String(n)])],explicitTotalSlideCount:data.length,requiredNativeTableOwnerSlides:tableOwners,fontPolicy:{basis:'design',families:['Arial']},verifyArtifactToolImport:true,receiptPath:work+'/'+kind+'-validation.json'});
 const final=await PresentationFile.importPptx(await FileBlob.load(finalPath));
 for(let i=0;i<data.length;i++){const png=await final.export({slide:final.slides.items[i],format:'png',scale:1});await fs.writeFile(work+'/'+kind+'-'+String(i+1).padStart(2,'0')+'.png',new Uint8Array(await png.arrayBuffer()));}
 console.log(finalPath);
}
