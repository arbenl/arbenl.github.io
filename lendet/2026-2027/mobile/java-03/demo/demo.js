'use strict';

const trips=[
  {id:'1',from:'Prishtinë',to:'AAB',time:'08:00',meeting:'Stacioni i autobusëve',seats:2},
  {id:'2',from:'Fushë Kosovë',to:'AAB',time:'08:15',meeting:'Te stacioni kryesor',seats:1},
  {id:'3',from:'Lipjan',to:'AAB',time:'07:45',meeting:'Qendra e qytetit',seats:0}
];
const screen=document.getElementById('screen');
const routeLabel=document.getElementById('route-label');
const lessonTitle=document.getElementById('lesson-title');
const lessonText=document.getElementById('lesson-text');
const whyList=document.getElementById('why-list');
const lessonQuestion=document.getElementById('lesson-question');

function add(tag,text,className='',parent=screen){const node=document.createElement(tag);node.textContent=text;if(className)node.className=className;parent.append(node);return node;}
function link(parent,text,route,className='button'){const node=add('a',text,className,parent);node.href=`#${route}`;return node;}
function note(parent,text,important=false){return add('p',text,`arrow-note${important?' important':''}`,parent);}
function lesson(title,text,reasons,question){lessonTitle.textContent=title;lessonText.textContent=text;whyList.replaceChildren();for(const reason of reasons)add('li',reason,'',whyList);lessonQuestion.textContent=question;}
function navigate(path){const hash=`#${path}`;if(window.location.hash===hash)render();else window.location.hash=hash;}
function route(){let value;try{value=decodeURIComponent(window.location.hash.slice(1)||'/');}catch{return '/adresë-e-pavlefshme';}return value.startsWith('/')?value:'/'+value;}
function setStep(step){for(const id of ['list','details','pending','missing']){const node=document.getElementById('flow-'+id);if(id===step)node.setAttribute('aria-current','step');else node.removeAttribute('aria-current');}}
function heading(text){const node=add('h2',text);node.id='app-heading';node.tabIndex=-1;return node;}

function list(){
  setStep('list');
  const title=heading('Zgjidh një udhëtim');
  add('p','Tri nisje fiktive për në AAB. Çdo kartë është i njëjti komponent me të dhëna të ndryshme.','lead');
  note(screen,'Një komponent KartaUdhetimi përdoret tri herë; vetëm të dhënat ndryshojnë.');
  const grid=add('div','','trip-grid');
  for(const trip of trips){
    const card=add('article','','trip-card',grid);card.dataset.tripId=trip.id;
    add('h3',`${trip.from} → ${trip.to}`,'',card);
    add('p',`Ora ${trip.time}`,'',card);
    add('p',trip.seats===0?'Nuk ka vende të lira':`${trip.seats} vende të lira`,'',card);
    link(card,'Shiko detajet →',`/udhetimi/${trip.id}`);
  }
  note(screen,'Lidhja “Shiko detajet” ruan ID-në e kartës në adresë: karta 2 hap /udhetimi/2.');
  lesson('Pse ka tri karta?','Arta duhet të krahasojë alternativat para se të kërkojë vend. Faqja e listës nuk përzien detajet e tri udhëtimeve.',[
    'E njëjta pamje karte ripërdoret për secilin udhëtim.',
    'ID-ja e qëndrueshme përcakton cilat detaje do të hapen.'
  ],'Kliko kartën e dytë. Cila ID duhet të shfaqet në adresë?');
  return title;
}

function details(trip){
  setStep('details');
  const title=heading(`${trip.from} → ${trip.to}`);
  note(screen,`ID ${trip.id} u lexua nga adresa. Pa këtë ID, faqja nuk do ta dinte cilin udhëtim të tregonte.`);
  const card=add('div','','detail-card');
  const data=add('dl','','',card);
  for(const [label,value] of [['Nisja',trip.from],['Ora',trip.time],['Vendtakimi',trip.meeting],['Vende të lira',String(trip.seats)]]){add('dt',label,'',data);add('dd',value,'',data);}
  note(screen,'Vendtakimi shfaqet te detajet, sepse Arta e kontrollon para kërkesës.');
  const actions=add('div','','actions');
  if(trip.seats>0){link(actions,'Kërko vend →',`/udhetimi/${trip.id}/kerkesa`);note(screen,'Ky buton hap ekranin demonstrues të kërkesës; ende nuk dërgon asgjë.',true);}
  else{const disabled=add('button','Nuk ka vende të lira','',actions);disabled.type='button';disabled.disabled=true;note(screen,'Butoni është i çaktivizuar sepse nuk mund të kërkohet një vend që nuk ekziston.',true);}
  link(actions,'← Kthehu te lista','/','button secondary');
  lesson('Pse duhen detajet?','Karta është për zgjedhje të shpejtë. Kjo faqe i jep Artës të dhënat që i duhen para se të veprojë.',[
    `Adresa /udhetimi/${trip.id} zgjedh saktësisht një objekt nga lista.`,
    trip.seats>0?'Butoni “Kërko vend” është hapi i radhës, por sot mbetet simulim.':'Me zero vende, veprimi i pamundur nuk premton sukses.'
  ],trip.seats>0?'Çfarë do të ndodhte nëse ID-ja në adresë do të ishte 99?':'Pse nuk duhet të jetë aktiv “Kërko vend”?');
  return title;
}

function pending(trip){
  setStep('pending');
  const title=heading('Simulim: Në pritje');
  add('p',`Zgjodhe udhëtimin ${trip.from} → ${trip.to} në ${trip.time}.`,'lead');
  add('p','Kjo kërkesë nuk është dërguar te shoferi. Nuk ka rezervim real.','badge pending');
  note(screen,'“Në pritje” tregon vetëm hapin e rrjedhës që po demonstrojmë. Ruajtja dhe përgjigjja e shoferit vijnë në javët e tjera.',true);
  const actions=add('div','','actions');
  link(actions,'← Kthehu te detajet',`/udhetimi/${trip.id}`,'button secondary');
  link(actions,'Zgjidh një udhëtim tjetër','/','button secondary');
  lesson('Pse nuk shkruan “U rezervua”?','Në Javën 3 nuk kemi server ose databazë për kërkesa. Një konfirmim i rremë do ta mashtronte përdoruesen.',[
    'Adresa e kërkesës ruan të njëjtën ID si faqja e detajeve.',
    'Teksti tregon qartë kufirin e këtij demonstrimi.'
  ],'Çfarë duhet të ndërtojmë më vonë që kjo kërkesë të bëhet reale?');
  return title;
}

function missing(path){
  setStep('missing');
  const wrapper=add('div','','not-found');
  add('strong','404','',wrapper);
  const title=add('h2','Udhëtimi nuk u gjet','',wrapper);title.id='app-heading';title.tabIndex=-1;
  add('p',`Nuk kemi udhëtim për adresën ${path}. Nuk tregojmë detajet e një udhëtimi tjetër.`,'lead',wrapper);
  note(wrapper,'Kur ID-ja nuk ekziston, notFound() jep një përgjigje të qartë në vend të të dhënave të gabuara.',true);
  const actions=add('div','','actions',wrapper);
  link(actions,'← Kthehu te lista','/','button secondary');
  link(actions,'Provo udhëtimin 2','/udhetimi/2');
  lesson('Pse ekziston 404?','Një adresë mund të shkruhet gabim, të ndryshohet me dorë ose të mos jetë më e vlefshme.',[
    'ID 99 nuk gjendet në tri udhëtimet tona.',
    'Më mirë të thuash “nuk u gjet” sesa të tregosh udhëtimin e gabuar.'
  ],'Provo /udhetimi/2. Çfarë ndryshon në ekran dhe në adresë?');
  return title;
}

function render(focus=true){
  const path=route();
  routeLabel.textContent=path;
  screen.replaceChildren();
  let title;
  if(path==='/')title=list();
  else{
    const match=path.match(/^\/udhetimi\/([^/]+)(\/kerkesa)?\/?$/);
    const trip=match?trips.find(item=>item.id===match[1]):undefined;
    if(!trip)title=missing(path);
    else if(match[2])title=trip.seats>0?pending(trip):details(trip);
    else title=details(trip);
  }
  if(focus)title.focus();
}

document.getElementById('reset').addEventListener('click',()=>navigate('/'));
document.getElementById('route-form').addEventListener('submit',event=>{
  event.preventDefault();
  const input=document.getElementById('route-input').value.trim().replace(/^#/,'');
  navigate(input.startsWith('/')?input:'/'+input);
});
window.addEventListener('hashchange',()=>render());
if(!window.location.hash)window.history.replaceState(null,'','#/');
render(false);
