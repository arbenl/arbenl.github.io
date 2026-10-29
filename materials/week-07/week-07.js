import {renderPhoneSvg,PHONE_HITS} from './phone-ui.mjs';
import {personalCase,demoCaseState} from './week-07-model.mjs';
const $=s=>document.querySelector(s);
const form=$('#case-form');let currentCase=null;
if(form){
 form.addEventListener('submit',event=>{event.preventDefault();const status=$('#case-status');
  try{currentCase=personalCase($('#github-login').value);$('#case-result').hidden=false;status.textContent='Rasti u krijua lokalisht. Nuk është regjistrim dhe nuk dërgon të dhëna.';
   for(const key of ['login','code','from','time','seats','newTime'])$('[data-case="'+key+'"]').textContent=String(currentCase[key]);
  }catch(error){currentCase=null;$('#case-result').hidden=true;status.textContent=error.message;}
 });
 $('#download-case').addEventListener('click',async()=>{
  if(!currentCase)return;
  try{const response=await fetch('java-07-model.md');if(!response.ok)throw Error('Modeli nuk u shkarkua. Përdor lidhjen e modelit më poshtë.');
   let report=await response.text();report=report.replace('GitHub: [PLOTËSO]','GitHub: '+currentCase.login).replace('Kodi: [PLOTËSO]','Kodi: '+currentCase.code).replace('Të dhënat fiktive të rastit: [PLOTËSO]','Të dhënat fiktive të rastit: '+currentCase.from+' → AAB, '+currentCase.time+', '+currentCase.seats+' vende. Ora për provën e re: '+currentCase.newTime+'.');
   const url=URL.createObjectURL(new Blob([report],{type:'text/markdown;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='java-07.md';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(error){$('#case-status').textContent=error.message;}
 });
}
const demoCases=$('#demo-cases');
if(demoCases){
 let activeCase=1,phase=0,selectedId=2,index=0,timer=null,activeRole='passenger',flowView=false;
 const caseButtons=[...demoCases.querySelectorAll('[data-demo-case]')];
 const current=()=>demoCaseState(activeCase,phase,selectedId);
 const stop=()=>{clearInterval(timer);timer=null;$('#play-flow').setAttribute('aria-pressed','false');$('#play-flow').textContent='Luaj animacionin';};
 function renderFlow(){const steps=current().flow;$('#flow-steps').replaceChildren(...steps.map(([place],n)=>{const li=document.createElement('li');li.textContent=place;li.className=n===index-1?'active':'';return li;}));$('#flow-count').textContent=index?`Hapi ${index} / ${steps.length}`:'Gati për demonstrim';$('#flow-text').textContent=index?steps[index-1][1]:'Kjo është rruga që po shpjegojmë, jo një lidhje aktive me server ose databazë.';$('#next-flow').disabled=index>=steps.length;}
 function selectPhase(n){phase=n;selectedId=activeCase===1&&n===0?selectedId:2;render();}
 function drawPhones(info){
  const state=info.state;$('#demo-phone-stage').innerHTML=['driver','passenger'].map(role=>'<div class="role-screen '+role+'"'+(role===activeRole?'':' hidden')+'><div class="rs-phone live-phone" data-phone-role="'+role+'">'+renderPhoneSvg(role,info.scene,{selectedId:activeCase===1?selectedId:2})+'</div></div>').join('');
  for(const button of document.querySelectorAll('[data-demo-role]'))button.setAttribute('aria-pressed',String(button.dataset.demoRole===activeRole));
  $('[data-demo-role="driver"]').textContent='Shoferi · '+(state.trip||state.trips[1]).driver;
  const phone=$('[data-phone-role="passenger"]');
  const place=(button,h)=>{button.className='phone-hit';Object.assign(button.style,{left:(h.x/360*100)+'%',top:(h.y/560*100)+'%',width:(h.w/360*100)+'%',height:(h.h/560*100)+'%'});phone.append(button);};
  for(const [i,t]of state.trips.entries()){
   const b=document.createElement('button');b.type='button';b.textContent=t.driver+' · '+t.from+' → AAB · '+t.time+' · '+t.seats+' vende';b.setAttribute('aria-pressed',String(state.trip?.id===t.id));b.disabled=activeCase!==1;
   b.addEventListener('click',()=>{selectedId=t.id;phase=0;render();});place(b,PHONE_HITS.trips[i]);
  }
  const request=document.createElement('button');request.id='demo-request';request.type='button';request.textContent=state.permission?'Ndryshim i pronarit · simulim':state.discussion?'Vetëm diskutim':state.trip?'Provo kërkesën · simulim':'Kthehu te lista';request.disabled=Boolean(state.trip&&state.disabled);
  request.addEventListener('click',()=>{
   if(!state.trip){selectedId=2;phase=0;render();return;}
   if(state.disabled)return;
   if(activeCase!==3){$('#request-result').textContent='Klikimin dhe përgjigjen e tij i provojmë te Rasti 3 · Klikim apo rezervim.';return;}
   phase=1;render();
  });place(request,PHONE_HITS.request);
 }
 function render(){
  stop();index=0;const info=current(),button=caseButtons.find(b=>Number(b.dataset.demoCase)===activeCase);
  caseButtons.forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
  $('#demo-case-title').textContent=button.textContent;$('#demo-question').textContent=info.question;$('#demo-change').textContent=info.change;$('#demo-observe').textContent=info.observe;$('#demo-source').textContent=info.state.source;
  $('#demo-case-count').textContent=activeCase+' / 6';$('#case-prev').disabled=activeCase===1;$('#case-next').disabled=activeCase===6;
  $('#demo-phase-actions').replaceChildren(...info.phases.map((p,n)=>{const b=document.createElement('button');b.type='button';b.textContent=p.label;b.setAttribute('aria-pressed',String(n===phase));b.addEventListener('click',()=>selectPhase(n));return b;}));
  $('#demo-discussion').hidden=activeCase!==6;$('#demo-compare').hidden=activeCase!==6;
  $('#demo-message').textContent=info.state.message;$('#request-result').textContent=activeCase===3&&phase===1?'Në pritje · SIMULIM. Nuk u ruajt kërkesë dhe nuk u rezervua vend real.':'';
  $('#demo-details').hidden=!info.state.trip;if(info.state.trip){$('#trip-id').textContent=info.state.trip.id;$('#trip-driver').textContent=info.state.trip.driver;$('#trip-time').textContent=info.scene==='mismatch'?'08:40':info.state.trip.time;$('#trip-seats').textContent=info.state.trip.seats;}
  drawPhones(info);renderFlow();
 }
 function selectCase(id,updateHash=true){if(!Number.isInteger(id)||id<1||id>6)id=1;activeCase=id;phase=0;selectedId=2;flowView=false;$('#demo-workspace').hidden=false;$('#demo-flow-panel').hidden=true;$('#demo-view-flow').textContent='Shfaq infrastrukturën';$('#demo-view-flow').setAttribute('aria-expanded','false');if(updateHash)history.replaceState(null,'','#rasti-'+id);render();}
 for(const b of caseButtons)b.addEventListener('click',()=>selectCase(Number(b.dataset.demoCase)));
 for(const b of document.querySelectorAll('[data-demo-role]'))b.addEventListener('click',()=>{activeRole=b.dataset.demoRole;drawPhones(current());});
 $('#case-prev').addEventListener('click',()=>selectCase(activeCase-1));$('#case-next').addEventListener('click',()=>selectCase(activeCase+1));$('#case-reset').addEventListener('click',()=>{selectedId=2;phase=0;render();});
 $('#demo-projector-mode').addEventListener('click',()=>{const enabled=document.body.classList.toggle('demo-projector');$('#demo-projector-mode').setAttribute('aria-pressed',String(enabled));$('#demo-projector-mode').textContent=enabled?'Mbyll projektorin':'Hap në projektor';window.scrollTo(0,0);});
 $('#demo-view-flow').addEventListener('click',()=>{stop();flowView=!flowView;$('#demo-workspace').hidden=flowView;$('#demo-flow-panel').hidden=!flowView;$('#demo-view-flow').setAttribute('aria-expanded',String(flowView));$('#demo-view-flow').textContent=flowView?'Kthehu te telefonat':'Shfaq infrastrukturën';});
 $('#next-flow').addEventListener('click',()=>{stop();index=Math.min(index+1,current().flow.length);renderFlow();});$('#reset-flow').addEventListener('click',()=>{stop();index=0;renderFlow();});
 $('#play-flow').addEventListener('click',()=>{if(timer){stop();return;}if(matchMedia('(prefers-reduced-motion: reduce)').matches){$('#flow-text').textContent='Lëvizja e reduktuar është aktive. Përdor Hapi tjetër.';return;}if(index>=current().flow.length)index=0;$('#play-flow').setAttribute('aria-pressed','true');$('#play-flow').textContent='Ndalo animacionin';timer=setInterval(()=>{index++;renderFlow();if(index>=current().flow.length)stop();},1600);});
 window.addEventListener('hashchange',()=>{const m=location.hash.match(/^#rasti-([1-6])$/);selectCase(m?Number(m[1]):1,false);});
 document.addEventListener('keydown',event=>{if(!document.body.classList.contains('demo-projector')||event.altKey||event.ctrlKey||event.metaKey||event.target.closest('input,select,textarea'))return;if(event.key==='ArrowRight'&&activeCase<6){event.preventDefault();selectCase(activeCase+1);}if(event.key==='ArrowLeft'&&activeCase>1){event.preventDefault();selectCase(activeCase-1);}if(event.key==='Escape')$('#demo-projector-mode').click();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
 const initial=location.hash.match(/^#rasti-([1-6])$/);selectCase(initial?Number(initial[1]):1,false);
}
