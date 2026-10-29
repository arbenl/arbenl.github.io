// Learning scenarios only. No accounts, database connections or reservation writes.
export function personalCase(value){
 const login=String(value).trim().toLowerCase();
 if(!/^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$/.test(login))throw new Error('Shkruaj emrin publik GitHub, pa @, email ose link.');
 let hash=0;for(const char of login)hash=(hash*31+char.charCodeAt(0))%1000;
 const towns=['Prizren','Ferizaj','Gjilan','Pejë','Gjakovë','Mitrovicë'];
 const hour=8+Math.floor(hash/6)%3,minute=(hash%6)*5;
 return {login,code:'P7-'+String(hash).padStart(3,'0'),from:towns[hash%6],to:'AAB',time:String(hour).padStart(2,'0')+':'+String(minute).padStart(2,'0'),seats:1+hash%3,newTime:String(hour).padStart(2,'0')+':'+String(minute+5).padStart(2,'0')};
}
export function demoState(scenario,selectedId=2){
 if(!['normal','pa-vende','id-gabuar','offline','rikthimi'].includes(scenario))throw new Error('Skenar i panjohur');
 const offline=scenario==='offline';
 // Special scenarios always demonstrate Dritoni (ID 2); normal permits any card.
 if(scenario!=='normal')selectedId=2;
 const trips=[{id:1,driver:'Dreni',from:'Prizren',time:'08:00',seats:3},{id:2,driver:'Dritoni',from:'Ferizaj',time:scenario==='rikthimi'?'08:25':'08:15',seats:offline?1:scenario==='pa-vende'||scenario==='rikthimi'?0:2},{id:3,driver:'Lira',from:'Gjilan',time:'08:30',seats:1}];
 const id=scenario==='id-gabuar'?999:selectedId;
 const trip=trips.find(t=>t.id===id)||null;
 return {trips,trip,offline,source:offline?'Kopje e ruajtur në 07:00. Mund të jetë e vjetër.':'Përgjigje e serverit në këtë simulim.',disabled:!trip||offline||trip.seats===0,message:!trip?'Udhëtimi nuk u gjet. Kthehu te lista.':offline?'Lexim nga kopja. Kërkesa është e çaktivizuar.':trip.seats===0?'Nuk ka vende të lira. Zgjidh udhëtim tjetër.':'Mund të provosh kërkesën demonstrative.'};
}
export const runtimeSteps=[
 ['Telefoni','Arta hap listën e udhëtimeve.'],
 ['Vercel','Serveri Next.js merr kërkesën e leximit.'],
 ['Neon PostgreSQL','Serveri lexon rreshtat publikë. GitHub nuk merr pjesë në këtë kërkesë.'],
 ['Telefoni','Lista dhe ID-të shfaqen nga përgjigjja.'],
 ['Vercel','Për ndryshime reale serveri kontrollon sesionin dhe pronësinë.'],
 ['Neon PostgreSQL','Vetëm veprimi i lejuar mund të ndryshojë të dhëna. Ky demonstrim nuk shkruan asgjë.']
];
export const offlineSteps=[['Telefoni','Kërkohet lista, por rruga drejt serverit nuk përgjigjet.'],['Kopja në telefon','Lexohet lista publike e ruajtur më parë me kohën e saj.'],['Telefoni','Shfaqet paralajmërimi. Kërkesa për vend mbetet e çaktivizuar.']];

// Each case keeps its number while the professor changes only its teaching phase.
export const demoCasePhases={
 1:[{label:'Lista → detajet',scene:'normal',question:'A po lexojmë të njëjtin udhëtim?',change:'ID 2: lista dhe detajet tregojnë 08:15.',observe:'Zgjidh një kartë tjetër: ID-ja dhe detajet duhet ta ndjekin zgjedhjen.'},{label:'Dy orë të ndryshme',scene:'mismatch',question:'Pse ndryshon ora për të njëjtin ID?',change:'Lista mbetet 08:15; detajet tregojnë 08:40.',observe:'Krahaso ID-në, burimin dhe kohën e leximit. Mos e mbulo ndryshimin vetëm me tekst.'},{label:'ID që mungon',scene:'id-gabuar',question:'Çfarë duhet të shohë Arta kur ID 999 mungon?',change:'ID 999 nuk ka detaje. Shfaqet “Udhëtimi nuk u gjet”.',observe:'Butoni e kthen përdoruesin te lista; nuk shfaq udhëtim tjetër si të ishte i zgjedhuri.'}],
 2:[{label:'Ka 2 vende',scene:'normal',question:'Çfarë mund të bëjë Arta kur ka vende?',change:'Dritoni ka 2 vende. Kërkesa demonstrative mund të provohet.',observe:'Kjo është gjendja fillestare. Tani zgjidh “0 vende” dhe krahaso butonin.'},{label:'0 vende',scene:'pa-vende',question:'A mund të premtojmë një vend kur ka 0 vende?',change:'Numri bëhet 0 dhe butoni i kërkesës çaktivizohet.',observe:'Mesazhi “Nuk ka vende të lira” shpjegon pse veprimi nuk lejohet.'}],
 3:[{label:'Para klikimit',scene:'normal',question:'A është reagimi i butonit një rezervim?',change:'Kërkesa ende nuk është provuar. Shtyp butonin në telefonin e Artës.',observe:'Parashiko çfarë ndryshon në ekran dhe çfarë mbetet pa u ruajtur.'},{label:'Pas klikimit',scene:'pending',question:'Çfarë vërteton mesazhi “Në pritje”?',change:'Shfaqet “Në pritje · SIMULIM”. Vendet mbeten 2.',observe:'Nuk u ruajt kërkesë, nuk u rezervua vend dhe nuk u njoftua shoferi.'}],
 4:[{label:'Kopja e ruajtur',scene:'offline',question:'A është vendi në kopje ende i lirë tani?',change:'Kopja e orës 07:00 tregon 1 vend. Kërkesa mbetet joaktive.',observe:'Informacioni mund të jetë i vjetër. Koha e ruajtjes duhet të jetë e dukshme.'},{label:'Rrjeti u rikthye',scene:'offline',question:'A mjafton vetëm lidhja me rrjetin?',change:'Rrjeti është rikthyer, por ende nuk kemi përgjigje të re nga serveri.',observe:'Kopja vazhdon të tregojë 1 vend. Nuk e quajmë të dhënë të re pa përgjigje.'},{label:'Përgjigjja e re',scene:'rikthimi',question:'Çfarë ndryshon pasi serveri përgjigjet?',change:'Përgjigjja e re tregon nisjen 08:25 dhe 0 vende.',observe:'Krahaso me kopjen: 08:15 / 1 vend. Butoni mbetet joaktiv sepse tani ka 0 vende.'}],
 5:[{label:'Arta nuk është pronarja',scene:'normal',question:'Kush lejohet të ndryshojë udhëtimin e Dritonit?',change:'Udhëtimi i përket Dritonit. Arta mund t’i lexojë detajet.',observe:'Fshehja e butonit ndihmon ndërfaqen; vendimin për ndryshim e merr serveri real.'},{label:'Provo si Arta',scene:'permission-denied',question:'Çfarë ndodh kur vepron llogaria tjetër?',change:'SIMULIM: ndryshimi i Artës refuzohet. Ora mbetet 08:15.',observe:'Në aplikacionin real serveri verifikon sesionin dhe pronësinë përpara çdo ndryshimi.'},{label:'Provo si Dritoni',scene:'permission-allowed',question:'Çfarë ndryshon kur vepron pronari?',change:'SIMULIM: pronari lejohet. Ora e ilustruar bëhet 08:25.',observe:'Është ndryshim lokal i demonstrimit; nuk u verifikua llogari dhe nuk u shkrua në databazë.'}],
 6:[{label:'Dy lexime, 1 vend',scene:'last-seat',question:'Arta dhe Besa shohin 1 vend. A e kanë të dyja të siguruar?',change:'Të dyja panë të njëjtin numër: 1 vend. Asnjëra nuk ka konfirmim.',observe:'Vetëm diskutim për një version të ardhshëm. Ky demonstrim nuk zgjedh fitues dhe nuk rezervon.'},{label:'Zbulo arsyetimin',scene:'last-seat',question:'Ku duhet të merret vendimi përfundimtar?',change:'Vendimi kërkon proces real e të sigurt në server dhe databazë.',observe:'Vetëm diskutim për një version të ardhshëm. Dy lexime nuk krijojnë dy vende; ky MVP nuk ka proces rezervimi.'}]
};
export function teachingPhoneState(scene='normal',selectedId=2){
 const extra=['mismatch','pending','permission-denied','permission-allowed','last-seat'];
 if(!extra.includes(scene))return {...demoState(scene,selectedId),scene};
 const fixed=scene==='pending'?selectedId:2;
 let base=demoState('normal',fixed);
 if(scene==='permission-allowed'||scene==='last-seat'){
  const trips=base.trips.map(t=>t.id===2?{...t,...(scene==='permission-allowed'?{time:'08:25'}:{seats:1})}:t);
  base={...base,trips,trip:trips.find(t=>t.id===2)};
 }
 return {...base,scene,pending:scene==='pending',mismatch:scene==='mismatch',permission:scene.startsWith('permission-')?(scene==='permission-allowed'?'allowed':'denied'):null,discussion:scene==='last-seat',disabled:scene.startsWith('permission-')||scene==='last-seat',message:scene.startsWith('permission-')?(scene==='permission-allowed'?'Pronari lejohet vetëm në ilustrimin lokal.':'Arta refuzohet në ilustrimin lokal.'):scene==='pending'?'Në pritje · simulim, pa ruajtje.':scene==='last-seat'?'Pa konfirmim rezervimi.':base.message,source:scene.startsWith('permission-')?'Ilustrim lokal i vendimit. Pa hyrje reale ose lidhje me databazë.':scene==='last-seat'?'Dy lexime fiktive të të njëjtit vend. Pa konfirmim.':base.source};
}
export function demoCaseState(caseId=1,phase=0,selectedId=2){
 const phases=demoCasePhases[caseId];if(!phases||!Number.isInteger(phase)||!phases[phase])throw new Error('Rast ose gjendje e panjohur');
 const info=phases[phase],state=teachingPhoneState(info.scene,caseId===1?selectedId:2);
 let flow=runtimeSteps;
 if(caseId===1)flow=[['Telefoni','Arta zgjedh një kartë dhe dërgon ID-në e udhëtimit.'],['Vercel','Serveri Next.js lexon ID-në e kërkuar.'],['Neon PostgreSQL','Në rrjedhën reale kthehen të dhënat e atij ID-je ose mungesa e tij.'],['Telefoni','Detajet lidhen me të njëjtin ID; mungesa shpjegohet pa zëvendësim të fshehtë.']];
 if(caseId===2)flow=[['Telefoni','Arta hap udhëtimin dhe lexon vendet.'],['Vercel / Neon','Në rrjedhën reale serveri kthen numrin e vendeve.'],['Telefoni',phase===1?'0 vende: mesazh i qartë dhe kërkesë joaktive.':'2 vende: shfaqet mundësia për kërkesë, pa pretenduar rezervim.']];
 if(caseId===3)flow=[['Telefoni','Arta shtyp butonin e simulimit.'],['Ndërfaqja','Gjendja ndryshon në “Në pritje · SIMULIM”.'],['Pa ruajtje','Ky demonstrim nuk dërgon kërkesë, nuk shkruan në Neon dhe nuk rezervon vend.']];
 if(caseId===4)flow=phase===0?offlineSteps:phase===1?[['Rrjeti','Lidhja duket e rikthyer.'],['Vercel','Pa përgjigje të suksesshme ende nuk kemi të dhëna të reja.'],['Telefoni','Vazhdon kopja e ruajtur dhe paralajmërimi.']]:[['Telefoni','Dërgohet një kërkesë e re për të dhënat.'],['Vercel / Neon','Në rrjedhën reale serveri lexon gjendjen aktuale.'],['Telefoni','Përgjigjja e re shfaq 08:25 dhe 0 vende.']];
 if(caseId===5)flow=[['Telefoni','Kërkohet ndryshimi i udhëtimit të Dritonit.'],['Serveri real','Duhet të verifikojë sesionin dhe pronarin. Këtu vetëm e ilustrojmë.'],[phase===2?'Lejo pronarin':'Refuzo llogarinë tjetër',phase===2?'Ilustrohet ora 08:25. Nuk ka shkrim real në databazë.':'Refuzimi ndodh përpara ndryshimit. Ora mbetet 08:15.']];
 if(caseId===6)flow=[['Arta dhe Besa','Secila lexon se ka 1 vend.'],['Serveri real','Një version i ardhshëm do të duhet të vendosë sigurt mbi rezervimin.'],['Pa konfirmim','Ky MVP nuk e ka atë proces. Nuk premtojmë dy rezervime.']];
 const change=caseId===1&&phase===0&&state.trip?`ID ${state.trip.id}: lista dhe detajet tregojnë ${state.trip.time}.`:info.change;
 return {caseId,phase,phases,...info,change,state,flow};
}
