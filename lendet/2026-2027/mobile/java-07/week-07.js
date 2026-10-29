import {renderPhoneSvg,PHONE_HITS} from './phone-ui.mjs';
import {personalCase,demoState,runtimeSteps,offlineSteps} from './week-07-model.mjs';
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
const demo=$('#demo-scenario');
if(demo){let selectedId=2,index=0,timer=null;
 const stop=()=>{clearInterval(timer);timer=null;$('#play-flow').setAttribute('aria-pressed','false');$('#play-flow').textContent='Luaj animacionin';};
 const flow=()=>demo.value==='offline'?offlineSteps:runtimeSteps;
 function renderFlow(){const steps=flow();$('#flow-steps').replaceChildren(...steps.map(([place,text],n)=>{const li=document.createElement('li');li.textContent=place;li.className=n===index-1?'active':'';return li;}));$('#flow-count').textContent=index?`Hapi ${index} / ${steps.length}`:'Gati për demonstrim';$('#flow-text').textContent=index?steps[index-1][1]:'Parashiko rrugën përpara se të shtypësh Hapi tjetër.';$('#next-flow').disabled=index>=steps.length;}
 function drawPhones(state,pending=false){
  const scene=pending?'pending':demo.value;
  $('#demo-phone-stage').innerHTML=['driver','passenger'].map(role=>'<div class="role-screen '+role+'"><div class="rs-phone live-phone" data-phone-role="'+role+'">'+renderPhoneSvg(role,scene,{selectedId})+'</div></div>').join('');
  const phone=$('[data-phone-role="passenger"]');
  const place=(button,h)=>{button.className='phone-hit';Object.assign(button.style,{left:(h.x/360*100)+'%',top:(h.y/560*100)+'%',width:(h.w/360*100)+'%',height:(h.h/560*100)+'%'});phone.append(button);};
  for(const [i,t]of state.trips.entries()){
   const b=document.createElement('button');b.type='button';b.textContent=t.driver+' · '+t.from+' → AAB · '+t.time+' · '+t.seats+' vende';b.setAttribute('aria-pressed',String(state.trip?.id===t.id));
   b.addEventListener('click',()=>{selectedId=t.id;demo.value='normal';render();});place(b,PHONE_HITS.trips[i]);
  }
  const request=document.createElement('button');request.id='demo-request';request.type='button';request.textContent=state.trip?'Provo kërkesën · simulim':'Kthehu te lista';request.disabled=Boolean(state.trip&&state.disabled);
  request.addEventListener('click',()=>{if(!state.trip){selectedId=2;demo.value='normal';render();return;}if(state.disabled)return;drawPhones(state,true);$('#request-result').textContent='Në pritje · SIMULIM. Nuk u ruajt kërkesë dhe nuk u rezervua vend real.';});place(request,PHONE_HITS.request);
 }
 function render(){stop();index=0;const state=demoState(demo.value,selectedId);$('#demo-source').textContent=state.source;$('#demo-message').textContent=state.message;
  $('#demo-details').hidden=!state.trip;$('#request-result').textContent='';if(state.trip){$('#trip-id').textContent=state.trip.id;$('#trip-driver').textContent=state.trip.driver;$('#trip-time').textContent=state.trip.time;$('#trip-seats').textContent=state.trip.seats;}
  drawPhones(state);renderFlow();
 }
 demo.addEventListener('change',render);$('#next-flow').addEventListener('click',()=>{stop();index=Math.min(index+1,flow().length);renderFlow();});$('#reset-flow').addEventListener('click',()=>{stop();index=0;renderFlow();});
 $('#play-flow').addEventListener('click',()=>{if(timer){stop();return;}if(matchMedia('(prefers-reduced-motion: reduce)').matches){$('#flow-text').textContent='Lëvizja e reduktuar është aktive. Përdor Hapi tjetër.';return;}if(index>=flow().length)index=0;$('#play-flow').setAttribute('aria-pressed','true');$('#play-flow').textContent='Ndalo animacionin';timer=setInterval(()=>{index++;renderFlow();if(index>=flow().length)stop();},1600);});

 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});render();
}
