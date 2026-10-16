import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {validateSlideQuestions} from './week05-slide-contract.mjs';
const root=process.cwd(),work=process.env.WEEK06_BUILD_DIR,skill=process.env.SKILL_DIR;
if(!path.isAbsolute(work||''))throw Error('Use a fresh private WEEK06_BUILD_DIR.');
const {Presentation,PresentationFile,FileBlob}=await import(pathToFileURL(path.join(process.env.RUNTIME_NODE_MODULES,'@oai/artifact-tool/dist/artifact_tool.mjs')));
const {finalizePresentation}=await import(pathToFileURL(path.join(skill,'container_tools/artifact_tool_utils.mjs')));
await fs.mkdir(work+'/output',{recursive:true});
const ref=await PresentationFile.importPptx(await FileBlob.load(root+'/lendet/2026-2027/mobile/lectures/ligjerata-05-hyrja-lejet-rideshare-2026.pptx'));
for(const i of [0,2]){const png=await ref.export({slide:ref.slides.items[i],format:'png',scale:1});await fs.writeFile(work+'/reference-'+i+'.png',new Uint8Array(await png.arrayBuffer()));}
const logo=await fs.readFile(root+'/img/aab_logo_white.png');
for(const kind of ['lecture','lab']){
 const data=JSON.parse(await fs.readFile(root+'/materials/week-06/'+kind+'-slides.json','utf8'));validateSlideQuestions(data,kind);
 const p=Presentation.create({slideSize:{width:1280,height:720}});
 function text(s,value,x,y,w,h,size=27,color='#edf2ff',bold=false){const o=s.shapes.add({geometry:'textbox',position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});o.text=value;o.text.style={typeface:'Arial',fontSize:size,color,bold,autoFit:'none'};return o;}
 function box(s,label,x,y,w,h,size=23){s.shapes.add({geometry:'rect',position:{left:x,top:y,width:w,height:h},fill:'#172238',line:{fill:'#fda4af',width:1}});text(s,label,x+14,y+12,w-28,h-15,size);}
 function map(s){
  text(s,'PUBLICIMI I KODIT · kur bën Commit → Push',64,205,1150,30,18,'#fda4af',true);
  for(const [i,label]of ['Laptop · Git','GitHub · repository','Vercel · build / deploy'].entries()){box(s,label,64+i*405,245,340,65,24);if(i<2)text(s,'→',420+i*405,255,40,40,30,'#fda4af');}
  text(s,'LEXIMI I LISTËS · gjatë përdorimit',64,335,1150,30,18,'#fda4af',true);
  for(const [i,label]of ['Telefoni\nShfletues / PWA','Service worker\nNë pajisje','Vercel\nServeri Next.js','Neon\nPostgreSQL'].entries()){box(s,label,64+i*300,380,245,95,23);if(i<3)text(s,'↔',319+i*300,400,42,40,30,'#fda4af');}
  text(s,'↕',465,480,45,35,26,'#fda4af');box(s,'Cache · kopja publike\nKoha e ruajtjes',364,520,300,75,21);
  text(s,'Pa internet: lexo kopjen në pajisje.\nAsnjë rezervim nuk konfirmohet.',715,527,490,65,22,'#fda4af',true);
 }
 for(const [i,d]of data.entries()){
  const s=p.slides.add();s.background.fill='#0b101b';text(s,d.kicker,64,27,1060,32,17,'#fda4af',true);text(s,String(i+1).padStart(2,'0')+' / '+data.length,1135,27,100,32,17,'#bfcbdf');
  if(i===0)s.images.add({blob:logo,contentType:'image/png',fit:'contain',alt:'Kolegji AAB',position:{left:1085,top:77,width:130,height:60}});
  text(s,d.title,64,88,i===0?1000:1150,105,42,'#ffffff',true);
  if(d.diagram||d.animation){map(s);text(s,d.body.join('\n'),64,612,1150,75,21);if(d.animation)text(s,'Animacioni live: https://arbenl.github.io/lendet/2026-2027/mobile/java-06/infrastructure.html',64,689,1150,22,14,'#fda4af');continue;}
  text(s,d.body.join('\n\n'),64,220,1150,155,27);
  if(d.flow){const gap=36,w=(1150-gap*(d.flow.length-1))/d.flow.length;for(const [j,label]of d.flow.entries()){box(s,label,64+j*(w+gap),410,w,105,24);if(j<d.flow.length-1)s.shapes.add({geometry:'rightArrow',position:{left:64+j*(w+gap)+w+5,top:452,width:gap-10,height:15},fill:'#fda4af',line:{fill:'none',width:0}});}}
  if(d.comparison){const y=395,h=d.comparison.length===3?64:76;for(const [j,[a,b]]of d.comparison.entries()){text(s,a,64,y+j*h,310,h-5,24,'#fda4af',true);text(s,b,395,y+j*h,820,h-5,24);}}
  if(d.quiz){text(s,d.quiz.question,64,380,1150,60,25,'#fda4af',true);text(s,d.quiz.options.map((o,j)=>String.fromCharCode(65+j)+' · '+o).join('\n\n'),64,445,1150,125,24);text(s,'Përgjigjja: '+d.quiz.explanation,64,590,1150,100,23,'#b8eddb');}
  if(d.question){text(s,d.question,64,560,1150,55,24,'#fda4af',true);text(s,'Përgjigjja: '+d.answer,64,620,1150,70,22,'#b8eddb');}
  if(d.href&&!d.question)text(s,'Në faqen e Javës 6: '+d.link,64,665,1150,28,18,'#fda4af');
  if(d.sources)text(s,d.sources.join(' | '),64,698,1150,18,11,'#bfcbdf');
 }
 const candidate=work+'/'+kind+'-candidate.pptx';await(await PresentationFile.exportPptx(p)).save(candidate);
 execFileSync(process.env.RUNTIME_PYTHON,[root+'/scripts/strip-slide-notes.py',candidate]);
 // Make the animation URL an actual clickable link in the exported, editable deck.
 execFileSync(process.env.RUNTIME_PYTHON,[root+'/scripts/link-week06-animation.py',candidate]);
 const name=(kind==='lecture'?'ligjerata':'ushtrimet')+'-06-pwa-offline-rideshare-2026.pptx';
 const finalPath=work+'/output/'+name;
 await finalizePresentation({workspaceDir:work,candidatePath:candidate,finalPath,pythonExecutable:process.env.RUNTIME_PYTHON,integrityValidatorPath:skill+'/container_tools/inspect_presentation_package_integrity.py',layoutValidatorPath:skill+'/container_tools/inspect_presentation_layout_geometry.py',layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-heading-fit'],explicitTotalSlideCount:data.length,requiredNativeTableOwnerSlides:[],fontPolicy:{basis:'design',families:['Arial']},verifyArtifactToolImport:true,receiptPath:work+'/'+kind+'-validation.json'});
 const final=await PresentationFile.importPptx(await FileBlob.load(finalPath));
 for(let i=0;i<data.length;i++){const png=await final.export({slide:final.slides.items[i],format:'png',scale:1});await fs.writeFile(work+'/'+kind+'-'+String(i+1).padStart(2,'0')+'.png',new Uint8Array(await png.arrayBuffer()));}
 console.log(finalPath);
}
