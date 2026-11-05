const field=document.querySelector('#meeting');
const chosen=document.querySelector('#chosen');
const error=document.querySelector('#error');
const status=document.querySelector('#status');
const why=document.querySelector('#why');
const locate=document.querySelector('#locate');
const scenario=document.querySelector('#scenario');
let timer;
const outcomes={
 accepted:['Pozicioni u mor · saktësia 37 m.','Matja është një vlerësim. Arta shkruan vendtakimin e dallueshëm dhe e konfirmon vetë.'],
 denied:['Leja u refuzua. Shkruaj vendtakimin vetë.','Refuzimi përfundon pritjen. Fusha manuale dhe butoni Konfirmo mbeten të përdorshëm.'],
 timeout:['Koha e pritjes mbaroi. Provo sërish ose shkruaj vendtakimin.','Mungesa e përgjigjes nuk do të thotë refuzim. Butoni bëhet sërish i përdorshëm.'],
 unavailable:['Leximi nuk mbështetet. Shkruaj vendtakimin vetë.','Kontrollojmë aftësinë e pajisjes përpara thirrjes. Rruga manuale vazhdon të punojë.']
};
field.addEventListener('input',()=>{why.textContent='Teksti në fushë është ende në shkrim. Vendtakimi poshtë ndryshon vetëm pas konfirmimit.';});
document.querySelector('#confirm').addEventListener('click',()=>{
 if(!field.value.trim()){error.textContent='Shkruaj një vendtakim, jo vetëm hapësira.';why.textContent='Teksti bosh nuk e fshin zgjedhjen e mëparshme.';return;}
 error.textContent='';chosen.textContent=field.value.trim();why.textContent='Arta e konfirmoi në telefonin e vet. Dritoni ende nuk ka marrë njoftim. Në këtë ushtrim ruajmë gjendjen lokale.';
});
locate.addEventListener('click',()=>{
 const mode=scenario.value;locate.disabled=true;status.textContent='Po kërkojmë vendndodhjen…';
 timer=setTimeout(()=>{status.textContent=outcomes[mode][0];why.textContent=outcomes[mode][1];locate.disabled=false;},650);
});
document.querySelector('#reset').addEventListener('click',()=>{clearTimeout(timer);field.value='';chosen.textContent='Ende pa zgjedhje';error.textContent='';status.textContent='Vendndodhja kërkohet vetëm kur klikon.';why.textContent='Parashiko çfarë do të shfaqet, pastaj provoje.';scenario.value='accepted';locate.disabled=false;});
