(()=>{
const cases=["Përgjigjja bëhet njoftim", "Hapja dhe shënimi si i lexuar", "Rilidhja pa njoftime të dyfishta"];
function initialState(number=1){
 const state={number,server:{request:'pending',seats:2,notifications:[]},client:{online:number!==3,request:'pending',seats:2,items:[],known:[],permission:'default',screen:'inbox',readError:false,toastCount:0,popupCount:0,toastId:null,popupId:null,openedRequestId:null},permissionRequests:0,permissionPrompt:false,reads:0};
 if(number===2){const n={id:'N-42',requestId:'K-42',recipient:'arta',result:'accepted',read:false};state.server={request:'accepted',seats:1,notifications:[n]};Object.assign(state.client,{request:'accepted',seats:1,items:[{...n}],known:['N-42']});}
 return state;
}
function transition(input,event){
 const state=structuredClone(input),c=state.client;
 function read(initial=false){
  if(!c.online)return;
  const items=state.server.notifications.filter(n=>n.recipient==='arta').map(n=>({...n}));
  const fresh=items.filter(n=>!c.known.includes(n.id)&&!n.read);
  c.items=items;c.request=state.server.request;c.seats=state.server.seats;
  c.toastId=null;c.popupId=null;
  if(!initial&&fresh.length){c.toastId=fresh[0].id;c.toastCount+=fresh.length;if(c.permission==='granted'){c.popupId=fresh[0].id;c.popupCount+=fresh.length;}}
  c.known=[...new Set([...c.known,...items.map(n=>n.id)])];state.reads++;
 }
 if(event.type==='respond'&&state.server.request==='pending'&&['accepted','rejected'].includes(event.result)){
  if(event.result==='accepted'&&state.server.seats<1)return state;
  state.server.request=event.result;
  if(event.result==='accepted')state.server.seats--;
  state.server.notifications.push({id:'N-42',requestId:'K-42',recipient:'arta',result:event.result,read:false});
 }
 if(event.type==='poll')read();
 if(event.type==='disconnect'){c.online=false;c.toastId=null;c.popupId=null;}
 if(event.type==='connect'){c.online=true;read();}
 if(event.type==='reload'&&c.online){c.toastCount=0;c.popupCount=0;c.openedRequestId=null;c.screen='inbox';c.readError=false;read(true);}
 if(event.type==='open'&&c.online){
  const item=state.server.notifications.find(n=>n.id===event.id&&n.recipient===(event.actor??'arta'));
  if(item&&item.recipient==='arta'){c.openedRequestId=item.requestId;c.screen='details';c.readError=!!event.fail;if(!event.fail){item.read=true;read(true);}}
 }
 if(event.type==='back'){c.screen='inbox';c.readError=false;}
 if(event.type==='dismiss-toast')c.toastId=null;
 if(event.type==='request-permission'&&c.permission==='default'&&!state.permissionPrompt){state.permissionRequests++;state.permissionPrompt=true;}
 if(event.type==='permission-result'&&state.permissionPrompt&&['granted','denied'].includes(event.value)){c.permission=event.value;state.permissionPrompt=false;}
 if(event.type==='unsupported'){c.permission='unsupported';state.permissionPrompt=false;}
 return state;
}

const status={pending:'Në pritje',accepted:'U pranua',rejected:'U refuzua'};
let number=Number(new URLSearchParams(location.search).get('case'));if(![1,2,3].includes(number))number=1;
let state=initialState(number),automatic=false,timer=null,toastTimer=null;
const $=s=>document.querySelector(s);
function say(t){$('[data-narration]').textContent=t;}
function render(){
 const c=state.client,n=c.items[0],unread=c.items.filter(n=>!n.read).length,details=c.screen==='details';
 $('[data-case-title]').textContent='Rasti '+state.number+' · '+cases[state.number-1];
 document.querySelectorAll('[data-case]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.case)===state.number)));
 $('[data-driver-decision]').textContent=state.server.request==='pending'?'Zgjidh përgjigjen':'Përgjigjja u ruajt';
 $('[data-repeat]').disabled=state.server.request==='pending';
 $('[data-driver-status]').textContent=status[state.server.request];$('[data-driver-seats]').textContent=state.server.seats;
 $('[data-passenger-status]').textContent=status[c.request];$('[data-passenger-seats]').textContent=c.seats;
 $('[data-unread]').textContent=unread;$('[data-inbox-empty]').hidden=!!n;$('[data-inbox-card]').hidden=!n;
 if(n){
  $('[data-inbox-title]').textContent='Dritoni '+(n.result==='accepted'?'e pranoi':'e refuzoi')+' kërkesën';
  $('[data-inbox-state]').textContent=n.id+' · '+(n.read?'I LEXUAR':'I PALEXUAR');
  $('[data-inbox-card]').classList.toggle('read',n.read);
  $('[data-open]').textContent=n.read?'Hap sërish K-42':'Hap kërkesën K-42';
 }
 $('[data-open]').disabled=!n||!c.online;
 $('[data-summary]').hidden=details;$('[data-detail-seats]').textContent=c.seats;$('[data-inbox-view]').hidden=details;$('[data-details-view]').hidden=!details;
 $('[data-phone-label]').textContent=details?'DETAJET · '+c.openedRequestId:'UDHËTIMI 2';
 $('[data-detail-status]').textContent=status[c.request];
 $('[data-read-confirmation]').hidden=!n?.read;$('[data-read-error]').hidden=!c.readError;
 $('[data-retry]').hidden=!c.readError;$('[data-retry]').disabled=!c.online;
 $('[data-health]').textContent=c.online?'Gjendja u lexua nga serveri':'Pa lidhje · pamja e fundit';
 $('[data-health]').className='phone-status '+(c.online?'success':'error');
 for(const b of document.querySelectorAll('[data-response]'))b.disabled=state.server.request!=='pending';
 const total=state.server.notifications.length,readCount=state.server.notifications.filter(n=>n.read).length;
 $('[data-server]').textContent=status[state.server.request]+' · '+total+' '+(total===1?'njoftim':'njoftime')+' · '+readCount+(readCount===1?' i lexuar':' të lexuara');
 $('[data-counts]').textContent=c.toastCount+' toast · '+c.popupCount+' njoftim pajisjeje (simulim)';
 $('[data-permission-state]').textContent=c.permission;
 $('[data-permission-request]').disabled=c.permission!=='default'||state.permissionPrompt;
 $('[data-permission-choices]').hidden=!state.permissionPrompt;
 $('[data-online]').textContent=c.online?'Ndërprit rrjetin e Artës':'Rilidh Artën';
 $('[data-auto]').textContent=automatic?'Pauzo leximin automatik':'Aktivizo leximin çdo 5 sekonda';
 $('[data-read]').disabled=!c.online;$('[data-toast]').hidden=!c.toastId;$('[data-popup]').hidden=!c.popupId;
}
function act(e,message){
 const before=state.client.toastId;state=transition(state,e);render();if(message)say(message);
 if(!state.client.toastId){clearTimeout(toastTimer);toastTimer=null;}
 else if(before!==state.client.toastId){clearTimeout(toastTimer);toastTimer=setTimeout(()=>{toastTimer=null;state=transition(state,{type:'dismiss-toast'});render();},3000);}
}
function schedule(){clearTimeout(timer);timer=null;if(automatic&&!document.hidden)timer=setTimeout(()=>{act({type:'poll'});schedule();},5000);}
function select(n){
 clearTimeout(timer);clearTimeout(toastTimer);automatic=false;state=initialState(n);$('[data-fail]').checked=false;
 say(n===3?'Arta është offline. Shoferi pranon; pastaj rilidhe Artën dhe provo dy lexime të tjera.':n===2?'Arta ka njoftimin N-42 të palexuar. Hape: duhet të shohësh kërkesën K-42, pastaj kthehu te historia.':'Shoferi pranon kërkesën. Ndalo para leximit të Artës: çfarë ka ndryshuar vetëm në server?');render();
}
for(const b of document.querySelectorAll('[data-case]'))b.addEventListener('click',()=>select(Number(b.dataset.case)));
for(const b of document.querySelectorAll('[data-response]'))b.addEventListener('click',()=>act({type:'respond',result:b.dataset.response},'SIMULIM: përgjigjja dhe një njoftim u ruajtën në server. Arta e merr pas leximit.'));
$('[data-read]').addEventListener('click',()=>act({type:'poll'},'U lexua lista personale. ID-ja e njëjtë nuk krijon njoftim ose toast të dytë.'));
$('[data-repeat]').addEventListener('click',()=>act({type:'respond',result:state.server.request},'Përgjigjja e përsëritur nuk krijon rekord tjetër dhe nuk ndryshon vendet përsëri.'));
function open(){const fail=$('[data-fail]').checked;act({type:'open',id:'N-42',fail},fail?'Kërkesa K-42 u hap, por shënimi si i lexuar dështoi. Numri mbetet 1. Hiq provën e gabimit dhe provo shënimin përsëri.':'U hap kërkesa K-42. Leximi u konfirmua: numri është 0, ndërsa njoftimi mbetet në histori.');}
$('[data-open]').addEventListener('click',open);$('[data-retry]').addEventListener('click',open);
$('[data-back]').addEventListener('click',()=>act({type:'back'},'U ktheve te historia e njoftimeve. Kërkesa dhe numri i vendeve nuk u ndryshuan.'));
$('[data-online]').addEventListener('click',()=>act({type:state.client.online?'disconnect':'connect'},state.client.online?'Vetëm Arta është offline. Shoferi dhe serveri vazhdojnë.':'Arta u rilidh dhe lexoi menjëherë listën. Provo edhe dy lexime për të kontrolluar dublimet.'));
$('[data-reload]').addEventListener('click',()=>act({type:'reload'},'Simulim rihapjeje: historia u lexua pa i paraqitur njoftimet e vjetra si alarme të reja.'));
$('[data-permission-request]').addEventListener('click',()=>act({type:'request-permission'},'Provë opsionale, vetëm simulim: tani përdoruesi zgjedh. Nuk kërkohet leje reale nga pajisja.'));
for(const b of document.querySelectorAll('[data-permission-answer]'))b.addEventListener('click',()=>act({type:'permission-result',value:b.dataset.permissionAnswer},'Leja ndryshon vetëm kanalin e pajisjes. Lista personale vazhdon.'));
$('[data-unsupported]').addEventListener('click',()=>act({type:'unsupported'},'Simulim: pa mbështetje, lista personale mbetet funksionale.'));
$('[data-auto]').addEventListener('click',()=>{automatic=!automatic;render();schedule();});
$('[data-reset]').addEventListener('click',()=>select(state.number));
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&automatic)act({type:'poll'});schedule();});
select(number);

})();
