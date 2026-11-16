import cases from './cases.json';
import {initialState,transition} from './validation-model.mjs';
import {renderPair,escapeHTML} from './phone-ui.mjs';
let state=initialState(1);
const narrations=['Shoferi pranon K-42. Pastaj Arta e rilexon: vendet kalojnë nga 2 në 1. Provo edhe përsëritjen.','Ky panel simulon një thirrje jashtë ndërfaqes normale. Serveri e refuzon; statusi dhe vendet mbeten të njëjta.','Dritoni provon dy pranime për 1 vend. Modeli zbaton rendin e përfundimit: vetëm njëra kërkesë pranohet.'];
function draw(){
 document.querySelector('[data-case-title]').textContent=`Rasti ${state.number} · ${cases[state.number-1]}`;
 document.querySelector('[data-phones]').innerHTML=renderPair(state,{interactive:true});
 document.querySelectorAll('[data-case]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.case)===state.number)));
 document.querySelector('[data-narration]').textContent=narrations[state.number-1];
 document.querySelector('[data-server]').textContent=`${state.server.seats} vende · K-42: ${state.server.requests['K-42'].status==='accepted'?'e pranuar':'në pritje'} · K-43: ${state.server.requests['K-43'].status==='accepted'?'e pranuar':'në pritje'}`;
 document.querySelector('[data-response]').textContent=state.response?`${state.response.status} · ${state.response.message}`:'Ende pa veprim.';
 document.querySelector('[data-log]').innerHTML=state.log.slice(-4).map(r=>`<li>${escapeHTML(r.requestId)} → ${r.status}${r.repeated?' · përsëritje':''}</li>`).join('');
 document.querySelector('[data-probes]').hidden=state.number!==2;
 document.querySelector('[data-race]').hidden=state.number!==3;
 document.querySelector('[data-repeat]').hidden=state.number!==1;
 document.querySelector('[data-repeat]').disabled=state.server.requests['K-42'].status!=='accepted';
 document.querySelector('[data-probe]').value=state.actor===null?'anonymous':state.actor==='other-driver'?'other':state.actor==='dritoni'?'invalid':'passenger';
}
function reset(number){state=initialState(number);history.replaceState(null,'',`#rast-${number}`);draw();window.scrollTo(0,0);}
document.addEventListener('click',e=>{
 const button=e.target.closest('button');if(!button)return;
 if(button.hasAttribute('data-case'))return reset(Number(button.dataset.case));
 const action=button.dataset.action;
 if(action==='accept')state=transition(state,{type:'submit'});
 if(action?.startsWith('read-'))state=transition(state,{type:'sync',role:action.slice(5)});
 if(button.hasAttribute('data-reset'))return reset(state.number);
 if(button.hasAttribute('data-sync'))state=transition(state,{type:'sync'});
 if(button.hasAttribute('data-repeat'))state=transition(state,{type:'submit'});
 if(button.hasAttribute('data-test'))state=transition(state,{type:'submit'});
 if(button.hasAttribute('data-race-order')){state=initialState(3);state=transition(state,{type:'race',order:button.dataset.raceOrder==='lira'?['K-43','K-42']:['K-42','K-43']});}
 if(button.hasAttribute('data-demo-mode')){document.body.classList.toggle('demo-projector');button.textContent=document.body.classList.contains('demo-projector')?'Mbyll projektorin':'Hap në projektor';window.scrollTo(0,0);return;}
 draw();
});
document.querySelector('[data-probe]').addEventListener('change',e=>{state=transition(initialState(2),{type:'probe',value:e.target.value});draw();});
window.addEventListener('hashchange',()=>{const number=Number(location.hash.match(/rast-([123])/)?.[1]??1);if(number!==state.number){state=initialState(number);draw();}});
state=initialState(Number(location.hash.match(/rast-([123])/)?.[1]??1));draw();
