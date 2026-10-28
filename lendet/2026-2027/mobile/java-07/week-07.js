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
 function render(){stop();index=0;const state=demoState(demo.value,selectedId);$('#demo-source').textContent=state.source;$('#demo-message').textContent=state.message;$('#demo-request').disabled=state.disabled;$('#demo-request').hidden=!state.trip;
  $('#demo-details').hidden=!state.trip;$('#request-result').textContent='';if(state.trip){$('#trip-id').textContent=state.trip.id;$('#trip-driver').textContent=state.trip.driver;$('#trip-time').textContent=state.trip.time;$('#trip-seats').textContent=state.trip.seats;}
  $('#trip-list').replaceChildren(...state.trips.map(t=>{const li=document.createElement('li'),b=document.createElement('button');b.type='button';b.textContent=t.driver+' · '+t.from+' → AAB · '+t.time+' · '+t.seats+' vende';b.setAttribute('aria-pressed',String(state.trip?.id===t.id));b.addEventListener('click',()=>{selectedId=t.id;demo.value='normal';render();});li.append(b);return li;}));renderFlow();
 }
 demo.addEventListener('change',render);$('#next-flow').addEventListener('click',()=>{stop();index=Math.min(index+1,flow().length);renderFlow();});$('#reset-flow').addEventListener('click',()=>{stop();index=0;renderFlow();});
 $('#play-flow').addEventListener('click',()=>{if(timer){stop();return;}if(matchMedia('(prefers-reduced-motion: reduce)').matches){$('#flow-text').textContent='Lëvizja e reduktuar është aktive. Përdor Hapi tjetër.';return;}if(index>=flow().length)index=0;$('#play-flow').setAttribute('aria-pressed','true');$('#play-flow').textContent='Ndalo animacionin';timer=setInterval(()=>{index++;renderFlow();if(index>=flow().length)stop();},1600);});
 $('#demo-request').addEventListener('click',()=>{if(demoState(demo.value,selectedId).disabled)return;$('#request-result').textContent='Në pritje · SIMULIM. Nuk u ruajt kërkesë dhe nuk u rezervua vend real.';});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});render();
}
