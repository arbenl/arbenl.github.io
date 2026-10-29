import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {renderPhoneSvg} from '../materials/week-07/phone-ui.mjs';
import {validateSlideQuestions} from './week05-slide-contract.mjs';
const root=process.cwd(),work=process.env.WEEK07_BUILD_DIR,skill=process.env.SKILL_DIR;
if(!path.isAbsolute(work||''))throw Error('Use a fresh private WEEK07_BUILD_DIR.');
const {default:sharp}=await import(pathToFileURL(path.join(process.env.RUNTIME_NODE_MODULES,'sharp/dist/index.mjs')));
const {Presentation,PresentationFile,FileBlob}=await import(pathToFileURL(path.join(process.env.RUNTIME_NODE_MODULES,'@oai/artifact-tool/dist/artifact_tool.mjs')));
const {finalizePresentation}=await import(pathToFileURL(path.join(skill,'container_tools/artifact_tool_utils.mjs')));
await fs.mkdir(work+'/output',{recursive:true});
const ref=await PresentationFile.importPptx(await FileBlob.load(root+'/lendet/2026-2027/mobile/lectures/ligjerata-06-pwa-offline-rideshare-2026.pptx'));
for(const i of [0,2,9]){const png=await ref.export({slide:ref.slides.items[i],format:'png',scale:1});await fs.writeFile(work+'/reference-'+i+'.png',new Uint8Array(await png.arrayBuffer()));}
const logo=await fs.readFile(root+'/img/aab_logo_white.png');
for(const kind of (process.env.WEEK07_BUILD_KIND || 'lecture,lab').split(',')){
 const data=JSON.parse(await fs.readFile(root+'/materials/week-07/'+kind+'-slides.json','utf8'));validateSlideQuestions(data,kind);
 const p=Presentation.create({slideSize:{width:1280,height:720}});
 function text(s,value,x,y,w,h,size=26,color='#edf2ff',bold=false){const o=s.shapes.add({geometry:'textbox',position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});o.text=value;o.text.style={typeface:'Arial',fontSize:size,color,bold,autoFit:'none'};return o;}
 for(const [i,d]of data.entries()){
  const s=p.slides.add();s.background.fill='#0b101b';text(s,d.kicker,64,27,1060,32,17,'#fdba74',true);text(s,`${i+1} / ${data.length}`,1135,27,100,32,17,'#bfcbdf');
  if(i===0)s.images.add({blob:logo,contentType:'image/png',fit:'contain',alt:'Kolegji AAB',position:{left:1090,top:80,width:125,height:55}});
  text(s,d.title,64,88,i===0?1000:1150,105,42,'#ffffff',true);
  if(d.screens){
   text(s,d.body.join('\n\n'),64,205,560,d.quiz?145:210,24);
   for(const[j,role]of ['driver','passenger'].entries()){
    const svg=renderPhoneSvg(role,d.screens.scene||'normal');
    const png=await sharp(Buffer.from(svg)).resize(720,1120).png().toBuffer();
    await fs.mkdir(work+'/phone-images',{recursive:true});await fs.writeFile(work+'/phone-images/'+kind+'-'+(i+1)+'-'+role+'.png',png);
    s.images.add({blob:png,contentType:'image/png',alt:role==='driver'?'Ekrani i shoferit':'Ekrani i udhëtarit',position:{left:665+j*280,top:205,width:230,height:358}});
   }
   if(d.quiz){text(s,d.quiz.question,64,375,560,64,25,'#fdba74',true);text(s,d.quiz.options.map((o,j)=>String.fromCharCode(65+j)+' · '+o).join('\n'),64,451,560,145,23);text(s,'Votoni dhe diskutoni arsyen përpara përgjigjes.',64,650,1150,32,22,'#fdba74');}
   else if(d.question){text(s,d.question,64,570,1150,40,24,'#fdba74',true);text(s,d.answer,64,620,1150,76,22,'#b8eddb');}
   else {text(s,d.screens.driver?.status||'I njëjti RideShare si në demonstrim.',64,462,540,60,23,'#fdba74',true);text(s,d.screens.passenger?.status||'',64,530,540,60,23,'#b8eddb');text(s,d.screens.rule,64,625,1150,58,20,'#c8d3e6');}
  }else if(d.simulation){
   text(s,'PUBLIKIMI I KODIT',64,205,1150,30,18,'#fdba74',true);
   text(s,'Git në kompjuter   →   GitHub   →   Vercel',64,246,1150,60,32);
   text(s,'TË DHËNAT GJATË PËRDORIMIT',64,340,1150,30,18,'#fdba74',true);
   text(s,'Telefoni   ↔   Vercel / Next.js   ↔   Neon PostgreSQL',64,383,1150,65,30);
   text(s,'Kopja offline qëndron në telefon. GitHub nuk është ndalesë e çdo klikimi.',64,477,1150,70,27,'#fdba74');
   text(s,d.body.join('\n\n'),64,573,1150,105,24);
  }else{
   const cues=d.visual||[],gap=38,w=(1150-gap*(cues.length-1))/cues.length;
   for(const[j,c]of cues.entries()){const x=64+j*(w+gap);s.images.add({blob:await fs.readFile(root+'/assets/week06-icons/'+c.icon+'.png'),contentType:'image/png',alt:c.label,position:{left:x,top:205,width:d.quiz?48:60,height:d.quiz?48:60}});text(s,c.label,x,280,w,52,27,'#fff',true);text(s,c.note,x,338,w,60,22,'#c8d3e6');}
   if(d.quiz){text(s,d.body.join('\n'),64,412,1150,85,24);text(s,d.quiz.question,64,510,1150,52,25,'#fdba74',true);text(s,d.quiz.options.map((o,j)=>String.fromCharCode(65+j)+' · '+o).join('\n'),64,573,1150,102,24);text(s,'Votoni, shpjegoni arsyen dhe pastaj kaloni te slajdi vijues',64,688,1150,23,17,'#c8d3e6');}
   else{text(s,d.body.join('\n\n'),64,d.question?405:425,1150,d.question?155:135,d.question?25:26);if(d.question){text(s,d.question,64,570,1150,55,24,'#fdba74',true);text(s,d.answer,64,631,1150,66,22,'#b8eddb');}else if(d.demo||d.href){text(s,d.demo?'Demonstrimi interaktiv:':'Vazhdo në faqen e ushtrimeve:',64,600,1150,32,23,'#fdba74',true);text(s,d.demo?'https://arbenl.github.io/lendet/2026-2027/mobile/java-07/demonstrimi.html':'https://arbenl.github.io/lendet/2026-2027/mobile/java-07/ushtrimet.html',64,641,1150,35,20,'#fdba74');}}
  }
  if(d.sources)text(s,d.sources.join('  '),64,702,1150,16,10,'#bfcbdf');
 }
 const candidate=work+'/'+kind+'-candidate.pptx';await(await PresentationFile.exportPptx(p)).save(candidate);
 execFileSync(process.env.RUNTIME_PYTHON,[root+'/scripts/strip-slide-notes.py',candidate]);
 execFileSync(process.env.RUNTIME_PYTHON,[root+'/scripts/link-presentation-urls.py',candidate]);
 const finalPath=work+'/output/'+(kind==='lecture'?'ligjerata':'ushtrimet')+'-07-kontrolli-mvp-rideshare-2026.pptx';
 await finalizePresentation({workspaceDir:work,candidatePath:candidate,finalPath,pythonExecutable:process.env.RUNTIME_PYTHON,integrityValidatorPath:skill+'/container_tools/inspect_presentation_package_integrity.py',layoutValidatorPath:skill+'/container_tools/inspect_presentation_layout_geometry.py',layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-heading-fit'],explicitTotalSlideCount:data.length,requiredNativeTableOwnerSlides:[],fontPolicy:{basis:'design',families:['Arial']},verifyArtifactToolImport:true,receiptPath:work+'/'+kind+'-validation.json'});
 const final=await PresentationFile.importPptx(await FileBlob.load(finalPath));
 for(let i=0;i<data.length;i++){const png=await final.export({slide:final.slides.items[i],format:'png',scale:1});await fs.writeFile(work+'/'+kind+'-'+String(i+1).padStart(2,'0')+'.png',new Uint8Array(await png.arrayBuffer()));}
 console.log(finalPath);
}
