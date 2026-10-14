const people={anon:null,arta:{id:'101',name:'Arta',role:'udhetar'},dritoni:{id:'202',name:'Dritoni',role:'shofer'},other:{id:'303',name:'Besa',role:'shofer'}};
const person=document.querySelector('#person'),identity=document.querySelector('#identity'),result=document.querySelector('#result'),checks=document.querySelector('#checks');
person.addEventListener('change',()=>{const p=people[person.value];identity.textContent=p?`Identiteti: ${p.name}, ID ${p.id}. Roli në databazë: ${p.role}.`:'Pa sesion: identiteti nuk dihet.';result.textContent='Parashiko çfarë ndodh, pastaj provo një udhëtim.';for(const li of checks.children)li.removeAttribute('data-result');});
for(const button of document.querySelectorAll('[data-trip]'))button.addEventListener('click',()=>{
 const p=people[person.value],owner=button.dataset.trip==='2'?'202':'303';const states=[Boolean(p),p?.role==='shofer',p?.id===owner];
 const labels=['Ka sesion?','Ka rol shofer?','Është pronari i këtij udhëtimi?'];let stopped=false;
 [...checks.children].forEach((li,i)=>{li.textContent=labels[i]+' '+(stopped?'Nuk vazhdojmë më.':states[i]?'Po.':'Jo.');li.dataset.result=stopped?'skipped':states[i]?'yes':'no';if(!states[i])stopped=true;});
 result.textContent=!p?'REFUZOHET: duhet hyrje. Nuk bëhet UPDATE.':p.role!=='shofer'?'REFUZOHET: Arta është udhëtare. Nuk bëhet UPDATE.':p.id!==owner?'REFUZOHET: ka rol shofer, por nuk është pronari. Ora nuk ndryshon.':'LEJOHET: sesioni, roli dhe pronari përputhen. Në aplikacionin real serveri tani kontrollon orën dhe e ruan në Neon.';
});
