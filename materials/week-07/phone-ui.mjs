// One phone view for the live demo, teaching pages and exported presentation images.
import {demoState} from './week-07-model.mjs';
const e=v=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export const PHONE_SIZE={width:360,height:560};
export const PHONE_HITS={trips:[{id:1,x:29,y:132,w:302,h:43},{id:2,x:29,y:180,w:302,h:43},{id:3,x:29,y:228,w:302,h:43}],request:{x:29,y:438,w:302,h:44}};
export function phoneState(scene='normal',options={}){
 const base=demoState(scene==='pending'||scene==='mismatch'?'normal':scene,options.selectedId??2);
 return {...base,pending:scene==='pending',mismatch:scene==='mismatch',scene};
}
export function renderPhoneSvg(role,scene='normal',options={}){
 if(!['driver','passenger'].includes(role))throw Error('Unknown phone role');
 const state=phoneState(scene,options),driver=role==='driver',trip=state.trip,own=trip||state.trips[1];
 const disabled=state.disabled;const color=disabled?'#304057':'#fbb16b';
 const txt=(v,x,y,size=16,fill='#edf2ff',weight=400)=>`<text x="${x}" y="${y}" font-family="Arial, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}">${e(v)}</text>`;
 const box=(x,y,w,h,fill='#18263b',stroke='#3f526e',rx=12)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}"/>`;
 const label=driver?'Shoferi · '+own.driver:'Udhëtari · Arta';
 let inner=txt(driver?'UDHËTIMI IM':'UDHËTIMET DREJT AAB',29,118,12,'#aebed6',700);
 if(driver){inner+=box(29,135,302,158)+txt(own.from+' → AAB',45,164,23,'#fff',700)+txt('ID '+own.id+' · '+own.driver,45,193,15,'#b8c8df')+txt('Nisja',45,225,13,'#aebed6')+txt('Vende të lira',184,225,13,'#aebed6')+txt(own.time,45,258,29,'#fff',700)+txt(own.seats,184,258,29,'#fbb16b',700);
  inner+=box(29,312,302,73,'#102b2a','#32655d')+txt('Të dhënat e provës',45,340,17,'#b8eddb',700)+txt('I njëjti udhëtim në të dy ekranet.',45,365,14,'#c6d7d2');
  inner+=box(29,403,302,44,'#26364b','#4a5d76')+txt('Vetëm lexim · demonstrim',180,431,16,'#c4d1e5',700).replace('y="431"','y="431" text-anchor="middle"');
  inner+=txt('Ndryshimet provohen në projektin tënd.',29,478,14,'#b6c6dd');
 }else{
  for(const [i,t]of state.trips.entries()){const h=PHONE_HITS.trips[i],selected=trip?.id===t.id;inner+=box(h.x,h.y,h.w,h.h,selected?'#302a27':'#18263b',selected?'#fbb16b':'#3f526e',9)+txt(t.driver+' · '+t.from+' → AAB',42,h.y+19,15,'#fff',700)+txt(t.time+' · '+t.seats+' vende',42,h.y+35,13,'#bdcbe0');}
  const time=state.mismatch?'08:40':trip?.time;
  inner+=box(29,284,302,141);
  if(trip){inner+=txt('DETAJET · ID '+trip.id,43,309,12,'#aebed6',700)+txt(trip.driver+' · '+trip.from+' → AAB',43,339,19,'#fff',700)+txt('Nisja '+time+' · '+trip.seats+' vende',43,367,19,'#fff',700);
   const status=state.pending?'Në pritje · SIMULIM':state.offline?'Kopje e ruajtur në 07:00':trip.seats===0?'Nuk ka vende të lira':'Zgjidh udhëtimin që të përshtatet';inner+=txt(status,43,401,14,state.offline?'#fbb16b':'#b8eddb',700);
  }else{inner+=txt('Udhëtimi nuk u gjet',43,326,23,'#fff',700)+txt('ID 999 nuk ekziston.',43,357,16,'#bdcbe0')+txt('Zgjidh një kartë nga lista.',43,390,16,'#fbb16b');}
  const button=!trip?'Kthehu te lista':state.offline?'Offline · kërkesa joaktive':trip.seats===0?'Nuk ka vende të lira':'Provo kërkesën · simulim';
  inner+=box(29,438,302,44,!trip?'#26364b':color,!trip?'#4a5d76':color)+txt(button,180,466,16,disabled||!trip?'#d0dbea':'#182030',700).replace('y="466"','y="466" text-anchor="middle"');
  inner+=txt(state.pending?'Pa rezervim real ose njoftim te shoferi.':state.offline?'Kopja mund të jetë e vjetër.':'Demonstrim mësimor · pa rezervim real',29,504,13,'#b6c6dd');
 }
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 560" width="360" height="560" role="img" aria-label="${e(label+' · RideShare · '+scene)}">${box(2,2,356,556,'#080e19','#697c96',35)}${box(12,12,336,536,'#101b2d','#101b2d',27)}<rect x="137" y="19" width="86" height="7" rx="4" fill="#43516a"/>${txt('RideShare',29,67,24,'#fff',700)}${txt(label,29,91,15,'#fbb16b',700)}<path d="M29 103h302" stroke="#3f526e"/>${inner}<rect x="131" y="531" width="98" height="4" rx="2" fill="#8596ad"/></svg>`;
}
export function renderPhonePair(view,compact=false){
 const scene=view.scene||'normal';
 return `<figure class="screen-checkpoint phone-checkpoint${compact?' compact':''}"><figcaption>${e(view.caption||'I njëjti RideShare në të dy rolet')}</figcaption><div class="role-screens">${['driver','passenger'].map(role=>`<div class="role-screen ${role}" aria-label="${role==='driver'?'Ekrani i shoferit':'Ekrani i udhëtarit'}"><div class="rs-phone">${renderPhoneSvg(role,scene)}</div>${view[role]?.status?`<p class="phone-context">${e(view[role].status)}</p>`:''}</div>`).join('')}</div><p class="screen-rule">${e(view.rule||'Pamje ilustruese të demonstrimit. Krahaso gjendjen me projektin tënd.')}</p></figure>`;
}
