import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const {Presentation,PresentationFile}=await import(pathToFileURL(path.join(process.env.RUNTIME_NODE_MODULES,'@oai/artifact-tool/dist/artifact_tool.mjs')));
const skill=process.env.SKILL_DIR;
const {finalizePresentation}=await import(pathToFileURL(path.join(skill,'container_tools/artifact_tool_utils.mjs')));
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const work=process.env.WEEK04_BUILD_DIR; if(!path.isAbsolute(work||''))throw new Error('Set WEEK04_BUILD_DIR to a fresh private build directory.');await fs.mkdir(work+'/output',{recursive:true});
const logo=await fs.readFile(root+'/img/aab_logo_white.png');
for(const kind of ['lecture','lab']) {
 const data=JSON.parse(await fs.readFile(root+'/materials/week-04/'+kind+'-slides.json','utf8'));
 const p=Presentation.create({slideSize:{width:1280,height:720}});
 function text(slide,value,x,y,w,h,size,color='#eaf1ff',bold=false) {
  const shape=slide.shapes.add({geometry:'textbox',position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});
  shape.text=value;shape.text.style={typeface:'Arial',fontSize:size,color,bold,autoFit:'none'};return shape;
 }
 for(const [i,d] of data.entries()) {
  const slide=p.slides.add();slide.background.fill='#0b101b';
  text(slide,d.kicker,64,34,1070,34,18,'#89ddff',true);
  text(slide,String(i+1).padStart(2,'0')+' / '+data.length,1134,34,90,34,18,'#b7c5db');
  if(i===0) {
   slide.images.add({blob:logo,contentType:'image/png',alt:'Kolegji AAB',fit:'contain',position:{left:64,top:115,width:180,height:75}});
   text(slide,d.title,64,225,1150,145,58,'#ffffff',true);
   text(slide,d.body.join('\n\n'),64,400,1120,180,30);
  } else if(d.diagram) {
   text(slide,d.title,64,80,1150,75,42,'#ffffff',true);
   slide.images.add({blob:await fs.readFile(root+d.diagram),contentType:'image/png',alt:d.diagramAlt,fit:'contain',position:{left:40,top:160,width:1200,height:450}});
   text(slide,d.body.join(' '),64,622,1150,36,22);
   text(slide,'Përgjigjja: '+d.answer,64,668,1150,44,17,'#8ee9d1');
  } else {
   text(slide,d.title,64,98,1150,100,44,'#ffffff',true);
   let y=215;
   if(d.table) {
    const table=slide.tables.add({rows:d.table.length,columns:d.table[0].length,left:64,top:y,width:1150,height:235,columnWidths:[125,525,250,250],values:d.table});
    table.cells.block({row:0,column:0,rowCount:d.table.length,columnCount:d.table[0].length}).assign({fill:'#142238',textStyle:{typeface:'Arial',fontSize:27,color:'#eaf1ff'},margins:{left:16,right:16,top:10,bottom:10}});
    table.cells.block({row:0,column:0,rowCount:1,columnCount:d.table[0].length}).assign({textStyle:{typeface:'Arial',fontSize:27,color:'#89ddff',bold:true}});
    y+=260;
   }
   const size=d.table?26:(d.code?26:29);
   const h=d.table?110:(d.code?245:320);
   text(slide,d.body.join('\n\n').replace('Prek rreshtin','Zgjidh rreshtin'),64,y,1150,h,size);
   y+=h+14;
   if(d.code)text(slide,d.code,64,y,1150,140,25,'#8ee9d1');
   if(d.quiz){text(slide,d.quiz.options.map((o,j)=>String.fromCharCode(65+j)+' · '+o).join('\n'),64,425,1150,115,25);text(slide,'Përgjigjja: '+d.quiz.explanation,64,575,1150,95,24,'#8ee9d1');}
   if(d.answer)text(slide,'Përgjigjja: '+d.answer,64,d.code||d.table?600:560,1150,d.code||d.table?60:115,d.code||d.table?22:24,'#8ee9d1');
  }
  if(d.href)text(slide,'Në faqe: '+d.link,64,663,1150,30,18,'#89ddff');
  // Source URLs only, no private professor notes in student downloads.
  if(d.sources)text(slide,d.sources.join('  |  '),64,690,1150,24,12,'#b7c5db');
 }
 const candidate=work+'/'+kind+'-candidate.pptx';await(await PresentationFile.exportPptx(p)).save(candidate);
 execFileSync(process.env.RUNTIME_PYTHON,[path.join(root,'scripts/strip-slide-notes.py'),candidate]);
 const filename=kind==='lecture'?'ligjerata-04-neon-postgresql-rideshare-2026.pptx':'ushtrimet-04-neon-rideshare-2026.pptx';
 const finalPath=work+'/output/'+filename;
 await finalizePresentation({workspaceDir:work,candidatePath:candidate,finalPath,pythonExecutable:process.env.RUNTIME_PYTHON,integrityValidatorPath:skill+'/container_tools/inspect_presentation_package_integrity.py',layoutValidatorPath:skill+'/container_tools/inspect_presentation_layout_geometry.py',layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-heading-fit',...(kind==='lecture'?['--require-native-table-slide','5']:[])],explicitTotalSlideCount:data.length,requiredNativeTableOwnerSlides:kind==='lecture'?[5]:[],fontPolicy:{basis:'design',families:['Arial']},verifyArtifactToolImport:true,receiptPath:work+'/'+kind+'-validation.json'});
 for(let i=0;i<data.length;i++){
  const png=await p.export({slide:p.slides.items[i],format:'png',scale:0.6});await fs.writeFile(work+'/'+kind+'-'+String(i+1).padStart(2,'0')+'.png',new Uint8Array(await png.arrayBuffer()));
 }
 console.log(finalPath);
}
