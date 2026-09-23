'use strict';
let state='list',request='none',seats=2;
const screen=document.getElementById('screen');
function button(label,fn){const b=document.createElement('button');b.textContent=label;b.onclick=fn;screen.append(b);}
function line(tag,value){const e=document.createElement(tag);e.textContent=value;screen.append(e);}
function render(){screen.replaceChildren();
 if(state==='list'){line('h2','Udhëtimet');line('p',`Prishtinë – AAB, 08:00. ${seats} vende të lira.`);button('Shiko',()=>{state='details';render();});}
 if(state==='details'){line('h2','Detajet');line('p',`Prishtinë – AAB. Nisja 08:00. Takimi: Biblioteka. ${seats} vende të lira.`);button('Kthehu te lista',()=>{state='list';render();});if(request==='none')button('Kërko një vend',()=>{request='pending';state='status';render();});else button('Shiko kërkesën tënde',()=>{state='status';render();});}
 if(state==='status'){line('h2',request==='pending'?'Kërkesa u dërgua':request==='accepted'?'Kërkesa u pranua':'Kërkesa u refuzua');line('p',request==='pending'?'Në pritje të përgjigjes së shoferit.':request==='accepted'?`Një vend u konfirmua në simulim. Mbeten ${seats} vende.`:'Zgjidh një udhëtim tjetër.');if(request==='pending')button('Simulo përgjigjen e shoferit',()=>{state='driver';render();});button('Shiko udhëtimet',()=>{state='list';render();});}
 if(state==='driver'){line('h2','Roli demonstrues i shoferit');line('p','Arta kërkon një vend. Zgjidh përgjigjen për të parë rezultatin.');button('Prano',()=>{if(request==='pending'&&seats>0){request='accepted';seats--;}state='status';render();});button('Refuzo',()=>{request='rejected';state='status';render();});}
 document.getElementById('announcement').textContent=`Ekrani: ${state}. Gjendja e kërkesës: ${request==='none'?'pa kërkesë':request==='pending'?'në pritje':request==='accepted'?'pranuar':'refuzuar'}.`;
}
document.getElementById('reset').onclick=()=>{state='list';request='none';seats=2;render();};render();
