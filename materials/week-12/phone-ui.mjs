import {initialState,transition} from './validation-model.mjs';
export const escapeHTML=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function expectedState(number){let state=initialState(number);state=transition(state,{type:number===3?'race':'submit'});return transition(state,{type:'sync'});}
export function renderPair(state,{interactive=false}={}){
 const driver=state.number!==3;
 const phone=(role)=>{
  const isDriver=role==='dritoni',name=isDriver?'Dritoni':role==='arta'?'Arta':'Lira',id=role==='lira'?'K-43':'K-42';
  const seats=isDriver?state.server.seats:state.views[role].seats,status=isDriver?state.server.requests[id].status:state.views[role].status;
  const text=status==='accepted'?'E pranuar':'Në pritje';
  const forbidden=state.number===2&&!isDriver&&state.actor===role&&state.response?.status===403;
  const action=isDriver?`<button class="phone-action" data-action="accept" ${!interactive||state.number===2||status==='accepted'?'disabled':''}>Prano K-42</button>`:interactive?`<button class="phone-action" data-action="read-${role}">Rilexo kërkesën</button>`:'<div class="phone-action">Gjendja e lexuar</div>';
  return `<div><h3 class="role-title">${isDriver?'Shoferi':'Udhëtarja'} · ${name}</h3><div class="phone" data-phone="${role}"><div class="notch"></div><header><strong>RideShare</strong><span>${name} · ${isDriver?'Shofer':'Udhëtare'}</span></header><div class="phone-label">UDHËTIMI 2 · SIMULIM</div><div class="ride"><small>FERIZAJ → AAB</small><h3>Nisja 08:15</h3><p>Dritoni · Automjet privat</p><div class="ride-meta"><span>Vende të lira<strong>${seats}</strong></span><span>Kërkesa<strong>${id}</strong></span></div></div><div class="request ${status==='accepted'?'success':'pending'}"><small>${isDriver?'KËRKESA E ARTËS':'KËRKESA IME'}</small><strong>${text}</strong></div>${action}<p class="phone-status ${forbidden?'error':status==='accepted'?'success':''}">${forbidden?'403 · Pranimi kërkon shoferin pronar.':status==='accepted'?'Vendi u konfirmua.':'Ende pa konfirmim.'}</p><small class="phone-foot">${isDriver?'Gjendja e serverit të simuluar':'Pamja pas leximit të fundit'}</small><div class="homebar"></div></div></div>`;
 };
 return `<div class="pair">${phone(driver?'dritoni':'arta')}${phone(driver?'arta':'lira')}</div>`;
}
