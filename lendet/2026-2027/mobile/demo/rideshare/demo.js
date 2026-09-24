'use strict';
let state='list',request='none',seats=2;
const screen=document.getElementById('screen');
const lessons={
 list:['Fillojmë si Arta, udhëtarja.','Arta sheh një udhëtim që i përshtatet. Së pari hap detajet; ende nuk ka kërkuar vend.','Kliko “Shiko udhëtimin”.'],
 details:['Kontrollojmë para se të kërkojmë.','Arta lexon orën, vendin e takimit dhe vendet e lira. Pastaj mund të kërkojë një vend.','Çfarë duhet të dijë Arta para se të klikojë?'],
 pending:['Kërkesa nuk është ende konfirmim.','Arta e dërgoi kërkesën. Dreni ende nuk është përgjigjur, prandaj mbeten 2 vende të lira.','Pse shkruan “Në pritje” dhe jo “U rezervua”?'],
 driver:['Tani kalojmë te Dreni, shoferi.','Profesori tregon anën tjetër të aplikacionit. Dreni sheh kërkesën e Artës dhe vendos nëse e pranon.','Ky veprim i përket shoferit, jo udhëtares.'],
 accepted:['Tani vendi është konfirmuar.','Dreni e pranoi kërkesën. Arta ka një vend dhe numri i vendeve të lira ndryshoi nga 2 në 1.','Cili veprim e ndryshoi gjendjen? Përgjigjja e shoferit.'],
 rejected:['Përgjigjja mund të jetë edhe “Jo”.','Dreni e refuzoi kërkesën. Arta nuk ka vend të konfirmuar; numri i vendeve të lira nuk ndryshon.','Aplikacioni duhet ta tregojë qartë edhe refuzimin.'],
 full:['Nuk mund të kërkosh një vend që nuk ekziston.','Kur ka 0 vende të lira, butoni i kërkesës është i çaktivizuar dhe arsyeja shihet në ekran.','Studenti duhet të kuptojë pse nuk mund të vazhdojë.']
};
function element(tag,text,className,parent=screen){const e=document.createElement(tag);e.textContent=text;if(className)e.className=className;parent.append(e);return e;}
function button(parent,label,action,secondary=false){const b=element('button',label,secondary?'secondary':'',parent);b.type='button';b.onclick=action;return b;}
function go(next){state=next;render();}
function reset(count=2){state='list';request='none';seats=count;document.getElementById('story').textContent=count?'Dreni niset nga Prishtina dhe ka 2 vende të lira. Arta dëshiron të udhëtojë me të. Ndiqi tri ekranet.':'Rast tjetër: udhëtimi është plot. Arta hap detajet, por nuk mund të kërkojë vend.';render();}
function render(focus=true){
 screen.replaceChildren();
 const current=state==='driver'?'status':state;
 for(const id of ['list','details','status']){const e=document.getElementById('step-'+id);if(id===current)e.setAttribute('aria-current','step');else e.removeAttribute('aria-current');}
 document.getElementById('role').textContent=state==='driver'?'Tani po sheh: Dreni · Shofer':'Tani po sheh: Arta · Udhëtare';
 const title=element('h2',state==='list'?'1. Zgjidh udhëtimin':state==='details'?'2. Shiko detajet':state==='driver'?'Dreni merr kërkesën':'3. Shiko përgjigjen');title.id='screen-title';title.tabIndex=-1;
 const lesson=state==='driver'?'driver':state==='status'?request:seats===0?'full':state;
 document.getElementById('lesson-title').textContent=lessons[lesson][0];document.getElementById('lesson-text').textContent=lessons[lesson][1];document.getElementById('question').textContent=lessons[lesson][2];
 if(state==='list'||state==='details'){
  const trip=element('div','','trip');element('h3','Prishtinë → AAB','',trip);element('p','Shoferi: Dreni · Nisja: 08:00','',trip);
  if(state==='details')element('p','Takimi: para Bibliotekës','',trip);
  element('p',`${seats} vende të lira`,'badge',trip);
  const actions=element('div','','actions');
  if(state==='list')button(actions,'Shiko udhëtimin →',()=>go('details'));
  else{if(request==='none'){const b=button(actions,seats?'Kërko 1 vend':'Nuk ka vende të lira',()=>{if(seats>0){request='pending';go('status');}});b.disabled=seats===0;}else button(actions,'Shiko kërkesën time →',()=>go('status'));button(actions,'← Kthehu te lista',()=>go('list'),true);}
 }else if(state==='driver'){
  element('p','Arta kërkon 1 vend në udhëtimin tënd.','result');element('p',`${seats} vende të lira para përgjigjes.`);
  const actions=element('div','','actions');button(actions,'Prano kërkesën',()=>{if(request==='pending'&&seats>0){request='accepted';seats--;}go('status');});button(actions,'Refuzo kërkesën',()=>{if(request==='pending')request='rejected';go('status');},true);
 }else{
  element('p',request==='pending'?'Në pritje':request==='accepted'?'Vendi u konfirmua':'Kërkesa u refuzua',`badge ${request}`);
  element('p',request==='pending'?'Arta, prit përgjigjen e Drenit.':request==='accepted'?'Arta, ke 1 vend. Takohuni te Biblioteka në 08:00.':'Arta, ky udhëtim nuk u konfirmua. Mund të kërkosh një tjetër.','result');
  element('p',`Vende të lira: ${seats}`);
  const actions=element('div','','actions');
  if(request==='pending')button(actions,'Trego anën e shoferit →',()=>go('driver'));
  else button(actions,'Provoje nga fillimi',()=>reset());
  button(actions,'Shiko udhëtimin',()=>go('details'),true);
 }
 document.getElementById('announcement').textContent=title.textContent+'. '+document.getElementById('role').textContent;
 if(focus)title.focus();
}
document.getElementById('reset').onclick=()=>reset();document.getElementById('no-seats').onclick=()=>{reset(0);go('details');};render(false);
